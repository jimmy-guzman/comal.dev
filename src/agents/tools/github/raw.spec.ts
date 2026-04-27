import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rawGitHubProvider } from "./raw";

const makeResponse = (
  body: string,
  init?: { headers?: Record<string, string>; status?: number },
) => {
  return new Response(body, {
    headers: init?.headers,
    status: init?.status ?? 200,
  });
};

describe("rawGitHubProvider.readFiles", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("should return ok entry with content for a successful single fetch", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse("export const x = 1;\n", {
        headers: { "x-git-object-id": "abc123" },
      }),
    );

    const entries = await rawGitHubProvider.readFiles([
      { owner: "vercel", path: "src/index.ts", repo: "next.js" },
    ]);

    expect(entries).toStrictEqual([
      {
        ok: true,
        path: "src/index.ts",
        result: {
          content: "export const x = 1;\n",
          sha: "abc123",
          truncated: false,
          url: "https://raw.githubusercontent.com/vercel/next.js/HEAD/src/index.ts",
        },
      },
    ]);
  });

  it("should return mixed ok and error entries without throwing on partial failure", async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse("hello", { headers: { "x-git-object-id": "sha-a" } }))
      .mockResolvedValueOnce(makeResponse("not found", { status: 404 }));

    const entries = await rawGitHubProvider.readFiles([
      { owner: "o", path: "a.ts", repo: "r" },
      { owner: "o", path: "missing.ts", repo: "r" },
    ]);

    const okEntries = entries.filter((entry) => entry.ok);
    const errorEntries = entries.filter((entry) => !entry.ok);

    expect(okEntries).toHaveLength(1);
    expect(okEntries[0]?.path).toBe("a.ts");
    expect(errorEntries).toHaveLength(1);
    expect(errorEntries[0]?.path).toBe("missing.ts");
    expect(errorEntries[0]?.error).toContain("404");
  });

  it("should resolve all entries when batch exceeds the concurrency window", async () => {
    for (let index = 0; index < 7; index += 1) {
      fetchMock.mockResolvedValueOnce(makeResponse("ok"));
    }

    const inputs = Array.from({ length: 7 }, (_, index) => {
      return { owner: "o", path: `f${index.toString()}.ts`, repo: "r" };
    });

    const entries = await rawGitHubProvider.readFiles(inputs);

    expect(entries).toHaveLength(7);
    expect(entries.every((entry) => entry.ok)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });

  it("should mark oversized responses as truncated", async () => {
    const oversized = "a".repeat(150_000);

    fetchMock.mockResolvedValueOnce(makeResponse(oversized));

    const entries = await rawGitHubProvider.readFiles([{ owner: "o", path: "big.ts", repo: "r" }]);

    const okEntries = entries.filter((entry) => entry.ok);

    expect(okEntries).toHaveLength(1);
    expect(okEntries[0]?.result.truncated).toBe(true);
    expect(okEntries[0]?.result.content.endsWith("[... truncated ...]")).toBe(true);
    expect(okEntries[0]?.result.content.length).toBeLessThan(oversized.length);
  });
});
