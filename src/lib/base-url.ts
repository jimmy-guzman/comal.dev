import { env } from "@/env";

export const LOCAL_URL = "http://localhost:3000";

const withProtocol = (host: string) => {
  return host.startsWith("http") ? host : `https://${host}`;
};

export const getServerBaseUrl = () => {
  if (env.BETTER_AUTH_URL) {
    return env.BETTER_AUTH_URL;
  }

  if (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL) {
    return withProtocol(env.VERCEL_PROJECT_PRODUCTION_URL);
  }

  if (env.VERCEL_URL) {
    return withProtocol(env.VERCEL_URL);
  }

  return LOCAL_URL;
};

export const getServerProductionUrl = () => {
  if (env.VERCEL_PROJECT_PRODUCTION_URL) {
    return withProtocol(env.VERCEL_PROJECT_PRODUCTION_URL);
  }

  return env.BETTER_AUTH_URL ?? LOCAL_URL;
};
