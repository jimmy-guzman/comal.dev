import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatDayLabel } from "./format-date";

describe("formatDayLabel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should drop the year for a day in the current year", () => {
    expect(formatDayLabel("2026-05-21")).toBe("May 21");
  });

  it("should keep the year for a day in a different year", () => {
    expect(formatDayLabel("2024-05-21")).toBe("May 21, 2024");
  });

  it("should return an empty string for input that does not parse", () => {
    expect(formatDayLabel("not-a-date")).toBe("");
  });
});
