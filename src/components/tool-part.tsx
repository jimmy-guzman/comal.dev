"use client";

import type { DynamicToolUIPart, ToolUIPart, UIMessage } from "ai";

import { getToolName } from "ai";
import { z } from "zod";

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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface ToolPartProps {
  addToolApprovalResponse: (response: { approved: boolean; id: string }) => void;
  part: DynamicToolUIPart | ToolUIPart;
}

const subagentOutputSchema = z.object({
  messages: z.array(z.unknown()).optional(),
  runId: z.string(),
  status: z.enum(["done", "running"]),
  text: z.string().optional(),
});

const isSubagentOutput = (output: unknown): output is z.infer<typeof subagentOutputSchema> => {
  return subagentOutputSchema.safeParse(output).success;
};

const SubagentMessages = ({ messages }: { messages: UIMessage[] }) => {
  const assistantMessages = messages.filter((m) => m.role === "assistant");

  if (assistantMessages.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Transcript
      </h4>
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

const SubagentOutput = ({ output }: { output: z.infer<typeof subagentOutputSchema> }) => {
  const messages = (output.messages ?? []) as UIMessage[];
  const isRunning = output.status === "running";

  return (
    <Collapsible defaultOpen={isRunning}>
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center justify-between gap-2 text-xs",
          "text-muted-foreground hover:text-foreground transition-colors",
        )}
      >
        <span className="font-medium">{isRunning ? "Running..." : "View transcript"}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        {messages.length > 0 ? (
          <SubagentMessages messages={messages} />
        ) : (
          <p className="text-muted-foreground text-xs">No messages yet.</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export const ToolPart = ({ addToolApprovalResponse, part }: ToolPartProps) => {
  const approvalId = part.approval?.id ?? "";
  const toolName = getToolName(part);

  const subagentResult =
    typeof part.output === "object" && part.output !== null && isSubagentOutput(part.output)
      ? part.output
      : null;

  const output =
    typeof part.output === "string" ? (
      <MessageResponse>{part.output}</MessageResponse>
    ) : (
      part.output
    );

  return (
    <>
      <Confirmation approval={part.approval} state={part.state}>
        <ConfirmationTitle>
          Allow <strong>{toolName}</strong>?
        </ConfirmationTitle>
        <ConfirmationRequest>
          The assistant wants to run <strong>{toolName}</strong>. Do you want to allow this?
        </ConfirmationRequest>
        <ConfirmationAccepted>Approved</ConfirmationAccepted>
        <ConfirmationRejected>Rejected</ConfirmationRejected>
        <ConfirmationActions>
          <ConfirmationAction
            onClick={() => {
              addToolApprovalResponse({ approved: false, id: approvalId });
            }}
            variant="outline"
          >
            Reject
          </ConfirmationAction>
          <ConfirmationAction
            onClick={() => {
              addToolApprovalResponse({ approved: true, id: approvalId });
            }}
          >
            Approve
          </ConfirmationAction>
        </ConfirmationActions>
      </Confirmation>
      <Tool>
        {part.type === "dynamic-tool" ? (
          <ToolHeader state={part.state} toolName={toolName} type={part.type} />
        ) : (
          <ToolHeader state={part.state} type={part.type} />
        )}
        <ToolContent>
          <ToolInput input={part.input} />
          {subagentResult ? (
            <SubagentOutput output={subagentResult} />
          ) : (
            <ToolOutput errorText={part.errorText} output={output} />
          )}
        </ToolContent>
      </Tool>
    </>
  );
};
