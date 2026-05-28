import { and, eq } from "drizzle-orm";
import { Effect } from "effect";

import { account } from "@/db/schemas/auth-schema";
import { userCredential } from "@/db/schemas/credential-schema";
import { Database, runMutation, runQuery } from "@/db/service";
import { auth } from "@/lib/auth";

import type { ApiKeyProviderId, ProviderId } from "./providers";

import { decryptSecret, encryptSecret } from "./crypto";
import { credentialProviders } from "./providers";

type OAuthProviderId = Exclude<ProviderId, ApiKeyProviderId>;

export interface ApiKeyConnectionStatus {
  connectedAt: Date | null;
  displayName: string;
  docsUrl: string | undefined;
  kind: "api_key";
  providerId: ApiKeyProviderId;
  source: "env" | "user" | null;
}

export interface OAuthConnectionStatus {
  connectedAt: Date | null;
  displayName: string;
  kind: "oauth";
  providerId: OAuthProviderId;
  signInOnly: boolean;
  source: "user" | null;
}

type ConnectionStatus = ApiKeyConnectionStatus | OAuthConnectionStatus;

const toApiKeyEntry = (r: { providerId: string; updatedAt: Date }) => {
  return [r.providerId, r.updatedAt] as const;
};

const toOAuthEntry = (r: { createdAt: Date; providerId: string }) => {
  return [r.providerId, r.createdAt] as const;
};

const getOAuthAccessToken = (userId: string, providerId: ProviderId) => {
  return auth.api.getAccessToken({ body: { providerId, userId } });
};

const pickAccessToken = (result: Awaited<ReturnType<typeof getOAuthAccessToken>>) => {
  return result.accessToken;
};

const succeedNull = () => Effect.succeed(null);

const resolveOAuthToken = (userId: string, providerId: ProviderId) => {
  const fetch = () => getOAuthAccessToken(userId, providerId);

  return Effect.tryPromise(fetch).pipe(
    Effect.map(pickAccessToken),
    Effect.catchTag("UnknownException", succeedNull),
  );
};

