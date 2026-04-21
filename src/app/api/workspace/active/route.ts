import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getOrCreateWorkspaceForUser } from "@/lib/studio";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const activeWorkspace = await getOrCreateWorkspaceForUser(session.user.id);

  return Response.json({
    organizationId: activeWorkspace.organizationId,
    workspaceId: activeWorkspace.id,
    title: activeWorkspace.title,
  });
}
