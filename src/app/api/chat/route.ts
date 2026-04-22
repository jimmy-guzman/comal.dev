import { convertToModelMessages, safeValidateUIMessages, stepCountIs, streamText, tool } from "ai";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { formatSpecValidationForPrompt } from "@/lib/format-spec-validation-for-prompt";
import { openrouter } from "@/lib/openrouter";
import {
  assertWorkspaceWriteAccess,
  getWorkspaceSpecForUser,
  insertWorkspaceChatMessage,
  updateWorkspaceSpecForUser,
} from "@/lib/studio";
import { validateWorkspaceSpecYaml } from "@/lib/validate-workspace-spec";

const defaultModelId = "openai/gpt-4o-mini";

/** Avoid huge system prompts when the editor buffer is very large; validation still uses full text. */
const MAX_DRAFT_YAML_EMBED_CHARS = 120_000;

/** Listed issues in tool output; full validation still runs on the saved YAML. */
const TOOL_POST_SAVE_MAX_ISSUES = 15;

async function toolResultAfterSuccessfulSave(revisionNumber: number, yaml: string) {
  const v = await validateWorkspaceSpecYaml(yaml);
  const validationSummary = formatSpecValidationForPrompt(v, {
    maxIssues: TOOL_POST_SAVE_MAX_ISSUES,
  });
  const base = {
    ok: true as const,
    revisionNumber,
    validationOk: v.ok,
    validationSummary,
  };
  if (v.ok && v.spectralIssues.length > 0) {
    return {
      ...base,
      spectralNoteCount: v.spectralIssues.length,
    };
  }
  return base;
}

const postBodySchema = z.object({
  id: z.string().optional(),
  messages: z.array(z.unknown()).min(1),
  trigger: z.enum(["submit-message", "regenerate-message"]).optional(),
  messageId: z.string().nullable().optional(),
  workspaceId: z.string().min(1),
  model: z.string().min(1).optional(),
  draftSpecYaml: z.string().optional(),
  specValidating: z.boolean().optional(),
});

const specSystemPrompt = `You are Comal, an API design assistant. The OpenAPI YAML in the code block below is the **saved** workspace revision (what persists on disk).

A following system message may contain **server validation** (YAML parse, OpenAPI schema, Spectral). That may describe the **saved** revision even when no separate editor draft was sent (e.g. spec pane hidden). If another message includes an **editor draft** that differs from the saved revision, that text is what the user is typing (possibly unsaved). Use the validation section whenever the user asks about errors or fixes.

When the user asks you to change the API (paths, schemas, parameters, etc.), you MUST apply edits by calling the updateWorkspaceSpec tool with the full replacement YAML. Do not paste a full replacement OpenAPI document only in chat; use the tool so the workspace stays in sync.

**Saving is not validating.** The tool response includes \`validationOk\` and \`validationSummary\` for the YAML that was just written. Do **not** claim the spec has no schema or lint problems unless \`validationOk\` is true (and check \`spectralNoteCount\` if present—non-blocking notes may still exist). If \`validationOk\` is false, acknowledge remaining issues from \`validationSummary\` and continue fixing.

Prefer fixing validation issues listed in the server validation section when proposing tool output.

If you are only explaining or reviewing and no file change is needed, answer in plain language without calling the tool.`;

