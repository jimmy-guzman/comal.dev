/**
 * Formats an output cost (USD per 1M tokens) as a compact dollar label,
 * width-capped at 4 characters to fit beside model names in pickers.
 * Rounds to 1 decimal under $10 and to integer above, trading sub-dime
 * precision for a tighter visual budget.
 */
export const formatModelCost = (outputCostPerMillion: number): string => {
  if (!Number.isFinite(outputCostPerMillion) || outputCostPerMillion < 0) return "";

  if (outputCostPerMillion < 10) {
    return `$${(Math.round(outputCostPerMillion * 10) / 10).toString()}`;
  }

  return `$${Math.round(outputCostPerMillion).toString()}`;
};
