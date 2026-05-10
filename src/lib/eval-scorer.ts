import type { Scorer } from "@/lib/eval-input-schema";

const levenshteinDistance = (a: string, b: string): number => {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;

  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, i) => i);

  for (let i = 1; i <= m; i++) {
    const curr = Array.from<number>({ length: n + 1 });

    curr[0] = i;

    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const deleteCost = (prev[j] ?? 0) + 1;
      const insertCost = (curr[j - 1] ?? 0) + 1;
      const replaceCost = (prev[j - 1] ?? 0) + cost;

      curr[j] = Math.min(deleteCost, insertCost, replaceCost);
    }

    prev = curr;
  }

  return prev[n] ?? 0;
};

export const scoreEval = (scorer: Scorer, output: string, expected: string): number => {
  if (scorer === "contains") {
    return output.toLowerCase().includes(expected.toLowerCase()) ? 1 : 0;
  }

  if (scorer === "exact") {
    return output.trim() === expected.trim() ? 1 : 0;
  }

  const trimmedOutput = output.trim();
  const trimmedExpected = expected.trim();
  const maxLen = Math.max(trimmedOutput.length, trimmedExpected.length);

  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(trimmedOutput, trimmedExpected);

  return 1 - distance / maxLen;
};
