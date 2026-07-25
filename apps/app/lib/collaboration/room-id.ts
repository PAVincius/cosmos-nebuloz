const VALID_SURFACES = new Set([
  "program-board",
  "pi-planning-board",
  "pi-kanban",
  "sprint-board",
  "retro",
  "bpmn-canvas",
  "portfolio-kanban",
  "solution-board",
  "org-presence",
]);

const ROOM_PATTERN = /^[a-z0-9_-]+:[a-z0-9-]+:[a-z0-9_-]+$/i;

export type RoomIdValidation =
  | { valid: true; orgId: string; surface: string; entityId: string }
  | { valid: false; reason: string };

export function validateRoomId(room: string): RoomIdValidation {
  if (!ROOM_PATTERN.test(room)) {
    return {
      valid: false,
      reason: "Room ID must match {orgId}:{surface}:{entityId}",
    };
  }

  const parts = room.split(":");
  if (parts.length !== 3) {
    return {
      valid: false,
      reason: "Room ID must have exactly 3 colon-separated parts",
    };
  }

  const [orgId, surface, entityId] = parts as [string, string, string];

  if (!VALID_SURFACES.has(surface.toLowerCase())) {
    return {
      valid: false,
      reason: `Invalid surface '${surface}'. Allowed: ${[...VALID_SURFACES].join(", ")}`,
    };
  }

  return { valid: true, orgId, surface, entityId };
}
