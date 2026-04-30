"use client";

import { z } from "zod";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface Props {
  idPrefix: string;
  onChange: (next: Record<string, unknown>) => void;
  schema: z.ZodObject<z.ZodRawShape>;
  value: Record<string, unknown>;
}

const humanize = (key: string) => {
  const spaced = key
    .replaceAll(/[_-]+/g, " ")
    .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

interface FieldRendererProps {
  description?: string;
  fieldId: string;
  label: string;
  onChange: (next: unknown) => void;
  schema: z.ZodType;
  value: unknown;
}

const FieldRenderer = ({
  description,
  fieldId,
  label,
  onChange,
  schema,
  value,
}: FieldRendererProps) => {
  if (schema instanceof z.ZodBoolean) {
    return (
      <Field orientation="horizontal">
        <div className="flex flex-1 flex-col gap-1">
          <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
          {description ? <FieldDescription>{description}</FieldDescription> : null}
        </div>
        <Switch
          checked={Boolean(value)}
          id={fieldId}
          onCheckedChange={(checked) => {
            onChange(checked);
          }}
        />
      </Field>
    );
  }

  if (schema instanceof z.ZodEnum) {
    const options = schema.options.map(String);
    const stringValue = typeof value === "string" ? value : "";

    return (
      <Field>
        <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
        {description ? <FieldDescription>{description}</FieldDescription> : null}
        <Select
          name={fieldId}
          onValueChange={(next) => {
            onChange(next);
          }}
          value={stringValue}
        >
          <SelectTrigger id={fieldId}>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => {
              return (
                <SelectItem key={option} value={option}>
                  {humanize(option)}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </Field>
    );
  }

  if (schema instanceof z.ZodNumber) {
    return (
      <Field>
        <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
        {description ? <FieldDescription>{description}</FieldDescription> : null}
        <Input
          id={fieldId}
          onChange={(event) => {
            const raw = event.target.value;

            if (raw === "") {
              onChange(undefined);

              return;
            }

            const parsed = Number(raw);

            onChange(Number.isFinite(parsed) ? parsed : undefined);
          }}
          type="number"
          value={typeof value === "number" ? String(value) : ""}
        />
      </Field>
    );
  }

  if (schema instanceof z.ZodString) {
    return (
      <Field>
        <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
        {description ? <FieldDescription>{description}</FieldDescription> : null}
        <Input
          id={fieldId}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          type="text"
          value={typeof value === "string" ? value : ""}
        />
      </Field>
    );
  }

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <FieldDescription>Unsupported config type.</FieldDescription>
    </Field>
  );
};

export const AgentToolConfigEditor = ({ idPrefix, onChange, schema, value }: Props) => {
  const entries = Object.entries(schema.shape);

  if (entries.length === 0) {
    return <p className="text-muted-foreground text-xs">No configuration.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map(([key, fieldSchema]) => {
        const fieldId = `${idPrefix}-${key}`;

        if (!(fieldSchema instanceof z.ZodType)) {
          return null;
        }

        return (
          <FieldRenderer
            description={fieldSchema.description}
            fieldId={fieldId}
            key={key}
            label={humanize(key)}
            onChange={(next) => {
              onChange({ ...value, [key]: next });
            }}
            schema={fieldSchema}
            value={value[key]}
          />
        );
      })}
    </div>
  );
};
