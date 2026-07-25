"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";

export type MyActiveStory = {
  id: string;
  title: string;
  status: string;
  priority: string;
  storyPoints: number | null;
  sprintId: string | null;
  sprintName: string | null;
  teamId: string | null;
  teamName: string | null;
};

export async function getMyActiveStories(): Promise<MyActiveStory[]> {
  const ctx = await requireTenantSession(await headers());

  const stories = await database.story.findMany({
    where: {
      tenantId: ctx.tenantId,
      assigneeUserId: ctx.userId,
      status: { not: "DONE" },
    },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    take: 15,
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      storyPoints: true,
      sprintId: true,
      sprint: {
        select: {
          name: true,
          status: true,
          team: { select: { id: true, name: true } },
        },
      },
    },
  });

  return stories
    .filter(
      (s) =>
        s.sprint?.status === "ACTIVE" ||
        s.sprint?.status === "PLANNED" ||
        !s.sprintId
    )
    .map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      priority: s.priority,
      storyPoints: s.storyPoints,
      sprintId: s.sprintId,
      sprintName: s.sprint?.name ?? null,
      teamId: s.sprint?.team?.id ?? null,
      teamName: s.sprint?.team?.name ?? null,
    }));
}
