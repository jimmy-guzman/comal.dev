const dayFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const dayWithYearFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

/**
 * Formats an ISO day string (`YYYY-MM-DD`) as a compact label, e.g. `May 21`.
 * The year is dropped when it matches the current year and kept otherwise
 * (`May 21, 2024`), so a chart spanning multiple years keeps unique,
 * unambiguous ticks. The value is read in UTC because `YYYY-MM-DD` carries no
 * time or zone, and a local parse of its midnight would shift the day. Returns
 * an empty string for input that does not parse.
 */
/**
 * Formats an ISO timestamp as "Month Day, Year", e.g. `May 23, 2026`.
 * Always includes the year. Returns an empty string for input that does not parse.
 */
export const formatBuildDate = (isoTimestamp: string): string => {
  const time = Date.parse(isoTimestamp);

  if (Number.isNaN(time)) return "";

  return dayWithYearFormatter.format(new Date(time));
};

export const formatDayLabel = (isoDay: string): string => {
  const time = Date.parse(isoDay);

  if (Number.isNaN(time)) return "";

  const date = new Date(time);
  const isCurrentYear = date.getUTCFullYear() === new Date().getUTCFullYear();

  return isCurrentYear ? dayFormatter.format(date) : dayWithYearFormatter.format(date);
};
