import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig([
  {
    input: "https://developer.themoviedb.org/openapi/tmdb-api.json",
    output: "src/clients/tmdb",
    plugins: ["@hey-api/client-next"],
  },
  {
    input: {
      fetch: {
        headers: { "User-Agent": "comal.dev/1.0 (https://comal.dev)" },
      },
      path: "https://www.wikidata.org/w/rest.php/wikibase/v1/openapi.json",
    },
    output: "src/clients/wikidata",
    plugins: ["@hey-api/client-next"],
  },
]);
