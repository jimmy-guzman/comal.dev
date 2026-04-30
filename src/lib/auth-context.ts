import { Context, Effect, Layer } from "effect";

import { auth } from "./auth";
import { UnauthorizedError } from "./errors";

type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

interface AuthContext {
  session: Session["session"];
  user: Session["user"];
  userId: string;
}

export class Auth extends Context.Tag("Auth")<Auth, AuthContext>() {}

const loadAuth = (requestHeaders: Headers) => {
  return Effect.tryPromise({
    catch: () => new UnauthorizedError(),
    try: () => auth.api.getSession({ headers: requestHeaders }),
  }).pipe(
    Effect.flatMap((session) => {
      if (!session?.user) return Effect.fail(new UnauthorizedError());

      return Effect.succeed({
        session: session.session,
        user: session.user,
        userId: session.user.id,
      });
    }),
  );
};

export const AuthLive = (requestHeaders: Headers) => {
  return Layer.effect(Auth, loadAuth(requestHeaders));
};
