import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { StudioShell } from "@/components/studio/studio-shell";
import { auth } from "@/lib/auth";
import { getWorkspaceForUserById, listWorkspaceMessagesForUser } from "@/lib/studio";

type WorkspacePageProps = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { workspaceId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    notFound();
  }

  const workspace = await getWorkspaceForUserById(session.user.id, workspaceId);

  if (!workspace) {
    notFound();
  }

  const initialMessages = await listWorkspaceMessagesForUser(session.user.id, workspaceId);

  if (initialMessages === null) {
    notFound();
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <StudioShell initialMessages={initialMessages} workspaceId={workspace.id} />
    </main>
  );
}
