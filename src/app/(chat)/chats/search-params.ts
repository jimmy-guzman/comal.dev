import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const chatSearchParams = {
  agent: parseAsString,
};

export const chatSearchParamsCache = createSearchParamsCache(chatSearchParams);
