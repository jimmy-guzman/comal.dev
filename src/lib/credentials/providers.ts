import { env } from "@/env";

interface OAuthProviderDefinition {
  displayName: string;
  docsUrl?: string;
  exposeOnConnections: boolean;
  kind: "oauth";
  signInOnly?: boolean;
}

interface ApiKeyProviderDefinition {
  displayName: string;
  docsUrl?: string;
  exposeOnConnections: boolean;
  getEnvFallback: () => null | string;
  kind: "api_key";
}

export type ProviderDefinition = ApiKeyProviderDefinition | OAuthProviderDefinition;

export const credentialProviders = {
  github: {
    displayName: "GitHub",
    exposeOnConnections: true,
    kind: "oauth",
    signInOnly: true,
  },
  openrouter: {
    displayName: "OpenRouter",
    docsUrl: "https://openrouter.ai/docs/api-reference/authentication",
    exposeOnConnections: true,
    getEnvFallback: () => env.OPENROUTER_API_KEY,
    kind: "api_key",
  },
  tavily: {
    displayName: "Tavily",
    docsUrl: "https://docs.tavily.com/welcome",
    exposeOnConnections: true,
    getEnvFallback: () => env.TAVILY_API_KEY,
    kind: "api_key",
  },
  tmdb: {
    displayName: "TMDB",
    docsUrl: "https://developer.themoviedb.org/docs/getting-started",
    exposeOnConnections: true,
    getEnvFallback: () => env.TMDB_READ_ACCESS_TOKEN,
    kind: "api_key",
  },
} as const satisfies Record<string, ProviderDefinition>;

export type ProviderId = keyof typeof credentialProviders;
