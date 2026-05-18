"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import Fuse from "fuse.js";
import { headers } from "next/headers";

export const searchUsers = async (
  query: string
): Promise<{ data: string[] } | { error: unknown }> => {
  try {
    const ctx = await requireTenantSession(await headers());

    const memberships = await database.tenantMember.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      take: 100,
    });

    const users = memberships.map((m) => ({
      id: m.userId,
      name: m.user.name ?? m.user.email,
      imageUrl: m.user.image,
    }));

    const fuse = new Fuse(users, {
      keys: ["name"],
      minMatchCharLength: 1,
      threshold: 0.3,
    });

    const results = fuse.search(query);
    return { data: results.map((r) => r.item.id) };
  } catch (error) {
    return { error };
  }
};
