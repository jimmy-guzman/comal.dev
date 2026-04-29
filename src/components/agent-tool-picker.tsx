"use client";

import { useState } from "react";

import type { ToolSelection } from "@/lib/agent-tool-selection";

import { tools } from "@/agents/tools/registry";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
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

interface ToolRowProps {
  onUpdate: (next: Partial<ToolSelection>) => void;
  selection: ToolSelection;
}

const ToolRow = ({ onUpdate, selection }: ToolRowProps) => {
  const def = tools.get(selection.toolId);

  if (!def) return null;

  return (
    <div
      className="flex flex-col gap-3 rounded-md border p-4"
      data-state={selection.enabled ? "enabled" : "disabled"}
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
            onUpdate({ enabled: checked });
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
              onUpdate({
                config: { ...selection.config, needsApproval: checked },
              });
            }}
          />
        </Field>
      ) : null}
    </div>
  );
};

export const AgentToolPicker = ({ onChange, value }: Props) => {
  const grouped = tools
    .listByGroup()
    .toSorted((a, b) => a.items.length - b.items.length);

  const [defaultOpen] = useState(() => {
    return grouped
      .filter(({ items }) => {
        return items.some((tool) => {
          return value.find((s) => s.toolId === tool.id)?.enabled;
        });
      },
      )
      .map(({ group }) => group.id);
  },
  );

  const updateAt = (index: number, next: Partial<ToolSelection>) => {
    onChange(value.map((entry, i) => (i === index ? { ...entry, ...next } : entry)));
  };

  return (
    <Accordion className="flex flex-col gap-2" defaultValue={defaultOpen} type="multiple">
      {grouped.map(({ group, items }) => {
        const selections = items.map((tool) => {
          const index = value.findIndex((entry) => entry.toolId === tool.id);

          return { index, selection: index === -1 ? undefined : value[index], tool };
        });

        const enabledCount = selections.filter(({ selection }) => {
          return selection?.enabled;
        }).length;

        return (
          <AccordionItem className="rounded-md border px-4" key={group.id} value={group.id}>
            <AccordionTrigger className="text-sm">
              <span className="flex flex-1 items-center justify-between gap-3 pr-2">
                <span>{group.label}</span>
                <Badge variant="secondary">
                  {enabledCount} / {items.length}
                </Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="flex flex-col gap-3">
                {selections.map(({ index, selection }) => {
                  return selection === undefined ? null : (
                    <ToolRow
                      key={selection.toolId}
                      onUpdate={(next) => {
                        updateAt(index, next);
                      }}
                      selection={selection}
                    />
                  );
                },
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
};