export async function POST(req: Request) {
  let json: unknown;

  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(json);

  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const validation = await safeValidateUIMessages({
    messages: parsed.data.messages,
  });

  if (!validation.success) {
    return Response.json({ error: validation.error.message }, { status: 400 });
  }

  const messagesWithoutIds = validation.data.map((m) => {
    const { id, ...rest } = m;
    void id;
    return rest;
  });

  const modelMessages = await convertToModelMessages(messagesWithoutIds);

  const access = await assertWorkspaceWriteAccess(session.user.id, parsed.data.workspaceId);

  if (!access) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const workspaceSpec = await getWorkspaceSpecForUser(session.user.id, parsed.data.workspaceId);

  if (!workspaceSpec) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const userId = session.user.id;
  const workspaceId = parsed.data.workspaceId;

  const updateWorkspaceSpec = tool({
    description:
      "Replace the entire OpenAPI document for this workspace with the given YAML string. Call this when the user wants the spec file updated. On success, the response includes validationOk and validationSummary from server-side OpenAPI/Spectral checks on the saved YAML—check validationOk before telling the user the spec is error-free.",
    inputSchema: z.object({
      content: z.string().min(1).describe("Full OpenAPI document as YAML."),
    }),
    execute: async ({ content: nextContent }) => {
      let spec = await getWorkspaceSpecForUser(userId, workspaceId);

      if (!spec) {
        return { ok: false as const, error: "Workspace spec was not found." };
      }

      let result = await updateWorkspaceSpecForUser({
        userId,
        workspaceId,
        content: nextContent,
        expectedRevisionNumber: spec.revisionNumber,
        changeSource: "chat",
        messageId: null,
      });

      if (result.ok) {
        return toolResultAfterSuccessfulSave(result.revisionNumber, nextContent);
      }

      if (result.kind === "conflict") {
        spec = await getWorkspaceSpecForUser(userId, workspaceId);

        if (!spec) {
          return { ok: false as const, error: "Workspace spec was not found after conflict." };
        }

        result = await updateWorkspaceSpecForUser({
          userId,
          workspaceId,
          content: nextContent,
          expectedRevisionNumber: spec.revisionNumber,
          changeSource: "chat",
          messageId: null,
        });

        if (result.ok) {
          return toolResultAfterSuccessfulSave(result.revisionNumber, nextContent);
        }

        if (result.kind === "conflict") {
          return {
            ok: false as const,
            error:
              "The spec changed again while saving. Ask the user to retry, or read the latest spec from context on the next message.",
          };
        }
      }

      if (result.kind === "forbidden") {
        return { ok: false as const, error: "You do not have permission to edit this spec." };
      }

      return { ok: false as const, error: "Could not update the spec." };
    },
  });

  const specContextMessage = {
    role: "system" as const,
    content: `${specSystemPrompt}

Format: ${workspaceSpec.format}

Saved OpenAPI YAML (revision ${workspaceSpec.revisionNumber}):
\`\`\`yaml
${workspaceSpec.content}
\`\`\``,
  };

  const systemMessages: Array<{ role: "system"; content: string }> = [specContextMessage];

  const rawDraftSpecYaml = parsed.data.draftSpecYaml;
  const hasEditorDraft = rawDraftSpecYaml !== undefined && rawDraftSpecYaml.length > 0;

  if (hasEditorDraft) {
    const draftSpecYaml = rawDraftSpecYaml;
    const draftValidation = await validateWorkspaceSpecYaml(draftSpecYaml);
    const validationText = formatSpecValidationForPrompt(draftValidation, {
      specValidating: parsed.data.specValidating === true,
    });

    if (draftSpecYaml === workspaceSpec.content) {
      systemMessages.push({
        role: "system",
        content: `The editor buffer matches the **saved** workspace revision (revision ${workspaceSpec.revisionNumber}). The YAML is already shown in the previous system message.

The following server validation applies to that same YAML (what the user sees in the spec pane). Use it when explaining or fixing issues.

--- Server validation ---

${validationText}`,
      });
    } else {
      const draftYamlSection =
        draftSpecYaml.length > MAX_DRAFT_YAML_EMBED_CHARS
          ? `The editor draft is too large to embed in full (${draftSpecYaml.length} characters). Validation above was run on the **entire** draft text from the client. Do not assume you have seen the whole document; ask for a snippet if needed.`
          : `Current OpenAPI YAML in the editor (unsaved; differs from saved revision ${workspaceSpec.revisionNumber}):

\`\`\`yaml
${draftSpecYaml}
\`\`\``;

      systemMessages.push({
        role: "system",
        content: `Editor draft (not yet saved). The previous system message shows the **saved** revision; this message is the user's **current buffer** and what they see in the spec editor.

When calling updateWorkspaceSpec, emit complete replacement YAML that resolves the validation issues below when possible.

--- Server validation ---

${validationText}

--- Draft ---

${draftYamlSection}`,
      });
    }
  } else {
    const savedValidation = await validateWorkspaceSpecYaml(workspaceSpec.content);
    const validationText = formatSpecValidationForPrompt(savedValidation, {
      specValidating: false,
    });

    systemMessages.push({
      role: "system",
      content: `No editor draft was sent with this request (for example, the spec pane may be hidden). The following **server validation** applies to the **saved** workspace revision (revision ${workspaceSpec.revisionNumber}) already shown in the previous system message.

--- Server validation ---

${validationText}`,
    });
  }

  const userMessage = [...validation.data].reverse().find((message) => message.role === "user");

  if (userMessage) {
    await insertWorkspaceChatMessage({
      id: userMessage.id,
      workspaceId: parsed.data.workspaceId,
      role: userMessage.role,
      parts: userMessage.parts,
      createdByUserId: session.user.id,
      modelId: parsed.data.model,
    });
  }

  const modelId = parsed.data.model ?? defaultModelId;

  const result = streamText({
    model: openrouter(modelId),
    messages: [...systemMessages, ...modelMessages],
    tools: {
      updateWorkspaceSpec,
    },
    stopWhen: stepCountIs(8),
  });

  return result.toUIMessageStreamResponse({
    onFinish: async ({ responseMessage }) => {
      const responseMessageId = responseMessage.id?.trim();

      await insertWorkspaceChatMessage({
        id: responseMessageId && responseMessageId.length > 0 ? responseMessageId : undefined,
        workspaceId: parsed.data.workspaceId,
        role: responseMessage.role,
        parts: responseMessage.parts,
        createdByUserId: null,
        modelId,
      });
    },
  });
}
