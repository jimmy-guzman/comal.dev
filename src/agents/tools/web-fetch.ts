import { tool } from "ai";
import TurndownService from "turndown";
import { z } from "zod";

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;

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

const toText = (html: string) => {
  return html
    .replaceAll(/<script[\s\S]*?<\/script>/gi, "")
    .replaceAll(/<style[\s\S]*?<\/style>/gi, "")
    .replaceAll(/<[^>]+>/g, " ")
    .replaceAll(/\s{2,}/g, " ")
    .trim();
};

interface WebFetchOptions {
  needsApproval?: boolean;
}

export const createWebFetch = ({ needsApproval = true }: WebFetchOptions = {}) => {
  return tool({
    description: needsApproval
      ? "Fetch the content of a URL and return it as markdown, plain text, or raw HTML. Always ask for user confirmation before fetching."
      : "Fetch the content of a URL and return it as markdown, plain text, or raw HTML.",
    execute: async ({ format, timeout, url }) => {
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        throw new Error("URL must start with http:// or https://");
      }

      const timeoutSeconds = timeout ?? DEFAULT_TIMEOUT_MS / 1000;
      const timeoutMs = Math.min(timeoutSeconds * 1000, MAX_TIMEOUT_MS);

      const response = await fetch(url, {
        headers: {
          Accept: acceptHeader[format],
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status.toString()}: ${response.statusText}`);
      }

      const contentLength = response.headers.get("content-length");

      if (contentLength && Number.parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
        throw new Error("Response too large (exceeds 5MB limit)");
      }

      const buffer = await response.arrayBuffer();

      if (buffer.byteLength > MAX_RESPONSE_SIZE) {
        throw new Error("Response too large (exceeds 5MB limit)");
      }

      const contentType = response.headers.get("content-type") ?? "";
      const { TextDecoder } = await import("node:util");
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
