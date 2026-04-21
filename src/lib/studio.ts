import type { UIMessage } from "ai";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { maxBy } from "es-toolkit";
import { nanoid } from "nanoid";

import { db } from "@/db/client";
import { member, organization } from "@/db/schemas/auth-schema";
import {
  workspace,
  workspaceChatMessage,
  workspaceSpec,
  workspaceSpecRevision,
} from "@/db/schemas/studio-schema";

const initialSpec = `openapi: 3.1.0
info:
  title: Untitled API
  version: 0.1.0
paths: {}
`;

async function getOrCreatePersonalOrganization(userId: string) {
  const existingMembership = await db
    .select({
      organizationId: member.organizationId,
    })
    .from(member)
    .where(eq(member.userId, userId))
    .orderBy(desc(member.createdAt))
    .limit(1);

  const organizationId = existingMembership[0]?.organizationId;

  if (organizationId) {
    return organizationId;
  }

  const newOrganizationId = nanoid();
  const now = new Date();
  const slug = `personal-${newOrganizationId.slice(0, 8)}`;

  await db.insert(organization).values({
    id: newOrganizationId,
    name: "Personal",
    slug,
    createdAt: now,
  });

  await db.insert(member).values({
    id: nanoid(),
    organizationId: newOrganizationId,
    userId,
    role: "owner",
    createdAt: now,
  });

  return newOrganizationId;
}

export async function getOrCreateWorkspaceForUser(userId: string) {
  const organizationId = await getOrCreatePersonalOrganization(userId);

  const existingWorkspace = await db
    .select()
    .from(workspace)
    .where(eq(workspace.organizationId, organizationId))
    .orderBy(desc(workspace.updatedAt))
    .limit(1);

  const latestWorkspace = existingWorkspace[0];

  if (latestWorkspace) {
    return latestWorkspace;
  }

  const workspaceId = nanoid();
  const now = new Date();

  await db.insert(workspace).values({
    id: workspaceId,
    organizationId,
    title: "Untitled API",
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(workspaceSpec).values({
    workspaceId,
    format: "openapi-yaml",
    content: initialSpec,
    revisionNumber: 0,
    updatedByUserId: userId,
    updatedAt: now,
  });

  const createdWorkspace = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, workspaceId))
    .limit(1);

  if (!createdWorkspace[0]) {
    throw new Error("Failed to create workspace.");
  }

  return createdWorkspace[0];
}

export async function createWorkspaceForUser(userId: string) {
  const organizationId = await getOrCreatePersonalOrganization(userId);
  const workspaceId = nanoid();
  const now = new Date();

  await db.insert(workspace).values({
    id: workspaceId,
    organizationId,
    title: "Untitled API",
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(workspaceSpec).values({
    workspaceId,
    format: "openapi-yaml",
    content: initialSpec,
    revisionNumber: 0,
    updatedByUserId: userId,
    updatedAt: now,
  });

  const createdWorkspace = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, workspaceId))
    .limit(1);

  if (!createdWorkspace[0]) {
    throw new Error("Failed to create workspace.");
  }

  return createdWorkspace[0];
}

export async function listRecentWorkspacesForUser(userId: string) {
  return db
    .select({
      id: workspace.id,
      title: workspace.title,
      updatedAt: workspace.updatedAt,
    })
    .from(workspace)
    .innerJoin(
      member,
      and(eq(member.organizationId, workspace.organizationId), eq(member.userId, userId)),
    )
    .orderBy(desc(workspace.updatedAt))
    .limit(8);
}

export async function getWorkspaceForUserById(userId: string, workspaceId: string) {
  const [row] = await db
    .select({
      id: workspace.id,
      organizationId: workspace.organizationId,
      title: workspace.title,
      updatedAt: workspace.updatedAt,
    })
    .from(workspace)
    .innerJoin(
      member,
      and(eq(member.organizationId, workspace.organizationId), eq(member.userId, userId)),
    )
    .where(eq(workspace.id, workspaceId))
    .limit(1);

  return row ?? null;
}

export async function listWorkspaceMessagesForUser(userId: string, workspaceId: string) {
  const access = await assertWorkspaceAccess(userId, workspaceId);

  if (!access) {
    return null;
  }

  const rows = await db
    .select({
      id: workspaceChatMessage.id,
      role: workspaceChatMessage.role,
      partsJson: workspaceChatMessage.partsJson,
      createdAt: workspaceChatMessage.createdAt,
    })
    .from(workspaceChatMessage)
    .where(eq(workspaceChatMessage.workspaceId, workspaceId))
    .orderBy(asc(workspaceChatMessage.createdAt));

  const messages = rows.map((row) => ({
    id: row.id,
    role: row.role,
    parts: Array.isArray(row.partsJson) ? row.partsJson : [],
  }));

  return messages;
}

async function assertWorkspaceAccess(userId: string, workspaceId: string) {
  const record = await db
    .select({
      workspaceId: workspace.id,
      organizationId: workspace.organizationId,
      role: member.role,
    })
    .from(workspace)
    .innerJoin(
      member,
      and(eq(member.organizationId, workspace.organizationId), eq(member.userId, userId)),
    )
    .where(eq(workspace.id, workspaceId))
    .limit(1);

  return record[0] ?? null;
}

export async function assertWorkspaceWriteAccess(userId: string, workspaceId: string) {
  const record = await assertWorkspaceAccess(userId, workspaceId);

  if (!record) {
    return null;
  }

  if (record.role === "viewer") {
    return null;
  }

  return record;
}

