"use client";


import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface OwnedAgent {
  id: string;
  name: string;
}

interface SubAgentSelection {
  alias: string;
  childAgentId: string;
  descriptionOverride: string;
}

interface Props {
  currentAgentId?: string;
  onChange: (next: SubAgentSelection[]) => void;
  ownedAgents: OwnedAgent[];
  value: SubAgentSelection[];
}

const slugify = (name: string) => {
  return (
    name
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-+|-+$/g, "")
      .slice(0, 32) || "agent"
  );
};

const AddSubagentPopover = ({
  onAdd,
  ownedAgents,
  selectedIds,
}: {
  onAdd: (agent: OwnedAgent) => void;
  ownedAgents: OwnedAgent[];
  selectedIds: Set<string>;
}) => {
  const [open, setOpen] = useState(false);

  const available = ownedAgents.filter((a) => !selectedIds.has(a.id));

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button size="sm" type="button" variant="outline">
          add sub-agent
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder="search agents..." />
          <CommandList>
            <CommandEmpty>no agents available.</CommandEmpty>
            <CommandGroup>
              {available.map((agent) => {
                return (
                  <CommandItem
                    key={agent.id}
                    onSelect={() => {
                      onAdd(agent);
                      setOpen(false);
                    }}
                    value={agent.name}
                  >
                    {agent.name}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const SubAgentRow = ({
  aliasError,
  entry,
  name,
  onChange,
  onRemove,
}: {
  aliasError?: string;
  entry: SubAgentSelection;
  name: string;
  onChange: (next: SubAgentSelection) => void;
  onRemove: () => void;
}) => {
  const isAliasInvalid = Boolean(aliasError);

  return (
    <div className="rounded-md border p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{name}</span>
        <Button onClick={onRemove} size="sm" type="button" variant="ghost">
          remove
        </Button>
      </div>
      <div className="flex flex-col gap-3">
        <Field data-invalid={isAliasInvalid || undefined}>
          <FieldLabel className="text-xs">alias</FieldLabel>
          <FieldDescription className="text-xs">
            how the parent agent refers to this sub-agent. letters, numbers, hyphens, and
            underscores only.
          </FieldDescription>
          <Input
            aria-invalid={isAliasInvalid || undefined}
            className="font-mono text-xs"
            maxLength={32}
            onBlur={() => {
              onChange({ ...entry, alias: entry.alias.trim() });
            }}
            onChange={(event) => {
              onChange({ ...entry, alias: event.target.value });
            }}
            value={entry.alias}
          />
          {isAliasInvalid ? <FieldError errors={[{ message: aliasError ?? "" }]} /> : null}
        </Field>
        <Field>
          <FieldLabel className="text-xs">description override</FieldLabel>
          <FieldDescription className="text-xs">
            replaces the sub-agent's description when the parent chooses which tool to call.
            optional.
          </FieldDescription>
          <Input
            className="text-xs"
            maxLength={1024}
            onChange={(event) => {
              onChange({ ...entry, descriptionOverride: event.target.value });
            }}
            placeholder={`Delegate a task to the "${name}" sub-agent.`}
            value={entry.descriptionOverride}
          />
        </Field>
      </div>
    </div>
  );
};

export const AgentSubagentPicker = ({ currentAgentId, onChange, ownedAgents, value }: Props) => {
  const selectedIds = new Set(value.map((e) => e.childAgentId));

  const candidateAgents = ownedAgents.filter((a) => a.id !== currentAgentId);

  const nameFor = (childAgentId: string) => {
    return ownedAgents.find((a) => a.id === childAgentId)?.name ?? childAgentId;
  };

  const handleAdd = (agent: OwnedAgent) => {
    onChange([
      ...value,
      { alias: slugify(agent.name), childAgentId: agent.id, descriptionOverride: "" },
    ]);
  };

  const handleChange = (childAgentId: string, next: SubAgentSelection) => {
    onChange(value.map((e) => (e.childAgentId === childAgentId ? next : e)));
  };

  const handleRemove = (childAgentId: string) => {
    onChange(value.filter((e) => e.childAgentId !== childAgentId));
  };

  const aliasCounts = value.reduce<Record<string, number>>((acc, e) => {
    const key = e.alias.toLowerCase();

    return { ...acc, [key]: (acc[key] ?? 0) + 1 };
  }, {});

  const getAliasError = (entry: SubAgentSelection) => {
    const alias = entry.alias.trim();

    if (alias.length === 0) {
      return "alias is required.";
    }

    if (!/^[\w-]+$/.test(alias)) {
      return "alias may only contain letters, numbers, hyphens, and underscores.";
    }

    if ((aliasCounts[alias.toLowerCase()] ?? 0) > 1) {
      return "duplicate sub-agent alias.";
    }

    return undefined;
  };

  return (
    <div className={cn("flex flex-col gap-3")}>
      {value.length > 0 ? (
        <Alert>
          <AlertDescription>
            Tools that require approval will run automatically when an agent is invoked here as a
            sub-agent.
          </AlertDescription>
        </Alert>
      ) : null}

      {value.map((entry) => {
        return (
          <SubAgentRow
            aliasError={getAliasError(entry)}
            entry={entry}
            key={entry.childAgentId}
            name={nameFor(entry.childAgentId)}
            onChange={(next) => {
              handleChange(entry.childAgentId, next);
            }}
            onRemove={() => {
              handleRemove(entry.childAgentId);
            }}
          />
        );
      })}

      <div className="flex items-center gap-2">
        <AddSubagentPopover
          onAdd={handleAdd}
          ownedAgents={candidateAgents.filter((a) => !selectedIds.has(a.id))}
          selectedIds={selectedIds}
        />
        {value.length > 0 ? <Badge variant="secondary">{value.length}</Badge> : null}
      </div>
    </div>
  );
};
