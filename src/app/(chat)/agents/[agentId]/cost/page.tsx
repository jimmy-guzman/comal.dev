import { Effect } from "effect";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AgentSpendChart } from "@/components/agent-spend-chart";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemGroup } from "@/components/ui/item";
import { appRuntime } from "@/db/service";
import { getAgentForUser } from "@/lib/agents";
import { auth } from "@/lib/auth";
import { getAgentCostRollup, getAgentSpendByDay, getEvalSuiteRunCosts } from "@/lib/cost";
import { formatMicrodollars } from "@/lib/format-cost";
import { formatRelative } from "@/lib/format-relative";

const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_CONVERSATIONS = 10;

const RANGE_OPTIONS = [
  { days: 30, label: "30 days", value: "30d" },
  { days: 90, label: "90 days", value: "90d" },
  { days: null, label: "all time", value: "all" },
] as const;

const resolveRange = (range: string | string[] | undefined) => {
  const value = typeof range === "string" ? range : undefined;
  const option = RANGE_OPTIONS.find((entry) => entry.value === value) ?? RANGE_OPTIONS[0];
  const since = option.days ? new Date(Date.now() - option.days * DAY_MS) : undefined;

  return { since, value: option.value };
};

interface Props {
  params: Promise<{ agentId: string }>;
  searchParams: Promise<{ range?: string | string[] }>;
}

export default async function AgentCostPage({ params, searchParams }: Props) {
  const { agentId } = await params;
  const { range } = await searchParams;

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const agent = await appRuntime.runPromise(
    getAgentForUser(agentId, session.user.id).pipe(
      Effect.catchTag("NotFoundError", () => Effect.succeed(null)),
    ),
  );

  if (!agent) notFound();

  const userId = session.user.id;
  const { since, value: rangeValue } = resolveRange(range);

  const [rollup, spendByDay, evalCost] = await Promise.all([
    appRuntime.runPromise(getAgentCostRollup(agentId, userId, { since })),
    appRuntime.runPromise(getAgentSpendByDay(agentId, userId, { since })),
    appRuntime.runPromise(getEvalSuiteRunCosts(agentId, userId, { since })),
  ]);

  const topConversations = rollup.byConversation.slice(0, TOP_CONVERSATIONS);

  return (
    <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">cost</h2>
          <p className="text-muted-foreground text-sm">
            spend across this agent's chats, broken down by model and conversation.
          </p>
        </div>
        <div className="flex gap-1">
          {RANGE_OPTIONS.map((option) => {
            return (
              <Button
                asChild
                key={option.value}
                size="sm"
                variant={option.value === rangeValue ? "secondary" : "ghost"}
              >
                <Link href={`/agents/${agentId}/cost?range=${option.value}`}>{option.label}</Link>
              </Button>
            );
          })}
        </div>
      </div>

      <ItemGroup className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Item className="h-full px-4 py-4" variant="outline">
          <ItemContent>
            <p className="text-muted-foreground text-xs">total spend</p>
            <p className="text-sm font-medium">{formatMicrodollars(rollup.totalMicrodollars)}</p>
          </ItemContent>
        </Item>
        <Item className="h-full px-4 py-4" variant="outline">
          <ItemContent>
            <p className="text-muted-foreground text-xs">avg cost per turn</p>
            <p className="text-sm font-medium">
              {formatMicrodollars(rollup.averagePerTurnMicrodollars)}
            </p>
          </ItemContent>
        </Item>
        <Item className="h-full px-4 py-4" variant="outline">
          <ItemContent>
            <p className="text-muted-foreground text-xs">turns</p>
            <p className="text-sm font-medium">{rollup.turnCount.toLocaleString()}</p>
          </ItemContent>
        </Item>
      </ItemGroup>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">spend over time</h2>
        <AgentSpendChart data={spendByDay} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">spend by model</h2>
        {rollup.byModel.length === 0 ? (
          <p className="text-muted-foreground text-sm">no spend in this range.</p>
        ) : (
          <div className="overflow-hidden rounded-md border">
            {rollup.byModel.map((entry) => {
              return (
                <div
                  className="flex items-center justify-between gap-4 border-b px-4 py-2.5 last:border-b-0"
                  key={entry.modelId ?? "unknown"}
                >
                  <span className="truncate text-sm">{entry.modelId ?? "unknown model"}</span>
                  <span className="font-mono text-sm">
                    {formatMicrodollars(entry.microdollars)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">top conversations by cost</h2>
        {topConversations.length === 0 ? (
          <p className="text-muted-foreground text-sm">no conversations in this range.</p>
        ) : (
          <div className="overflow-hidden rounded-md border">
            {topConversations.map((entry) => {
              return (
                <Link
                  className="hover:bg-muted/50 flex items-center justify-between gap-4 border-b px-4 py-2.5 transition-colors last:border-b-0"
                  href={`/chats/${entry.conversationId}/trace`}
                  key={entry.conversationId}
                >
                  <span className="truncate text-sm">{entry.title}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-muted-foreground text-xs">
                      {entry.turnCount} {entry.turnCount === 1 ? "turn" : "turns"}
                    </span>
                    <span className="font-mono text-sm">
                      {formatMicrodollars(entry.microdollars)}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">eval spend</h2>
        <p className="text-muted-foreground text-sm">
          {formatMicrodollars(evalCost.totalMicrodollars)} total across all eval runs in this range.
        </p>
        {evalCost.suiteRuns.length === 0 ? (
          <p className="text-muted-foreground text-sm">no eval suite runs yet.</p>
        ) : (
          <div className="overflow-hidden rounded-md border">
            {evalCost.suiteRuns.map((run) => {
              return (
                <div
                  className="flex items-center justify-between gap-4 border-b px-4 py-2.5 last:border-b-0"
                  key={run.suiteRunId}
                >
                  <span className="text-sm">{formatRelative(run.ranAt)}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-muted-foreground text-xs">
                      {run.runCount} {run.runCount === 1 ? "eval" : "evals"}
                    </span>
                    <span className="font-mono text-sm">
                      {formatMicrodollars(run.totalMicrodollars)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
