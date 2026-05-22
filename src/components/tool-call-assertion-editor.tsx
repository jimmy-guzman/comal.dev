"use client";

import { XIcon } from "lucide-react";

import type { FormAssertion } from "@/components/tool-call-assertion-form";

import { tools } from "@/agents/tools/registry";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SUBAGENT_PREFIX } from "@/lib/subagent-prefix";

interface ToolOption {
  label: string;
  value: string;
}

const ToolChipField = ({
  description,
  label,
  onChange,
  options,
  selected,
}: {
  description: string;
  label: string;
  onChange: (next: string[]) => void;
  options: ToolOption[];
  selected: string[];
}) => {
  const available = options.filter((option) => !selected.includes(option.value));
  const labelFor = (value: string) => {
    return options.find((option) => option.value === value)?.label ?? value;
  };

  return (
    <Field>
      <FieldLabel className="text-xs">{label}</FieldLabel>
      <FieldDescription>{description}</FieldDescription>
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selected.map((value) => {
            return (
              <Badge className="gap-1" key={value} variant="secondary">
                {labelFor(value)}
                <button
                  aria-label={`remove ${value}`}
                  onClick={() => {
                    onChange(selected.filter((entry) => entry !== value));
                  }}
                  type="button"
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      ) : null}
      <Select
        key={selected.length}
        onValueChange={(value) => {
          onChange([...selected, value]);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="add a tool" />
        </SelectTrigger>
        <SelectContent>
          {available.map((option) => {
            return (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </Field>
  );
};

interface Props {
  onChange: (next: FormAssertion) => void;
  subAgents: { alias: string }[];
  value: FormAssertion;
}

export const ToolCallAssertionEditor = ({ onChange, subAgents, value }: Props) => {
  const options: ToolOption[] = [
    ...tools.list().map((meta) => ({ label: meta.id, value: meta.id })),
    ...subAgents.map((subAgent) => {
      return {
        label: `${subAgent.alias} (sub-agent)`,
        value: `${SUBAGENT_PREFIX}${subAgent.alias}`,
      };
    }),
  ];

  return (
    <div className="flex flex-col gap-3">
      <ToolChipField
        description="tools the agent must use for this input."
        label="must call"
        onChange={(mustCall) => {
          onChange({ ...value, mustCall });
        }}
        options={options}
        selected={value.mustCall}
      />
      <ToolChipField
        description="tools the agent must not use for this input."
        label="must not call"
        onChange={(mustNotCall) => {
          onChange({ ...value, mustNotCall });
        }}
        options={options}
        selected={value.mustNotCall}
      />
      <Field>
        <FieldLabel className="text-xs">must call with args</FieldLabel>
        <FieldDescription>
          optional JSON array of {`{ "tool": "...", "argsMatch": { ... } }`}.
        </FieldDescription>
        <Textarea
          className="field-sizing-content min-h-16 resize-none font-mono text-xs"
          onChange={(event) => {
            onChange({ ...value, mustCallWithArgsJson: event.target.value });
          }}
          placeholder={'[{ "tool": "web-search", "argsMatch": { "query": "..." } }]'}
          value={value.mustCallWithArgsJson}
        />
      </Field>
    </div>
  );
};
