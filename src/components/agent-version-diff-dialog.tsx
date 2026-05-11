"use client";

import { ChevronDownIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ReactDiffViewer from "react-diff-viewer-continued";
import { toast } from "sonner";

import type { AgentVersionRow } from "@/lib/agents";

import { revertAgentVersionAction } from "@/actions/revert-agent-version";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatRelative } from "@/lib/format-relative";

interface Props {
  agentId: string;
  defaultBaseId: string;
  defaultTargetId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  versions: AgentVersionRow[];
}

interface VersionPickerProps {
  disabledId: string;
  label: string;
  onChange: (id: string) => void;
  value: string;
  versions: AgentVersionRow[];
}

const VersionPicker = ({ disabledId, label, onChange, value, versions }: VersionPickerProps) => {
  const [open, setOpen] = useState(false);
  const selected = versions.find((v) => v.id === value);

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button className="h-7 gap-1.5 text-xs" size="sm" variant="outline">
            <span>{selected ? formatRelative(selected.createdAt) : "select version"}</span>
            <ChevronDownIcon className="size-3 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-0">
          <Command>
            <CommandInput placeholder="search versions..." />
            <CommandList>
              <CommandEmpty>no versions found.</CommandEmpty>
              <CommandGroup>
                {versions.map((v) => {
                  return (
                    <CommandItem
                      data-checked={v.id === value}
                      disabled={v.id === disabledId}
                      key={v.id}
                      onSelect={() => {
                        onChange(v.id);
                        setOpen(false);
                      }}
                      value={v.id}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span>{formatRelative(v.createdAt)}</span>
                        <span className="text-muted-foreground text-xs">{v.creatorName}</span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export const AgentVersionDiffDialog = ({
  agentId,
  defaultBaseId,
  defaultTargetId,
  onOpenChange,
  open,
  versions,
}: Props) => {
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const [baseId, setBaseId] = useState(defaultBaseId);
  const [targetId, setTargetId] = useState(defaultTargetId);

  const base = versions.find((v) => v.id === baseId);
  const target = versions.find((v) => v.id === targetId);

  const { execute: revert, isPending } = useAction(revertAgentVersionAction, {
    onError: ({ error }) => {
      toast.error(error.serverError ?? "failed to revert agent.");
    },
    onSuccess: () => {
      toast.success("reverted to selected version.");
      onOpenChange(false);
      router.refresh();
    },
  });

  const modelChanged = Boolean(base) && Boolean(target) && base?.modelId !== target?.modelId;

  const toolsAdded =
    base && target
      ? target.tools.filter((t) => {
          return !base.tools.some((bt) => bt.toolId === t.toolId);
        })
      : [];

  const toolsRemoved =
    base && target
      ? base.tools.filter((t) => {
          return !target.tools.some((tt) => tt.toolId === t.toolId);
        })
      : [];

  const subAgentsAdded =
    base && target
      ? target.subAgents.filter((s) => {
          return !base.subAgents.some((bs) => bs.childAgentId === s.childAgentId);
        })
      : [];

  const subAgentsRemoved =
    base && target
      ? base.subAgents.filter((s) => {
          return !target.subAgents.some((ts) => {
            return ts.childAgentId === s.childAgentId;
          });
        })
      : [];

  const hasMetadataChanges =
    modelChanged ||
    toolsAdded.length > 0 ||
    toolsRemoved.length > 0 ||
    subAgentsAdded.length > 0 ||
    subAgentsRemoved.length > 0;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-4 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>compare versions</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-4">
          <VersionPicker
            disabledId={targetId}
            label="base"
            onChange={setBaseId}
            value={baseId}
            versions={versions}
          />
          <VersionPicker
            disabledId={baseId}
            label="target"
            onChange={setTargetId}
            value={targetId}
            versions={versions}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {base && target ? (
            <div className="flex flex-col gap-4">
              <div className="overflow-auto text-xs">
                <ReactDiffViewer
                  newValue={target.systemPrompt}
                  oldValue={base.systemPrompt}
                  splitView
                  useDarkTheme={resolvedTheme === "dark"}
                />
              </div>

              {hasMetadataChanges ? (
                <div className="flex flex-col gap-1.5">
                  {modelChanged ? (
                    <p className="text-xs">
                      <span className="text-muted-foreground">model</span>{" "}
                      <span className="line-through opacity-60">{base.modelId}</span>
                      {" → "}
                      <span>{target.modelId}</span>
                    </p>
                  ) : null}

                  {toolsAdded.map((t) => {
                    return (
                      <p className="text-success text-xs" key={t.toolId}>
                        + tool {t.toolId}
                      </p>
                    );
                  })}

                  {toolsRemoved.map((t) => {
                    return (
                      <p className="text-destructive text-xs" key={t.toolId}>
                        - tool {t.toolId}
                      </p>
                    );
                  })}

                  {subAgentsAdded.map((s) => {
                    return (
                      <p className="text-success text-xs" key={s.childAgentId}>
                        + sub-agent {s.alias}
                      </p>
                    );
                  })}

                  {subAgentsRemoved.map((s) => {
                    return (
                      <p className="text-destructive text-xs" key={s.childAgentId}>
                        - sub-agent {s.alias}
                      </p>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">select two versions to compare.</p>
          )}
        </div>

        <DialogFooter>
          <Button
            disabled={isPending || !target}
            onClick={() => {
              if (target) revert({ agentId, versionId: target.id });
            }}
            size="sm"
            variant="outline"
          >
            {isPending ? "reverting..." : "revert to target"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
