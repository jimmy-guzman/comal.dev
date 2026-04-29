import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { anonymous, organization } from "better-auth/plugins";

import { db } from "@/db/client";
import * as schema from "@/db/schemas/auth-schema";
import { env } from "@/env";
import { getServerBaseUrl, getServerProductionUrl, LOCAL_URL } from "@/lib/base-url";
import { migrateAnonymousUserData } from "@/lib/chat";

const baseURL = getServerBaseUrl();
const productionURL = getServerProductionUrl();

const trustedOrigins = [...new Set([baseURL, LOCAL_URL, productionURL])];

export const auth = betterAuth({
  basePath: "/auth",
  baseURL,
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
  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
  },
  trustedOrigins,
});
