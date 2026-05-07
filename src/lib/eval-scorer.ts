type Scorer = "contains" | "exact";

export const scoreEval = (scorer: Scorer, output: string, expected: string): 0 | 1 => {
  if (scorer === "contains") {
    return output.toLowerCase().includes(expected.toLowerCase()) ? 1 : 0;
  }

  return output.trim() === expected.trim() ? 1 : 0;
};
