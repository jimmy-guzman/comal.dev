/**
 * Base URL for the Wikibase REST API on Wikidata. The generated client's spec
 * ships a placeholder `servers` URL, so every call must set `baseUrl`.
 */
export const WIKIDATA_BASE_URL = "https://www.wikidata.org/w/rest.php/wikibase";

/**
 * Wikimedia requires a descriptive User-Agent; a generic one is throttled to the
 * lowest rate-limit class or blocked outright.
 */
export const WIKIDATA_USER_AGENT = "comal.dev/1.0 (https://comal.dev)";
