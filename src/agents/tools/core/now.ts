import { tool } from "ai";
import { z } from "zod";

const coreNow = tool({
  description:
    "Get the current date, time, day of the week, or timezone-aware 'now'. Call this for any question that depends on the current moment, including 'what time is it', 'what's today's date', 'what day of the week is it', 'how many days until X', 'is it past 5pm', or any scheduling and time-relative reasoning. Also call this before answering questions involving 'recent', 'latest', 'still', 'current', or 'now'. The agent needs to know today's date to reason about recency against its training data. The agent does not otherwise have access to real-time clock data and must not guess.",
  execute: ({ timezone }) => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "long",
      timeZone: timezone,
    });

    const now = new Date();

    return Promise.resolve({
      formatted: formatter.format(now),
      iso: now.toISOString(),
      timezone,
    });
  },
  inputSchema: z.object({
    timezone: z
      .string()
      .default("UTC")
      .describe(
        "IANA timezone name, e.g. 'America/Chicago', 'Europe/London', 'Asia/Tokyo'. Infer from the user's stated location, prior messages, or phrases like 'my time'. Pass 'UTC' only when no timezone can be reasonably inferred. When falling back to UTC, acknowledge this in the response.",
      ),
  }),
});

export const buildCoreNow = (_config: unknown, _context: unknown) => {
  return coreNow;
};
