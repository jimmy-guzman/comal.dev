import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import { env } from "@/env";

export const db = drizzle({ connection: env.DATABASE_URL, ws });
