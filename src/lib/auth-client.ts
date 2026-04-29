import { anonymousClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { getClientBaseUrl } from "@/lib/base-url";

export const authClient = createAuthClient({
  basePath: "/auth",
  baseURL: getClientBaseUrl(),
  plugins: [anonymousClient(), organizationClient()],
});
