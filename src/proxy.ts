import type { NextRequest } from "next/server";

import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (session) {
    return NextResponse.next();
  }

  const result = await auth.api.signInAnonymous({
    asResponse: true,
    headers: request.headers,
  });

  const setCookies = result.headers.getSetCookie();

  if (setCookies.length === 0) {
    return NextResponse.next();
  }

  const cookieValue = setCookies
    .map((entry) => entry.split(";")[0])
    .filter(Boolean)
    .join("; ");

  const forwardedHeaders = new Headers(request.headers);
  const existingCookie = forwardedHeaders.get("cookie");

  forwardedHeaders.set(
    "cookie",
    existingCookie ? `${existingCookie}; ${cookieValue}` : cookieValue,
  );

  const response = NextResponse.next({ request: { headers: forwardedHeaders } });

  for (const entry of setCookies) {
    response.headers.append("set-cookie", entry);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|auth|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|mascot.svg).*)",
  ],
};
