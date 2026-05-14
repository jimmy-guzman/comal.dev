"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

import type { ModelId } from "@/config/models";

import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorCost,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import { Button } from "@/components/ui/button";
import { getModelById, getModelCostLabel, MODEL_GROUPS } from "@/config/models";

interface Props {
  onValueChange: (id: ModelId) => void;
  value: string;
}

export const ChatModelPicker = ({ onValueChange, value }: Props) => {
  const [open, setOpen] = useState(false);
  const resolved = getModelById(value);
  const triggerLabel = resolved?.name ?? value;
  const triggerProvider = resolved?.provider;

  const handleSelect = (id: ModelId) => {
    onValueChange(id);
    setOpen(false);
  };

  return (
    <ModelSelector onOpenChange={setOpen} open={open}>
      <ModelSelectorTrigger asChild>
        <Button
          aria-label="select model"
          className="text-muted-foreground hover:text-foreground h-8 max-w-36 min-w-0 gap-2 px-2 font-medium"
          size="sm"
          variant="ghost"
        >
          {triggerProvider ? (
            <ModelSelectorLogo
              className="hidden size-4 shrink-0 sm:block"
              provider={triggerProvider}
            />
          ) : null}
          <span className="truncate">{triggerLabel}</span>
          <ChevronDownIcon className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </ModelSelectorTrigger>
      <ModelSelectorContent>
        <ModelSelectorInput placeholder="search models..." />
        <ModelSelectorList>
          <ModelSelectorEmpty>no models found.</ModelSelectorEmpty>
          {MODEL_GROUPS.map((group) => {
            return (
              <ModelSelectorGroup heading={group.label} key={group.provider}>
                {group.models.map((model) => {
                  const isActive = model.id === value;

                  return (
                    <ModelSelectorItem
                      data-checked={isActive}
                      key={model.id}
                      keywords={[model.name, group.label, group.provider]}
                      onSelect={() => {
                        handleSelect(model.id);
                      }}
                      value={model.id}
                    >
                      <ModelSelectorLogo provider={group.provider} />
                      <ModelSelectorName>{model.name}</ModelSelectorName>
                      <ModelSelectorCost>{getModelCostLabel(model.id)}</ModelSelectorCost>
                    </ModelSelectorItem>
                  );
                })}
              </ModelSelectorGroup>
            );
          })}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  );
};
