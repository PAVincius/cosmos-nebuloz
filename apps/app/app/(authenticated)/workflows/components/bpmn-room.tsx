"use client";

import { Room } from "@repo/collaboration/room";
import type { ReactNode } from "react";

type BpmnRoomProps = {
  definitionId: string;
  children: ReactNode;
};

// Wraps BPMN canvas in a Liveblocks room for co-editing presence (AC-003)
export function BpmnRoom({ definitionId, children }: BpmnRoomProps) {
  return (
    <Room
      authEndpoint="/api/liveblocks-auth"
      fallback={
        <div className="flex h-full w-full items-center justify-center text-muted-foreground text-sm">
          A conectar colaboração…
        </div>
      }
      id={`bpmn:${definitionId}`}
    >
      {children}
    </Room>
  );
}
