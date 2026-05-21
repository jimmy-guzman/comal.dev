import { describe, expect, it } from "vitest";

import { formatMicrodollars } from "./format-cost";

describe("formatMicrodollars", () => {
  it("should render zero with two fraction digits", () => {
    expect(formatMicrodollars(0)).toBe("$0.00");
  });

  it("should keep extra precision for a sub-cent turn cost", () => {
    expect(formatMicrodollars(6000)).toBe("$0.006");
  });

  it("should render a multi-dollar total with two fraction digits", () => {
    expect(formatMicrodollars(1_500_000)).toBe("$1.50");
  });

  it("should cap precision at four fraction digits", () => {
    expect(formatMicrodollars(12_345_678)).toBe("$12.3457");
  });
});
