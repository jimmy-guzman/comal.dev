"use client";

import type { ChartConfig } from "@/components/evilcharts/ui/chart";
import type { AgentSpendPoint } from "@/lib/cost";

import {
  ActiveDot,
  Dot,
  EvilLineChart,
  Grid,
  Line,
  XAxis,
  YAxis,
} from "@/components/evilcharts/charts/line-chart";
import { ChartTooltip, ChartTooltipContent } from "@/components/evilcharts/ui/tooltip";
import { formatMicrodollars } from "@/lib/format-cost";
import { formatDayLabel } from "@/lib/format-date";

interface Props {
  data: AgentSpendPoint[];
}

const chartConfig = {
  spend: { colors: { light: ["var(--primary)"] }, label: "spend" },
} satisfies ChartConfig;

const toChartRow = (point: AgentSpendPoint) => {
  return { date: point.date, spend: point.microdollars };
};

const formatCostTick = (value: unknown) => {
  return typeof value === "number" ? formatMicrodollars(value) : "";
};

const formatDateTick = (value: unknown) => {
  return typeof value === "string" ? formatDayLabel(value) : "";
};

const formatTooltipValue = (value: unknown) => {
  return (
    <span className="text-foreground font-mono font-medium tabular-nums">
      {typeof value === "number" ? formatMicrodollars(value) : ""}
    </span>
  );
};

export const AgentSpendChart = ({ data }: Props) => {
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
        no spend recorded in this range.
      </div>
    );
  }

  const rows = data.map(toChartRow);

  return (
    <EvilLineChart className="h-72" config={chartConfig} data={rows}>
      <Grid />
      <XAxis dataKey="date" tickFormatter={formatDateTick} />
      <YAxis tickFormatter={formatCostTick} />
      <ChartTooltip content={<ChartTooltipContent formatter={formatTooltipValue} />} />
      <Line dataKey="spend">
        <Dot variant="border" />
        <ActiveDot variant="colored-border" />
      </Line>
    </EvilLineChart>
  );
};
