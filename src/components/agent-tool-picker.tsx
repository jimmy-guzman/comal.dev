"use client";

import type { ToolSelection } from "@/lib/agent-tool-selection";

import { AgentToolLibrary } from "@/components/agent-tool-library";

interface Props {
  onChange: (next: ToolSelection[]) => void;
  readOnly?: boolean;
  value: ToolSelection[];
}

export const AgentToolPicker = ({ onChange, readOnly = false, value }: Props) => {
  return <AgentToolLibrary onChange={onChange} readOnly={readOnly} value={value} />;
};
