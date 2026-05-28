import type { ProviderId } from "@/lib/credentials/providers";

export interface ToolContext {
  agentId: string;
  getCredential: (providerId: ProviderId) => Promise<null | string>;
  userId: string;
}
