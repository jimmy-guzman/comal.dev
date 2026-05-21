"use client";

import type { ChartConfig } from "@/components/evilcharts/ui/chart";
import type { EvalVersionScore } from "@/lib/evals";

import {
  ActiveDot,
  Dot,
  EvilLineChart,
  Grid,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "@/components/evilcharts/charts/line-chart";

interface Props {
  trend: EvalVersionScore[];
}

const chartConfig = {
  regression: { colors: { light: ["var(--destructive)"] }, label: "regression" },
  score: { colors: { light: ["var(--primary)"] }, label: "suite score" },
} satisfies ChartConfig;

const formatScore = (value: number) => value.toFixed(2);

const toChartRow = (point: EvalVersionScore) => {
  return {
    label: `v${point.ordinal}`,
    regression: point.isRegression ? point.meanScore : null,
    score: point.meanScore,
  };
};

const listRegressions = (trend: EvalVersionScore[]) => {
  return trend.flatMap((point, index) => {
    if (!point.isRegression) return [];

    const previous = trend[index - 1];

    return [{ from: previous.meanScore, label: `v${point.ordinal}`, to: point.meanScore }];
  });
};

export const EvalTrendChart = ({ trend }: Props) => {
  if (trend.length < 2) {
    return (
      <div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
        run evals on at least two versions to see a score trend.
      </div>
    );
  }

  const data = trend.map(toChartRow);
  const regressions = listRegressions(trend);

  return (
    <div className="flex flex-col gap-3">
      <EvilLineChart className="h-72" config={chartConfig} data={data}>
        <Grid />
        <XAxis dataKey="label" />
        <YAxis domain={[0, 1]} tickCount={6} tickFormatter={formatScore} />
        <Tooltip />
        <Line dataKey="score">
          <Dot variant="border" />
          <ActiveDot variant="colored-border" />
        </Line>
        <Line dataKey="regression" lineProps={{ stroke: "transparent", tooltipType: "none" }}>
          <Dot variant="default" />
        </Line>
      </EvilLineChart>
      {regressions.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          <span className="text-destructive font-medium">
            {regressions.length} regression{regressions.length === 1 ? "" : "s"}
          </span>{" "}
          {regressions
            .map((entry) => {
              return `${entry.label} ${formatScore(entry.from)}→${formatScore(entry.to)}`;
            })
            .join(", ")}
        </p>
      ) : null}
    </div>
  );
};
