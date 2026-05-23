"use client";

import { CheckCircleIcon, ChevronDownIcon, LoaderIcon, PlayIcon, XCircleIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import type { FormAssertion } from "@/components/tool-call-assertion-form";
import type { Scorer } from "@/lib/eval-input-schema";
import type { EvalRunAggregate, EvalRunSummary } from "@/lib/evals";

import { runEvalAction } from "@/actions/run-eval";
import { runEvalSuiteAction } from "@/actions/run-eval-suite";
import { ToolCallAssertionEditor } from "@/components/tool-call-assertion-editor";
import { emptyFormAssertion } from "@/components/tool-call-assertion-form";
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
import { SCORER_OPTIONS, STRING_SCORERS } from "@/lib/eval-input-schema";

const isScorer = (value: string): value is Scorer => {
  return (SCORER_OPTIONS as readonly string[]).includes(value);
};

interface EvalSelection {
  assertion: FormAssertion;
  expected?: string;
  id?: string;
  input: string;
  name: string;
  scorer: Scorer;
  trials: number;
}

interface EvalRunResult {
  aggregate?: EvalRunAggregate;
  conversationId: string;
  output: string;
  rationale?: string;
  score: number;
}

interface Props {
  agentId?: string;
  initialRuns?: EvalRunSummary[];
  isEdit: boolean;
  onChange: (next: EvalSelection[]) => void;
  subAgents: { alias: string }[];
  value: EvalSelection[];
}

const DEFAULT_INITIAL_RUNS: EvalRunSummary[] = [];

const PASS_THRESHOLD = 0.8;

const formatScore = (score: number) => score.toFixed(2);

const isLiveResult = (result: EvalRunResult | EvalRunSummary): result is EvalRunResult => {
  return "output" in result;
};

const getScore = (result: EvalRunResult | EvalRunSummary) => {
  if (isLiveResult(result)) {
    return result.aggregate ? result.aggregate.mean : result.score;
  }

  return result.lastRunAggregate ? result.lastRunAggregate.mean : result.lastRunScore;
};

const getOutput = (result: EvalRunResult | EvalRunSummary) => {
  return isLiveResult(result) ? result.output : result.lastRunOutput;
};

const getRationale = (result: EvalRunResult | EvalRunSummary) => {
  return isLiveResult(result) ? (result.rationale ?? null) : result.lastRunRationale;
};

const getAggregate = (result: EvalRunResult | EvalRunSummary) => {
  return isLiveResult(result) ? (result.aggregate ?? null) : result.lastRunAggregate;
};

const getConversationId = (result: EvalRunResult | EvalRunSummary) => {
  return isLiveResult(result) ? result.conversationId : result.lastRunConversationId;
};

const TraceLink = ({ conversationId }: { conversationId: null | string }) => {
  if (!conversationId) return null;

  return (
    <Link
      className="text-muted-foreground hover:text-foreground w-fit text-xs underline"
      href={`/chats/${conversationId}/trace`}
    >
      view trace
    </Link>
  );
};

const EvalRunBadge = ({ result }: { result: EvalRunResult | EvalRunSummary | null }) => {
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
  batchResult,
  entry,
  initialRun,
  isEdit,
  onChange,
  onRemove,
  subAgents,
}: {
  batchResult: EvalRunResult | null;
  entry: EvalSelection;
  initialRun: EvalRunSummary | null;
  isEdit: boolean;
  onChange: (next: EvalSelection) => void;
  onRemove: () => void;
  subAgents: { alias: string }[];
}) => {
  const [runResult, setRunResult] = useState<EvalRunResult | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [seenBatchResult, setSeenBatchResult] = useState(batchResult);

  if (seenBatchResult !== batchResult) {
    setSeenBatchResult(batchResult);
    setRunResult(null);
  }

  const { execute, isPending } = useAction(runEvalAction, {
    onError: ({ error }) => {
      toast.error(error.serverError ?? "failed to run eval.");
    },
    onSuccess: ({ data }) => {
      setRunResult({
        aggregate: "aggregate" in data ? data.aggregate : undefined,
        conversationId: data.conversationId,
        output: data.output,
        rationale: "rationale" in data ? data.rationale : undefined,
        score: data.score,
      });
      setIsExpanded(true);
    },
  });

  const canRun = isEdit && Boolean(entry.id);
  const result: EvalRunResult | EvalRunSummary | null = runResult ?? batchResult ?? initialRun;
  const output = result ? getOutput(result) : null;
  const rationale = result ? getRationale(result) : null;
  const aggregate = result ? getAggregate(result) : null;
  const isJudge = entry.scorer === "llm-judge";
  const isToolCall = entry.scorer === "tool-call";
  const showExpected = STRING_SCORERS.includes(entry.scorer);
  const showTrials = !isJudge && !isToolCall;

  return (
    <div className="rounded-md border p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{entry.name || "untitled eval"}</span>
          <EvalRunBadge result={result} />
          {result ? (
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
        {showExpected ? (
          <Field>
            <FieldLabel className="text-xs">expected</FieldLabel>
            <Textarea
              className="field-sizing-content min-h-16 resize-none font-mono text-xs"
              maxLength={10_000}
              onChange={(event) => {
                onChange({ ...entry, expected: event.target.value });
              }}
              placeholder="what the response should contain or match"
              value={entry.expected ?? ""}
            />
          </Field>
        ) : null}
        {isToolCall ? (
          <Field>
            <FieldLabel className="text-xs">tool-call assertion</FieldLabel>
            <ToolCallAssertionEditor
              onChange={(assertion) => {
                onChange({ ...entry, assertion });
              }}
              subAgents={subAgents}
              value={entry.assertion}
            />
          </Field>
        ) : null}
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
        {showTrials ? (
          <Field>
            <FieldLabel className="text-xs">trials</FieldLabel>
            <Input
              max={10}
              min={1}
              onChange={(event) => {
                const next = Number.parseInt(event.target.value, 10);

                onChange({
                  ...entry,
                  trials: Number.isFinite(next) ? Math.min(10, Math.max(1, next)) : 1,
                });
              }}
              step={1}
              type="number"
              value={entry.trials}
            />
          </Field>
        ) : null}
      </div>
      {result && isExpanded ? (
        <>
          <Separator className="my-3" />
          <div className="flex flex-col gap-2">
            {aggregate ? (
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">trials ({aggregate.count})</span>
                <div className="text-xs">
                  mean {formatScore(aggregate.mean)} · min {formatScore(aggregate.min)} · max{" "}
                  {formatScore(aggregate.max)}
                </div>
                <ol className="text-muted-foreground list-decimal pl-4 text-xs">
                  {aggregate.trials.map((trial) => {
                    return (
                      <li className="flex flex-col gap-1 break-words" key={trial.id}>
                        <div className="text-xs">score {formatScore(trial.score)}</div>
                        <pre className="max-h-24 overflow-y-auto font-mono whitespace-pre-wrap">
                          {trial.output}
                        </pre>
                        <TraceLink conversationId={trial.conversationId} />
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">output</span>
                {output ? (
                  <pre className="max-h-32 overflow-y-auto font-mono text-xs break-words whitespace-pre-wrap">
                    {output}
                  </pre>
                ) : (
                  <span className="text-muted-foreground text-xs">(empty)</span>
                )}
                <TraceLink conversationId={getConversationId(result)} />
              </div>
            )}
            {rationale ? (
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">rationale</span>
                <p className="text-xs break-words whitespace-pre-wrap">{rationale}</p>
              </div>
            ) : null}
            {entry.expected ? (
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">expected</span>
                <pre className="max-h-32 overflow-y-auto font-mono text-xs break-words whitespace-pre-wrap">
                  {entry.expected}
                </pre>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
};

export const AgentEvalPicker = ({
  agentId,
  initialRuns = DEFAULT_INITIAL_RUNS,
  isEdit,
  onChange,
  subAgents,
  value,
}: Props) => {
  const [batchResults, setBatchResults] = useState<Map<string, EvalRunResult>>(() => {
    return new Map();
  });

  const { execute: runAll, isPending: isRunningAll } = useAction(runEvalSuiteAction, {
    onError: ({ error }) => {
      toast.error(error.serverError ?? "failed to run evals.");
    },
    onSuccess: ({ data }) => {
      const next = new Map<string, EvalRunResult>();
      const failed: string[] = [];

      for (const item of data.results) {
        if ("error" in item) {
          failed.push(item.name);
          continue;
        }

        next.set(item.evalId, {
          aggregate: "aggregate" in item ? item.aggregate : undefined,
          conversationId: item.conversationId,
          output: item.output,
          rationale: "rationale" in item ? item.rationale : undefined,
          score: item.score,
        });
      }

      setBatchResults(next);

      if (failed.length > 0) {
        toast.error(`${failed.length} eval${failed.length === 1 ? "" : "s"} failed to run.`);
      }
    },
  });

  const handleAdd = () => {
    onChange([
      ...value,
      { assertion: emptyFormAssertion(), input: "", name: "", scorer: "contains", trials: 1 },
    ]);
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

  const hasSavedEvals = value.some((e) => e.id !== undefined);
  const canRunAll = isEdit && Boolean(agentId) && hasSavedEvals;

  return (
    <div className="flex flex-col gap-3">
      {value.map((entry, index) => {
        return (
          <EvalRow
            batchResult={entry.id ? (batchResults.get(entry.id) ?? null) : null}
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
            subAgents={subAgents}
          />
        );
      })}

      <div className="flex items-center gap-2">
        <Button onClick={handleAdd} size="sm" type="button" variant="outline">
          add eval
        </Button>
        {value.length > 0 ? <Badge variant="secondary">{value.length}</Badge> : null}
        {canRunAll ? (
          <Button
            className="ml-auto"
            disabled={isRunningAll}
            onClick={() => {
              if (agentId) runAll({ agentId });
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {isRunningAll ? (
              <LoaderIcon className="size-3 animate-spin" />
            ) : (
              <PlayIcon className="size-3" />
            )}
            run all evals
          </Button>
        ) : null}
      </div>
    </div>
  );
};
