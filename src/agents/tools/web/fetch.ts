import type { Response } from "undici";

import { TextDecoder } from "node:util";

import { tool } from "ai";
import TurndownService from "turndown";
import { fetch } from "undici";
import { z } from "zod";

import { assertSafeUrl, getSafeDispatcher } from "./fetch-safety";
import { webFetchMeta } from "./fetch.meta";

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;
const MAX_REDIRECTS = 5;

const turndown = new TurndownService({
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  headingStyle: "atx",
  hr: "---",
});

turndown.remove(["script", "style", "meta", "link"]);

const acceptHeader = {
  html: "text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, text/markdown;q=0.7, */*;q=0.1",
  markdown:
    "text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1",
  text: "text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1",
} satisfies Record<string, string>;

const readBoundedBody = async (response: Response) => {
  const declared = response.headers.get("content-length");

  if (declared && Number.parseInt(declared, 10) > MAX_RESPONSE_SIZE) {
    throw new Error("Response too large (exceeds 5MB limit)");
  }

  const body = response.body as null | ReadableStream<Uint8Array>;
  const reader = body?.getReader();

  if (!reader) {
    return new Uint8Array(0);
  }

  const chunks: Uint8Array[] = [];

  let total = 0;

  try {
    let chunk = await reader.read();

    while (!chunk.done) {
      total += chunk.value.byteLength;

      if (total > MAX_RESPONSE_SIZE) {
        await reader.cancel();

        throw new Error("Response too large (exceeds 5MB limit)");
      }

      chunks.push(chunk.value);
      chunk = await reader.read();
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);

  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged;
};

const toText = (html: string) => {
  return html
    .replaceAll(/<script[\s\S]*?<\/script>/gi, "")
    .replaceAll(/<style[\s\S]*?<\/style>/gi, "")
    .replaceAll(/<[^>]+>/g, " ")
    .replaceAll(/\s{2,}/g, " ")
    .trim();
};

interface FetchArgs {
  format: "html" | "markdown" | "text";
  signal: AbortSignal;
  url: string;
}

const fetchWithSafeRedirects = async ({ format, signal, url }: FetchArgs) => {
  const headers = {
    Accept: acceptHeader[format],
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
  };

  let current = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = assertSafeUrl(current);
    const response = await fetch(parsed, {
      dispatcher: getSafeDispatcher(),
      headers,
      redirect: "manual",
      signal,
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");

      await response.body?.cancel();

      if (!location) {
        throw new Error(`Redirect without Location header (HTTP ${response.status.toString()})`);
      }

      if (hop === MAX_REDIRECTS) {
        throw new Error("Too many redirects");
      }

      current = new URL(location, parsed).toString();
      continue;
    }

    return response;
  }

  throw new Error("Too many redirects");
};

export const buildWebFetch = (config: unknown, _context: unknown) => {
  const { needsApproval } = webFetchMeta.configSchema.parse(config);

  return tool({
    description: needsApproval
      ? "Fetch the content of a URL and return it as markdown, plain text, or raw HTML. Always ask for user confirmation before fetching."
      : "Fetch the content of a URL and return it as markdown, plain text, or raw HTML.",
    execute: async ({ format, timeout, url }) => {
      const timeoutSeconds = timeout ?? DEFAULT_TIMEOUT_MS / 1000;
      const timeoutMs = Math.min(timeoutSeconds * 1000, MAX_TIMEOUT_MS);

      const response = await fetchWithSafeRedirects({
        format,
        signal: AbortSignal.timeout(timeoutMs),
        url,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status.toString()}: ${response.statusText}`);
      }

      const buffer = await readBoundedBody(response);
      const contentType = response.headers.get("content-type") ?? "";
      const body = new TextDecoder().decode(buffer);

      if (format === "html") return { content: body, contentType, url };

      if (format === "text") {
        return {
          content: contentType.includes("text/html") ? toText(body) : body,
          contentType,
          url,
        };
      }

      return {
        content: contentType.includes("text/html") ? turndown.turndown(body) : body,
        contentType,
        url,
      };
    },
    inputSchema: z.object({
      format: z
        .enum(["markdown", "text", "html"])
        .default("markdown")
        .describe("The format to return the content in. Defaults to markdown."),
      timeout: z
        .number()
        .positive()
        .max(120)
        .optional()
        .describe("Optional timeout in seconds (max 120). Defaults to 30."),
      url: z.string().describe("The URL to fetch. Must start with http:// or https://."),
    }),
    needsApproval,
  });
};
