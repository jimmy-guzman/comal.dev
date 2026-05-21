import type { ReactNode } from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { EvalVersionScore } from "@/lib/evals";

import { EvalTrendChart } from "./eval-trend-chart";

vi.mock("@/components/evilcharts/charts/line-chart", () => {
  return {
    ActiveDot: () => null,
    Dot: () => null,
    EvilLineChart: ({ children }: { children: ReactNode }) => {
      return <div>{children}</div>;
    },
    Grid: () => null,
    Line: () => null,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
  };
});

const makePoint = (overrides: Partial<EvalVersionScore>): EvalVersionScore => {
  return {
    isRegression: false,
    meanScore: 0.5,
    ordinal: 1,
    runCount: 1,
    versionCreatedAt: new Date("2024-01-01"),
    versionId: "version",
    ...overrides,
  };
};

describe("EvalTrendChart", () => {
  it("should show an empty state with fewer than two versions", () => {
    render(<EvalTrendChart trend={[makePoint({ ordinal: 1 })]} />);

    expect(screen.getByText(/at least two versions/i)).toBeInTheDocument();
  });

  it("should drop the empty state once there are at least two versions", () => {
    render(<EvalTrendChart trend={[makePoint({ ordinal: 1 }), makePoint({ ordinal: 2 })]} />);

    expect(screen.queryByText(/at least two versions/i)).not.toBeInTheDocument();
  });

  it("should summarise regressions with a from-to delta", () => {
    render(
      <EvalTrendChart
        trend={[
          makePoint({ meanScore: 0.8, ordinal: 1 }),
          makePoint({ isRegression: true, meanScore: 0.6, ordinal: 2 }),
        ]}
      />,
    );

    expect(screen.getByText(/1 regression/i)).toBeInTheDocument();
    expect(screen.getByText(/v2 0\.80/)).toBeInTheDocument();
  });

  it("should not render a regression summary when nothing regressed", () => {
    render(<EvalTrendChart trend={[makePoint({ ordinal: 1 }), makePoint({ ordinal: 2 })]} />);

    expect(screen.queryByText(/regression/i)).not.toBeInTheDocument();
  });
});
