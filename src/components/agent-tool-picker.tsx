"use client";

import type { ToolSelection } from "@/lib/agent-tool-selection";

import { AgentToolLibrary } from "@/components/agent-tool-library";

interface Props {
  onChange: (next: ToolSelection[]) => void;
  value: ToolSelection[];
}

export const AgentToolPicker = ({ onChange, value }: Props) => {
  return <AgentToolLibrary onChange={onChange} value={value} />;
};
