const costFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 4,
  minimumFractionDigits: 2,
  style: "currency",
});

/**
 * Formats a microdollar amount (USD x 1,000,000, the unit stored in
 * `chat_event.cost_microdollars`) as a USD string. Sub-cent turn costs keep up
 * to four fraction digits, e.g. `$0.006`, while larger totals read as `$1.50`.
 */
export const formatMicrodollars = (microdollars: number): string => {
  return costFormatter.format(microdollars / 1_000_000);
};
