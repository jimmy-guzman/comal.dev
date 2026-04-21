import { convertToModelMessages, safeValidateUIMessages, stepCountIs, streamText, tool } from "ai";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { openrouter } from "@/lib/openrouter";
import {
  assertWorkspaceWriteAccess,
  getWorkspaceSpecForUser,
  insertWorkspaceChatMessage,
  updateWorkspaceSpecForUser,
} from "@/lib/studio";

const defaultModelId = "openai/gpt-4o-mini";

const postBodySchema = z.object({
  id: z.string().optional(),
  messages: z.array(z.unknown()).min(1),
  trigger: z.enum(["submit-message", "regenerate-message"]).optional(),
  messageId: z.string().nullable().optional(),
  workspaceId: z.string().min(1),
  model: z.string().min(1).optional(),
});

const specSystemPrompt = `You are Comal, an API design assistant. The following OpenAPI document is the current source of truth for this workspace.

When the user asks you to change the API (paths, schemas, parameters, etc.), you MUST apply edits by calling the updateWorkspaceSpec tool with the full replacement YAML. Do not paste a full replacement OpenAPI document only in chat; use the tool so the workspace stays in sync.

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
      "Replace the entire OpenAPI document for this workspace with the given YAML string. Call this when the user wants the spec file updated.",
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
        return {
          ok: true as const,
          revisionNumber: result.revisionNumber,
        };
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
          return {
            ok: true as const,
            revisionNumber: result.revisionNumber,
          };
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

Current OpenAPI YAML (revision ${workspaceSpec.revisionNumber}):
\`\`\`yaml
${workspaceSpec.content}
\`\`\``,
  };

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
    messages: [specContextMessage, ...modelMessages],
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
