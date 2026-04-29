import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { anonymous, organization } from "better-auth/plugins";

import { db } from "@/db/client";
import * as schema from "@/db/schemas/auth-schema";
import { env } from "@/env";
import { getServerBaseUrl, getServerProductionUrl, LOCAL_URL } from "@/lib/base-url";
import { migrateAnonymousUserData } from "@/lib/chat";

const productionURL = getServerProductionUrl();

const resolveTrustedOrigins = (request?: Request) => {
  const host = request?.headers.get("host");
  const proto = request?.headers.get("x-forwarded-proto") ?? "https";
  const fromRequest = host ? `${proto}://${host}` : undefined;

  return [...new Set([LOCAL_URL, productionURL, fromRequest].filter(Boolean) as string[])];
};

export const auth = betterAuth({
  basePath: "/auth",
  baseURL: getServerBaseUrl(),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  plugins: [
    nextCookies(),
    organization({
      allowUserToCreateOrganization: false,
      creatorRole: "owner",
    }),
    anonymous({
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        await migrateAnonymousUserData({
          anonymousUserId: anonymousUser.user.id,
          newUserId: newUser.user.id,
        });
      },
    }),
  ],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
  },
  trustedOrigins: resolveTrustedOrigins,
});
