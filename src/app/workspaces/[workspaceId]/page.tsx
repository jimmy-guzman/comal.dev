import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { StudioShell } from "@/components/studio/studio-shell";
import { auth } from "@/lib/auth";
import {
  getWorkspaceForUserById,
  getWorkspaceSpecForUser,
  listWorkspaceMessagesForUser,
} from "@/lib/studio";

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

  const [initialMessages, initialSpec] = await Promise.all([
    listWorkspaceMessagesForUser(session.user.id, workspaceId),
    getWorkspaceSpecForUser(session.user.id, workspaceId),
  ]);

  if (initialMessages === null || initialSpec === null) {
    notFound();
  }

  return (
    <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <StudioShell
        initialMessages={initialMessages}
        initialSpec={{
          content: initialSpec.content,
          revisionNumber: initialSpec.revisionNumber,
          canEdit: initialSpec.canEdit,
        }}
        workspaceId={workspace.id}
      />
    </main>
  );
}
