"use client";

import type { DynamicToolUIPart, ToolUIPart } from "ai";

import { getToolName } from "ai";
import { BotIcon } from "lucide-react";
import { z } from "zod";

import type { SubagentTraces } from "@/lib/chat/projector";

import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from "@/components/ai-elements/confirmation";
import { MessageResponse } from "@/components/ai-elements/message";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SUBAGENT_PREFIX } from "@/lib/subagent-prefix";
import { cn } from "@/lib/utils";

interface ToolPartProps {
  addToolApprovalResponse: (response: { approved: boolean; id: string }) => void;
  part: DynamicToolUIPart | ToolUIPart;
  subagentTraces?: SubagentTraces;
}

const messagePartSchema = z.union([
  z.object({ text: z.string(), type: z.literal("text") }),
  z.object({ type: z.string() }).loose(),
]);

const messageSchema = z.object({
  id: z.string(),
  parts: z.array(messagePartSchema),
  role: z.string(),
});

const subagentOutputSchema = z.object({
  messages: z.array(messageSchema).optional(),
  runId: z.string(),
  status: z.enum(["done", "running"]),
  text: z.string().optional(),
});

const isSubagentOutput = (output: unknown): output is z.infer<typeof subagentOutputSchema> => {
  return subagentOutputSchema.safeParse(output).success;
};

const SubagentMessages = ({ messages }: { messages: z.infer<typeof messageSchema>[] }) => {
  const assistantMessages = messages.filter((m) => m.role === "assistant");

  if (assistantMessages.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-muted-foreground text-xs font-medium tracking-wide">TRANSCRIPT</h4>
      <div className="flex flex-col gap-2">
        {assistantMessages.map((message) => {
          const text = message.parts
            .flatMap((part) => (part.type === "text" ? [part.text] : []))
            .join("");

          if (!text.trim()) return null;

          return (
            <div className="bg-muted/50 rounded-md p-3 text-xs" key={message.id}>
              <MessageResponse className="text-xs">{text}</MessageResponse>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface SubagentOutputProps {
  output: z.infer<typeof subagentOutputSchema>;
  persistedMessages?: z.infer<typeof messageSchema>[];
}

const SubagentOutput = ({ output, persistedMessages }: SubagentOutputProps) => {
  const liveMessages = output.messages ?? [];
  const messages = liveMessages.length > 0 ? liveMessages : (persistedMessages ?? []);
  const isRunning = output.status === "running";

  return (
    <Collapsible defaultOpen={isRunning}>
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center justify-between gap-2 text-xs",
          "text-muted-foreground hover:text-foreground transition-colors",
        )}
      >
        <span className="font-medium">{isRunning ? "running..." : "view transcript"}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        {messages.length > 0 ? (
          <SubagentMessages messages={messages} />
        ) : output.status === "done" && output.text?.trim() ? (
          <MessageResponse className="text-xs">{output.text}</MessageResponse>
        ) : (
          <p className="text-muted-foreground text-xs">no messages yet.</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export const ToolPart = ({ addToolApprovalResponse, part, subagentTraces }: ToolPartProps) => {
  const approvalId = part.approval?.id ?? "";
  const rawName = getToolName(part);
  const isSubagent = rawName.startsWith(SUBAGENT_PREFIX);
  const toolName = isSubagent ? rawName.slice(SUBAGENT_PREFIX.length) : rawName;

  const subagentResult =
    typeof part.output === "object" && part.output !== null && isSubagentOutput(part.output)
      ? part.output
      : null;

  const persistedTrace = isSubagent ? subagentTraces?.[part.toolCallId] : undefined;
  const persistedMessages = persistedTrace?.flatMap((msg) => {
    const parsed = messageSchema.safeParse(msg);

    return parsed.success ? [parsed.data] : [];
  });

  const output =
    typeof part.output === "string" ? (
      <MessageResponse>{part.output}</MessageResponse>
    ) : (
      part.output
    );

  const subagentIcon = isSubagent ? (
    <BotIcon className="text-muted-foreground size-4" />
  ) : undefined;
  const subagentBadge = isSubagent ? (
    <Badge className="rounded-full text-[10px]" variant="outline">
      sub-agent
    </Badge>
  ) : undefined;

  return (
    <>
      <Confirmation approval={part.approval} state={part.state}>
        <ConfirmationTitle>
          allow <strong>{toolName}</strong>?
        </ConfirmationTitle>
        <ConfirmationRequest>
          the assistant wants to run <strong>{toolName}</strong>. do you want to allow this?
        </ConfirmationRequest>
        <ConfirmationAccepted>approved</ConfirmationAccepted>
        <ConfirmationRejected>rejected</ConfirmationRejected>
        <ConfirmationActions>
          <ConfirmationAction
            onClick={() => {
              addToolApprovalResponse({ approved: false, id: approvalId });
            }}
            variant="outline"
          >
            reject
          </ConfirmationAction>
          <ConfirmationAction
            onClick={() => {
              addToolApprovalResponse({ approved: true, id: approvalId });
            }}
          >
            approve
          </ConfirmationAction>
        </ConfirmationActions>
      </Confirmation>
      <Tool>
        {isSubagent ? (
          <ToolHeader
            badge={subagentBadge}
            icon={subagentIcon}
            state={part.state}
            toolName={toolName}
            type={part.type}
          />
        ) : part.type === "dynamic-tool" ? (
          <ToolHeader state={part.state} toolName={part.toolName} type={part.type} />
        ) : (
          <ToolHeader state={part.state} type={part.type} />
        )}
        <ToolContent>
          <ToolInput input={part.input} />
          {subagentResult ? (
            <SubagentOutput output={subagentResult} persistedMessages={persistedMessages} />
          ) : (
            <ToolOutput errorText={part.errorText} output={output} />
          )}
        </ToolContent>
      </Tool>
    </>
  );
};
