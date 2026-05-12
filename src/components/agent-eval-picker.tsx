"use client";

import { CheckCircleIcon, ChevronDownIcon, LoaderIcon, PlayIcon, XCircleIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import type { Scorer } from "@/lib/eval-input-schema";

import { runEvalAction } from "@/actions/run-eval";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { SCORER_OPTIONS } from "@/lib/eval-input-schema";

const isScorer = (value: string): value is Scorer => {
  return (SCORER_OPTIONS as readonly string[]).includes(value);
};

interface EvalSelection {
  expected: string;
  id?: string;
  input: string;
  name: string;
  scorer: Scorer;
}

interface EvalRunResult {
  output: string;
  score: number;
}

interface InitialRun {
  evalId: string;
  lastRunAt: Date | null;
  lastRunOutput: null | string;
  lastRunScore: null | number;
}

interface Props {
  initialRuns?: InitialRun[];
  isEdit: boolean;
  onChange: (next: EvalSelection[]) => void;
  value: EvalSelection[];
}

const DEFAULT_INITIAL_RUNS: InitialRun[] = [];

const PASS_THRESHOLD = 0.8;

const formatScore = (score: number) => score.toFixed(2);

const getScore = (result: EvalRunResult | InitialRun) => {
  return "score" in result ? result.score : result.lastRunScore;
};

const getOutput = (result: EvalRunResult | InitialRun) => {
  return "output" in result ? result.output : result.lastRunOutput;
};

const EvalRunBadge = ({ result }: { result: EvalRunResult | InitialRun | null }) => {
  const score = result ? getScore(result) : null;

  if (score === null) {
    return (
      <Badge className="text-xs" variant="secondary">
        no runs
      </Badge>
    );
  }

  if (score >= PASS_THRESHOLD) {
    return (
      <Badge className="gap-1 text-xs" variant="secondary">
        <CheckCircleIcon className="text-success size-3" />
        pass {formatScore(score)}
      </Badge>
    );
  }

  return (
    <Badge className="gap-1 text-xs" variant="secondary">
      <XCircleIcon className="text-destructive size-3" />
      fail {formatScore(score)}
    </Badge>
  );
};

const EvalRow = ({
  entry,
  initialRun,
  isEdit,
  onChange,
  onRemove,
}: {
  entry: EvalSelection;
  initialRun: InitialRun | null;
  isEdit: boolean;
  onChange: (next: EvalSelection) => void;
  onRemove: () => void;
}) => {
  const [runResult, setRunResult] = useState<EvalRunResult | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const { execute, isPending } = useAction(runEvalAction, {
    onError: ({ error }) => {
      toast.error(error.serverError ?? "failed to run eval.");
    },
    onSuccess: ({ data }) => {
      setRunResult(data);
      setIsExpanded(true);
    },
  });

  const canRun = isEdit && Boolean(entry.id);
  const result = runResult ?? initialRun;
  const output = result ? getOutput(result) : null;

  return (
    <div className="rounded-md border p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{entry.name || "untitled eval"}</span>
          <EvalRunBadge result={result} />
          {output && isExpanded ? (
            <Button
              onClick={() => {
                setIsExpanded((v) => !v);
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              <ChevronDownIcon
                className="size-3 transition-transform duration-200 data-[open=true]:rotate-180"
                data-open={String(isExpanded)}
              />
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {canRun && entry.id ? (
            <Button
              disabled={isPending}
              onClick={() => {
                execute({ evalId: entry.id ?? "" });
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              {isPending ? (
                <LoaderIcon className="size-3 animate-spin" />
              ) : (
                <PlayIcon className="size-3" />
              )}
              run
            </Button>
          ) : null}
          <Button onClick={onRemove} size="sm" type="button" variant="ghost">
            remove
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Field>
          <FieldLabel className="text-xs">name</FieldLabel>
          <Input
            maxLength={200}
            onChange={(event) => {
              onChange({ ...entry, name: event.target.value });
            }}
            placeholder="greets the user"
            value={entry.name}
          />
        </Field>
        <Field>
          <FieldLabel className="text-xs">input</FieldLabel>
          <Textarea
            className="field-sizing-content min-h-16 resize-none font-mono text-xs"
            maxLength={10_000}
            onChange={(event) => {
              onChange({ ...entry, input: event.target.value });
            }}
            placeholder="the user message sent to the agent"
            value={entry.input}
          />
        </Field>
        <Field>
          <FieldLabel className="text-xs">expected</FieldLabel>
          <Textarea
            className="field-sizing-content min-h-16 resize-none font-mono text-xs"
            maxLength={10_000}
            onChange={(event) => {
              onChange({ ...entry, expected: event.target.value });
            }}
            placeholder="what the response should contain or match"
            value={entry.expected}
          />
        </Field>
        <Field>
          <FieldLabel className="text-xs">scorer</FieldLabel>
          <Select
            onValueChange={(v: string) => {
              if (isScorer(v)) onChange({ ...entry, scorer: v });
            }}
            value={entry.scorer}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCORER_OPTIONS.map((option) => {
                return (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {output ? (
        <>
          <Separator className="my-3" />
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">output</span>
              <pre className="max-h-32 overflow-y-auto font-mono text-xs break-words whitespace-pre-wrap">
                {output}
              </pre>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">expected</span>
              <pre className="max-h-32 overflow-y-auto font-mono text-xs break-words whitespace-pre-wrap">
                {entry.expected}
              </pre>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export const AgentEvalPicker = ({
  initialRuns = DEFAULT_INITIAL_RUNS,
  isEdit,
  onChange,
  value,
}: Props) => {
  const handleAdd = () => {
    onChange([...value, { expected: "", input: "", name: "", scorer: "contains" }]);
  };

  const handleChange = (index: number, next: EvalSelection) => {
    onChange(value.map((e, i) => (i === index ? next : e)));
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const getInitialRun = (evalId: string | undefined) => {
    if (!evalId) return null;

    return initialRuns.find((r) => r.evalId === evalId) ?? null;
  };

  return (
    <div className="flex flex-col gap-3">
      {value.map((entry, index) => {
        return (
          <EvalRow
            entry={entry}
            initialRun={getInitialRun(entry.id)}
            isEdit={isEdit}
            key={entry.id ?? index}
            onChange={(next) => {
              handleChange(index, next);
            }}
            onRemove={() => {
              handleRemove(index);
            }}
          />
        );
      })}

      <div className="flex items-center gap-2">
        <Button onClick={handleAdd} size="sm" type="button" variant="outline">
          add eval
        </Button>
        {value.length > 0 ? <Badge variant="secondary">{value.length}</Badge> : null}
      </div>
    </div>
  );
};