export async function getWorkspaceSpecForUser(userId: string, workspaceId: string) {
  const [row] = await db
    .select({
      content: workspaceSpec.content,
      revisionNumber: workspaceSpec.revisionNumber,
      format: workspaceSpec.format,
      role: member.role,
    })
    .from(workspaceSpec)
    .innerJoin(workspace, eq(workspaceSpec.workspaceId, workspace.id))
    .innerJoin(
      member,
      and(eq(member.organizationId, workspace.organizationId), eq(member.userId, userId)),
    )
    .where(eq(workspace.id, workspaceId))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    content: row.content,
    revisionNumber: row.revisionNumber,
    format: row.format,
    canEdit: row.role !== "viewer",
  };
}

type UpdateWorkspaceSpecResult =
  | { ok: true; revisionNumber: number }
  | { ok: false; kind: "not_found" | "forbidden" | "conflict" };

export async function updateWorkspaceSpecForUser({
  userId,
  workspaceId,
  content,
  expectedRevisionNumber,
  changeSource = "editor",
  messageId = null,
}: {
  userId: string;
  workspaceId: string;
  content: string;
  expectedRevisionNumber: number;
  changeSource?: "chat" | "editor";
  messageId?: string | null;
}): Promise<UpdateWorkspaceSpecResult> {
  const access = await assertWorkspaceAccess(userId, workspaceId);

  if (!access) {
    return { ok: false, kind: "not_found" };
  }

  if (access.role === "viewer") {
    return { ok: false, kind: "forbidden" };
  }

  const [updated] = await db
    .update(workspaceSpec)
    .set({
      content,
      updatedByUserId: userId,
      updatedAt: new Date(),
      revisionNumber: sql`${workspaceSpec.revisionNumber} + 1`,
    })
    .where(
      and(
        eq(workspaceSpec.workspaceId, workspaceId),
        eq(workspaceSpec.revisionNumber, expectedRevisionNumber),
      ),
    )
    .returning({
      revisionNumber: workspaceSpec.revisionNumber,
      content: workspaceSpec.content,
    });

  if (!updated) {
    return { ok: false, kind: "conflict" };
  }

  await db.insert(workspaceSpecRevision).values({
    id: nanoid(),
    workspaceId,
    revisionNumber: updated.revisionNumber,
    content: updated.content,
    changeSource,
    messageId: messageId ?? null,
    createdByUserId: userId,
    createdAt: new Date(),
  });

  await db.update(workspace).set({ updatedAt: new Date() }).where(eq(workspace.id, workspaceId));

  return { ok: true, revisionNumber: updated.revisionNumber };
}

export async function insertWorkspaceChatMessage({
  id,
  workspaceId,
  role,
  parts,
  modelId,
  createdByUserId,
}: {
  id?: string;
  workspaceId: string;
  role: UIMessage["role"];
  parts: UIMessage["parts"];
  modelId?: string;
  createdByUserId?: string | null;
}) {
  const normalizedId = id?.trim();

  await db.insert(workspaceChatMessage).values({
    id: normalizedId && normalizedId.length > 0 ? normalizedId : nanoid(),
    workspaceId,
    role,
    partsJson: parts,
    modelId: modelId ?? null,
    createdByUserId: createdByUserId ?? null,
    createdAt: new Date(),
  });
}

const roleRank = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
} as const;

const getRoleRank = (role: string) => {
  switch (role) {
    case "viewer":
      return roleRank.viewer;
    case "member":
      return roleRank.member;
    case "admin":
      return roleRank.admin;
    case "owner":
      return roleRank.owner;
    default:
      return -1;
  }
};

export async function migrateAnonymousUserData({
  anonymousUserId,
  newUserId,
}: {
  anonymousUserId: string;
  newUserId: string;
}) {
  if (anonymousUserId === newUserId) {
    return;
  }

  const memberships = await db.select().from(member).where(eq(member.userId, anonymousUserId));

  for (const membership of memberships) {
    const existingNewUserMembership = await db
      .select()
      .from(member)
      .where(
        and(eq(member.organizationId, membership.organizationId), eq(member.userId, newUserId)),
      )
      .limit(1);

    const targetMembership = existingNewUserMembership[0];

    if (!targetMembership) {
      await db.update(member).set({ userId: newUserId }).where(eq(member.id, membership.id));
      continue;
    }

    const winningRole = maxBy([membership.role, targetMembership.role], (role) =>
      getRoleRank(role),
    );

    if (winningRole === membership.role && membership.role !== targetMembership.role) {
      await db
        .update(member)
        .set({ role: membership.role })
        .where(eq(member.id, targetMembership.id));
    }

    await db.delete(member).where(eq(member.id, membership.id));
  }

  await db
    .update(workspace)
    .set({ createdByUserId: newUserId })
    .where(eq(workspace.createdByUserId, anonymousUserId));

  await db
    .update(workspaceSpec)
    .set({ updatedByUserId: newUserId })
    .where(eq(workspaceSpec.updatedByUserId, anonymousUserId));

  await db
    .update(workspaceSpecRevision)
    .set({ createdByUserId: newUserId })
    .where(eq(workspaceSpecRevision.createdByUserId, anonymousUserId));

  await db
    .update(workspaceChatMessage)
    .set({ createdByUserId: newUserId })
    .where(eq(workspaceChatMessage.createdByUserId, anonymousUserId));
}
