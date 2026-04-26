import { tool } from "ai";
import { z } from "zod";

export const getCurrentTime = tool({
  description: "Returns the current date and time.",
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
    timezone: z.string().default("UTC").describe("IANA timezone name, e.g. 'America/Chicago'."),
  }),
});
