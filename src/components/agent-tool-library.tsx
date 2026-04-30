"use client";

import { Settings2Icon } from "lucide-react";
import { useState } from "react";

import type { ToolSelection } from "@/lib/agent-tool-selection";

import { tools } from "@/agents/tools/registry";
import { AgentToolConfigEditor } from "@/components/agent-tool-config-editor";
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
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";

interface Props {
  onChange: (next: ToolSelection[]) => void;
  value: ToolSelection[];
}

const ALL_GROUPS = "all";

export const AgentToolLibrary = ({ onChange, value }: Props) => {
  const [activeGroup, setActiveGroup] = useState<string>(ALL_GROUPS);
  const [selectedOnly, setSelectedOnly] = useState(false);

  const enabledCount = value.filter((entry) => entry.enabled).length;

  const isEnabled = (toolId: string) => {
    return Boolean(value.find((entry) => entry.toolId === toolId)?.enabled);
  };

  const toggle = (toolId: string, enabled: boolean) => {
    onChange(
      value.map((entry) => {
        return entry.toolId === toolId ? { ...entry, enabled } : entry;
      }),
    );
  };

  const updateConfig = (toolId: string, config: Record<string, unknown>) => {
    onChange(
      value.map((entry) => {
        return entry.toolId === toolId ? { ...entry, config } : entry;
      }),
    );
  };

  const groups = tools.groups();
  const grouped = tools
    .listByGroup()
    .map(({ group, items }) => {
      const filteredItems = items.filter((tool) => {
        if (activeGroup !== ALL_GROUPS && tool.group !== activeGroup) {
          return false;
        }

        if (selectedOnly && !isEnabled(tool.id)) {
          return false;
        }

        return true;
      });

      return { group, items: filteredItems };
    })
    .filter(({ items }) => items.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          aria-pressed={activeGroup === ALL_GROUPS}
          onClick={() => {
            setActiveGroup(ALL_GROUPS);
          }}
          size="xs"
          type="button"
          variant={activeGroup === ALL_GROUPS ? "secondary" : "ghost"}
        >
          All
        </Button>
        {groups.map((group) => {
          const isActive = activeGroup === group.id;

          return (
            <Button
              aria-pressed={isActive}
              key={group.id}
              onClick={() => {
                setActiveGroup(isActive ? ALL_GROUPS : group.id);
              }}
              size="xs"
              type="button"
              variant={isActive ? "secondary" : "ghost"}
            >
              {group.label}
            </Button>
          );
        })}
        <Field className="ml-auto w-auto" orientation="horizontal">
          <FieldLabel className="text-muted-foreground text-xs" htmlFor="library-selected-only">
            Selected only
          </FieldLabel>
          <Switch
            checked={selectedOnly}
            id="library-selected-only"
            onCheckedChange={setSelectedOnly}
          />
          <Badge variant="secondary">{enabledCount}</Badge>
        </Field>
      </div>

      <Command className="bg-background border">
        <CommandInput placeholder="Search tools..." />
        <CommandList className="max-h-[420px]">
          <CommandEmpty>No tools match.</CommandEmpty>
          {grouped.map(({ group, items }) => {
            return (
              <CommandGroup heading={group.label} key={group.id}>
                {items.map((tool) => {
                  const enabled = isEnabled(tool.id);
                  const hasConfig = Object.keys(tool.configSchema.shape).length > 0;
                  const selection = value.find((entry) => {
                    return entry.toolId === tool.id;
                  });

                  return (
                    <CommandItem
                      data-checked={enabled}
                      key={tool.id}
                      keywords={[tool.description, group.label]}
                      onSelect={() => {
                        toggle(tool.id, !enabled);
                      }}
                      value={tool.name}
                    >
                      <div className="flex flex-1 flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{tool.name}</span>
                          <Badge variant="outline">{group.label}</Badge>
                        </div>
                        <span className="text-muted-foreground">{tool.description}</span>
                      </div>
                      {enabled && hasConfig && selection ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              aria-label={`Configure ${tool.name}`}
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                              onMouseDown={(event) => {
                                event.stopPropagation();
                              }}
                              size="icon-xs"
                              type="button"
                              variant="ghost"
                            >
                              <Settings2Icon />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="end"
                            className="w-80"
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                          >
                            <PopoverHeader>
                              <PopoverTitle>{tool.name}</PopoverTitle>
                            </PopoverHeader>
                            <AgentToolConfigEditor
                              idPrefix={`tool-${tool.id}`}
                              onChange={(next) => {
                                updateConfig(tool.id, next);
                              }}
                              schema={tool.configSchema}
                              value={selection.config}
                            />
                          </PopoverContent>
                        </Popover>
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            );
          })}
        </CommandList>
      </Command>
    </div>
  );
};
