import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const toolSearchParams = {
  group: parseAsString,
  q: parseAsString.withDefault(""),
};

export const toolSearchParamsCache = createSearchParamsCache(toolSearchParams);
