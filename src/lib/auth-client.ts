import { anonymousClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  basePath: "/auth",
  plugins: [anonymousClient(), organizationClient()],
});
