"use client";

import type { DynamicToolUIPart, ToolUIPart } from "ai";

import { getToolName } from "ai";

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

interface ToolPartProps {
  addToolApprovalResponse: (response: { approved: boolean; id: string }) => void;
  part: DynamicToolUIPart | ToolUIPart;
}

export const ToolPart = ({ addToolApprovalResponse, part }: ToolPartProps) => {
  const approvalId = part.approval?.id ?? "";
  const toolName = getToolName(part);
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
          <ToolOutput errorText={part.errorText} output={output} />
        </ToolContent>
      </Tool>
    </>
  );
};