export class Credentials extends Effect.Service<Credentials>()("Credentials", {
  accessors: true,
  effect: Effect.gen(function* () {
    const db = yield* Database;

    const getRow = (userId: string, providerId: ProviderId) => {
      return runQuery(() => {
        return db
          .select({
            encryptedKey: userCredential.encryptedKey,
            updatedAt: userCredential.updatedAt,
          })
          .from(userCredential)
          .where(and(eq(userCredential.userId, userId), eq(userCredential.providerId, providerId)))
          .limit(1);
      });
    };

    const get = Effect.fn("Credentials.get")(function* (userId: string, providerId: ProviderId) {
      yield* Effect.annotateCurrentSpan({ providerId, userId });

      const provider = credentialProviders[providerId];

      if (provider.kind === "oauth") {
        return yield* resolveOAuthToken(userId, providerId);
      }

      const rows = yield* getRow(userId, providerId);
      const row = rows.at(0);

      if (row) {
        return decryptSecret(row.encryptedKey);
      }

      return provider.getEnvFallback();
    });

    const set = Effect.fn("Credentials.set")(function* (
      userId: string,
      providerId: ProviderId,
      plaintext: string,
    ) {
      yield* Effect.annotateCurrentSpan({ providerId, userId });

      const provider = credentialProviders[providerId];

      if (provider.kind !== "api_key") {
        return yield* Effect.die(
          new Error(`Cannot set api key for non-api-key provider "${providerId}"`),
        );
      }

      const encryptedKey = encryptSecret(plaintext);

      yield* runMutation(() => {
        return db
          .insert(userCredential)
          .values({ encryptedKey, providerId, userId })
          .onConflictDoUpdate({
            set: { encryptedKey, updatedAt: new Date() },
            target: [userCredential.userId, userCredential.providerId],
          });
      });

      return { providerId };
    });

    const remove = Effect.fn("Credentials.delete")(function* (
      userId: string,
      providerId: ProviderId,
    ) {
      yield* Effect.annotateCurrentSpan({ providerId, userId });

      yield* runMutation(() => {
        return db
          .delete(userCredential)
          .where(and(eq(userCredential.userId, userId), eq(userCredential.providerId, providerId)));
      });
    });

    const list = Effect.fn("Credentials.list")(function* (userId: string) {
      yield* Effect.annotateCurrentSpan({ userId });

      const [apiKeyRows, oauthRows] = yield* Effect.all(
        [
          runQuery(() => {
            return db
              .select({
                providerId: userCredential.providerId,
                updatedAt: userCredential.updatedAt,
              })
              .from(userCredential)
              .where(eq(userCredential.userId, userId));
          }),
          runQuery(() => {
            return db
              .select({
                createdAt: account.createdAt,
                providerId: account.providerId,
              })
              .from(account)
              .where(eq(account.userId, userId));
          }),
        ],
        { concurrency: "unbounded" },
      );

      const apiKeyByProvider = new Map(apiKeyRows.map(toApiKeyEntry));
      const oauthByProvider = new Map(oauthRows.map(toOAuthEntry));

      const allIds = Object.keys(credentialProviders) as ProviderId[];

      const buildApiKeyStatus = (id: ApiKeyProviderId): ApiKeyConnectionStatus => {
        const provider = credentialProviders[id];
        const userConnectedAt = apiKeyByProvider.get(id);

        if (userConnectedAt) {
          return {
            connectedAt: userConnectedAt,
            displayName: provider.displayName,
            docsUrl: provider.docsUrl,
            kind: "api_key",
            providerId: id,
            source: "user",
          };
        }

        const envValue = provider.getEnvFallback();

        return {
          connectedAt: null,
          displayName: provider.displayName,
          docsUrl: provider.docsUrl,
          kind: "api_key",
          providerId: id,
          source: envValue ? "env" : null,
        };
      };

      const buildOAuthStatus = (id: OAuthProviderId): OAuthConnectionStatus => {
        const provider = credentialProviders[id];
        const connectedAt = oauthByProvider.get(id) ?? null;

        return {
          connectedAt,
          displayName: provider.displayName,
          kind: "oauth",
          providerId: id,
          signInOnly: provider.signInOnly,
          source: connectedAt ? "user" : null,
        };
      };

      const isApiKeyId = (id: ProviderId): id is ApiKeyProviderId => {
        return credentialProviders[id].kind === "api_key";
      };

      const statuses: ConnectionStatus[] = allIds.map((id) => {
        return isApiKeyId(id) ? buildApiKeyStatus(id) : buildOAuthStatus(id);
      });

      return statuses;
    });

    const connectedProviderIds = Effect.fn("Credentials.connectedProviderIds")(function* (
      userId: string,
    ) {
      yield* Effect.annotateCurrentSpan({ userId });

      const [apiKeyRows, oauthRows] = yield* Effect.all(
        [
          runQuery(() => {
            return db
              .selectDistinct({ providerId: userCredential.providerId })
              .from(userCredential)
              .where(eq(userCredential.userId, userId));
          }),
          runQuery(() => {
            return db
              .selectDistinct({ providerId: account.providerId })
              .from(account)
              .where(eq(account.userId, userId));
          }),
        ],
        { concurrency: "unbounded" },
      );

      const connected = new Set<string>();

      for (const r of apiKeyRows) connected.add(r.providerId);
      for (const r of oauthRows) connected.add(r.providerId);

      for (const [providerId, provider] of Object.entries(credentialProviders)) {
        if (provider.kind !== "api_key") continue;

        const envValue = provider.getEnvFallback();

        if (envValue) connected.add(providerId);
      }

      return connected;
    });

    return { connectedProviderIds, delete: remove, get, list, set };
  }),
}) {}
