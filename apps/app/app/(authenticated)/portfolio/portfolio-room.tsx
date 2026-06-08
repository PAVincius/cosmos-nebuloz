"use client";

import { Room } from "@repo/collaboration/room";
import type { ReactNode } from "react";
import { getUsers } from "@/app/actions/users/get";

export function PortfolioRoom({
  orgId,
  children,
}: {
  orgId: string;
  children: ReactNode;
}) {
  return (
    <Room
      authEndpoint="/api/collaboration/auth"
      fallback={
        <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
          A ligar à sala colaborativa…
        </div>
      }
      id={`${orgId}:portfolio-kanban`}
      resolveUsers={async ({ userIds }) => {
        const result = await getUsers(userIds);
        return "data" in result ? result.data : [];
      }}
    >
      {children}
    </Room>
  );
}
