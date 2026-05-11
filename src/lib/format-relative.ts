const DIVISIONS = [
  { amount: 60, name: "seconds" },
  { amount: 60, name: "minutes" },
  { amount: 24, name: "hours" },
  { amount: 7, name: "days" },
  { amount: 4.345_24, name: "weeks" },
  { amount: 12, name: "months" },
  { amount: Number.POSITIVE_INFINITY, name: "years" },
] as const satisfies readonly { amount: number; name: Intl.RelativeTimeFormatUnit }[];

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export const formatRelative = (date: Date): string => {
  let duration = (date.getTime() - Date.now()) / 1000;

  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return relativeTimeFormatter.format(Math.round(duration), division.name);
    }

    duration /= division.amount;
  }

  return relativeTimeFormatter.format(Math.round(duration), "years");
};
