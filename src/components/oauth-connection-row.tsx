import type { OAuthConnectionStatus } from "@/lib/credentials/service";

import { Badge } from "@/components/ui/badge";

interface OAuthConnectionRowProps {
  isSignIn: boolean;
  status: OAuthConnectionStatus;
}

export const OAuthConnectionRow = ({ isSignIn, status }: OAuthConnectionRowProps) => {
  const connected = status.source === "user";

  return (
    <div className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-medium">{status.displayName.toLowerCase()}</h3>
        <Badge variant={connected ? "default" : "secondary"}>
          {connected ? (isSignIn ? "sign-in" : "connected") : "not connected"}
        </Badge>
      </div>
      <p className="text-muted-foreground text-xs">
        oauth providers land in a follow-up. for now this row is informational.
      </p>
    </div>
  );
};
