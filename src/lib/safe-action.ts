import { betterAuth } from "@next-safe-action/adapter-better-auth";
import { createSafeActionClient } from "next-safe-action";

import { auth } from "./auth";

const actionClient = createSafeActionClient();

export const authClient = actionClient.use(betterAuth(auth));
