import { anonymousClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { env } from "@/env";

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_APP_URL,
  basePath: "/auth",
  plugins: [anonymousClient(), organizationClient()],
});
