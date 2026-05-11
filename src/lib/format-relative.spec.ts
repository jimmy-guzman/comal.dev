import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatRelative } from "./format-relative";

describe("formatRelative", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return seconds ago for a very recent date", () => {
    const date = new Date("2024-06-15T11:59:50Z");

    expect(formatRelative(date)).toBe("10 seconds ago");
  });

  it("should return minutes ago within the hour", () => {
    const date = new Date("2024-06-15T11:55:00Z");

    expect(formatRelative(date)).toBe("5 minutes ago");
  });

  it("should return hours ago within the day", () => {
    const date = new Date("2024-06-15T09:00:00Z");

    expect(formatRelative(date)).toBe("3 hours ago");
  });

  it("should return days ago within the week", () => {
    const date = new Date("2024-06-12T12:00:00Z");

    expect(formatRelative(date)).toBe("3 days ago");
  });

  it("should return months ago for older dates", () => {
    const date = new Date("2024-03-15T12:00:00Z");

    expect(formatRelative(date)).toBe("3 months ago");
  });

  it("should return last year for a date over a year ago", () => {
    const date = new Date("2023-06-15T12:00:00Z");

    expect(formatRelative(date)).toBe("last year");
  });

  it("should handle future dates", () => {
    const date = new Date("2024-06-15T12:05:00Z");

    expect(formatRelative(date)).toBe("in 5 minutes");
  });
});
