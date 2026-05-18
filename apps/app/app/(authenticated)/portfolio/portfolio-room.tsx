"use client";

import { Room } from "@repo/collaboration/room";
import { getUsers } from "@/app/actions/users/get";
import type { ReactNode } from "react";

export function PortfolioRoom({
  orgId,
  children,
}: {
  orgId: string;
  children: ReactNode;
}) {
  return (
    <Room
      id={`portfolio-kanban-${orgId}`}
      authEndpoint="/api/collaboration/auth"
      fallback={
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          A ligar à sala colaborativa…
        </div>
      }
      resolveUsers={async ({ userIds }) => {
        const result = await getUsers(userIds);
        return "data" in result ? result.data : [];
      }}
    >
      {children}
    </Room>
  );
}
