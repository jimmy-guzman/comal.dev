import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { createWorkspaceForUser } from "@/lib/studio";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const workspace = await createWorkspaceForUser(session.user.id);
  return NextResponse.redirect(new URL(`/workspaces/${workspace.id}`, req.url));
}
