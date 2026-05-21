import { describe, expect, it } from "vitest";

import { deriveEvalScoreTrend } from "./evals";

describe("deriveEvalScoreTrend", () => {
  it("should return an empty array when there are no versions", () => {
    expect(deriveEvalScoreTrend([])).toStrictEqual([]);
  });

  it("should assign 1-based ordinals in input order", () => {
    const trend = deriveEvalScoreTrend([
      { meanScore: 0.4, runCount: 2, versionCreatedAt: new Date("2024-01-01"), versionId: "a" },
      { meanScore: 0.6, runCount: 2, versionCreatedAt: new Date("2024-01-02"), versionId: "b" },
      { meanScore: 0.7, runCount: 2, versionCreatedAt: new Date("2024-01-03"), versionId: "c" },
    ]);

    expect(trend.map((point) => point.ordinal)).toStrictEqual([1, 2, 3]);
  });

  it("should not flag the first version as a regression", () => {
    const trend = deriveEvalScoreTrend([
      { meanScore: 0.9, runCount: 1, versionCreatedAt: new Date("2024-01-01"), versionId: "a" },
    ]);

    expect(trend[0].isRegression).toBe(false);
  });

  it("should flag a version whose score dropped below the previous one", () => {
    const trend = deriveEvalScoreTrend([
      { meanScore: 0.8, runCount: 1, versionCreatedAt: new Date("2024-01-01"), versionId: "a" },
      { meanScore: 0.6, runCount: 1, versionCreatedAt: new Date("2024-01-02"), versionId: "b" },
      { meanScore: 0.9, runCount: 1, versionCreatedAt: new Date("2024-01-03"), versionId: "c" },
    ]);

    expect(trend.map((point) => point.isRegression)).toStrictEqual([false, true, false]);
  });

  it("should not flag an unchanged score as a regression", () => {
    const trend = deriveEvalScoreTrend([
      { meanScore: 0.7, runCount: 1, versionCreatedAt: new Date("2024-01-01"), versionId: "a" },
      { meanScore: 0.7, runCount: 1, versionCreatedAt: new Date("2024-01-02"), versionId: "b" },
    ]);

    expect(trend[1].isRegression).toBe(false);
  });
});
