"use client";

import type { ToolSelection } from "@/lib/agent-tool-selection";

import { tools } from "@/agents/tools/registry";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";

interface Props {
  onChange: (next: ToolSelection[]) => void;
  value: ToolSelection[];
}

const isApprovalConfig = (
  config: Record<string, unknown>,
): config is { needsApproval: boolean } => {
  return typeof config.needsApproval === "boolean";
};

export const AgentToolPicker = ({ onChange, value }: Props) => {
  const updateAt = (index: number, next: Partial<ToolSelection>) => {
    onChange(value.map((entry, i) => (i === index ? { ...entry, ...next } : entry)));
  };

  return (
    <div className="flex flex-col gap-3">
      {value.map((selection, index) => {
        const def = tools.get(selection.toolId);

        if (!def) return null;

        return (
          <div
            className="flex flex-col gap-3 rounded-md border p-4"
            data-state={selection.enabled ? "enabled" : "disabled"}
            key={def.id}
          >
            <Field orientation="horizontal">
              <div className="flex flex-1 flex-col gap-1">
                <FieldLabel htmlFor={`tool-${def.id}`}>{def.name}</FieldLabel>
                <FieldDescription>{def.description}</FieldDescription>
              </div>
              <Switch
                checked={selection.enabled}
                id={`tool-${def.id}`}
                onCheckedChange={(checked) => {
                  updateAt(index, { enabled: checked });
                }}
              />
            </Field>

            {selection.enabled && isApprovalConfig(selection.config) ? (
              <Field orientation="horizontal">
                <div className="flex flex-1 flex-col gap-1">
                  <FieldLabel htmlFor={`tool-${def.id}-approval`}>Require approval</FieldLabel>
                  <FieldDescription>
                    Ask before each call. Recommended for tools that fetch external content.
                  </FieldDescription>
                </div>
                <Switch
                  checked={selection.config.needsApproval}
                  id={`tool-${def.id}-approval`}
                  onCheckedChange={(checked) => {
                    updateAt(index, {
                      config: { ...selection.config, needsApproval: checked },
                    });
                  }}
                />
              </Field>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
