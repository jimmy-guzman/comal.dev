import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig([
  {
    input: "https://developer.themoviedb.org/openapi/tmdb-api.json",
    output: "src/clients/tmdb",
    plugins: ["@hey-api/client-next"],
  },
]);
