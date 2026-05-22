import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveWikidataIds } from "./resolve-ids";

const ENTITIES: Record<
  string,
  { descriptions: Record<string, string>; labels: Record<string, string> }
> = {
  P31: {
    descriptions: { en: "the class of which this subject is a member" },
    labels: { en: "instance of" },
  },
  Q5: {
    descriptions: { en: "common name of Homo sapiens" },
    labels: { en: "human" },
  },
  Q42: {
    descriptions: { en: "English science fiction writer and humourist" },
    labels: { de: "Douglas Adams", en: "Douglas Adams" },
  },
};

const jsonResponse = (body: unknown, status = 200) => {
  return Response.json(body, { status });
};

const toUrl = (input: RequestInfo | URL) => {
  if (typeof input === "string") return input;

  return input instanceof URL ? input.href : input.url;
};

const handleRequest = (url: string) => {
  const id = /\/(?:items|properties)\/([QP]\d+)/u.exec(url)?.[1];
  const entity = id ? ENTITIES[id] : undefined;

  if (!entity) {
    return jsonResponse({ code: "resource-not-found", message: "Not found" }, 404);
  }

  return jsonResponse(entity);
};

describe("resolveWikidataIds", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input) => {
      return Promise.resolve(handleRequest(toUrl(input)));
    });
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("should resolve a mix of Q-ids and P-ids to labels and descriptions", async () => {
    const result = await resolveWikidataIds({ ids: ["Q42", "P31"], language: "en" });

    expect(result.unresolved).toStrictEqual([]);
    expect(result.resolved).toStrictEqual([
      {
        description: "English science fiction writer and humourist",
        id: "Q42",
        label: "Douglas Adams",
      },
      {
        description: "the class of which this subject is a member",
        id: "P31",
        label: "instance of",
      },
    ]);
  });

  it("should fall back to English when the requested language is missing", async () => {
    const result = await resolveWikidataIds({ ids: ["Q5"], language: "fr" });

    expect(result.resolved).toStrictEqual([
      { description: "common name of Homo sapiens", id: "Q5", label: "human" },
    ]);
  });

  it("should put ids that cannot be fetched into unresolved", async () => {
    const result = await resolveWikidataIds({ ids: ["Q42", "Q99999999"], language: "en" });

    expect(result.resolved.map((entity) => entity.id)).toStrictEqual(["Q42"]);
    expect(result.unresolved).toStrictEqual(["Q99999999"]);
  });

  it("should resolve every id when the batch exceeds the concurrency window", async () => {
    const ids = Array.from({ length: 12 }, () => "Q42");

    const result = await resolveWikidataIds({ ids, language: "en" });

    expect(result.resolved).toHaveLength(12);
    expect(fetchMock).toHaveBeenCalledTimes(12);
  });
});
