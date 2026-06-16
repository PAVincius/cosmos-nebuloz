import { currentUser, getOrgId } from "@repo/auth/server";
import { authenticateRoom } from "@repo/collaboration/auth";
import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { validateRoomId } from "@/lib/collaboration/room-id";

const WRITE_ROLES = new Set(["ADMIN", "STE", "RTE", "SM", "PO", "DEV"]);

const COLORS = [
  "var(--color-red-500)",
  "var(--color-orange-500)",
  "var(--color-amber-500)",
  "var(--color-yellow-500)",
  "var(--color-lime-500)",
  "var(--color-green-500)",
  "var(--color-emerald-500)",
  "var(--color-teal-500)",
  "var(--color-cyan-500)",
  "var(--color-sky-500)",
  "var(--color-blue-500)",
  "var(--color-indigo-500)",
  "var(--color-violet-500)",
  "var(--color-purple-500)",
  "var(--color-fuchsia-500)",
  "var(--color-pink-500)",
  "var(--color-rose-500)",
];

function randomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)] ?? COLORS[0];
}

function logCrossTenantAttempt(actorId: string, room: string): void {
  database.auditLog
    .create({
      data: {
        tenantId: "unknown",
        action: "collaboration.cross_tenant_attempt",
        actorId,
        actorType: "user",
        metadata: { room },
      },
    })
    .catch((err) => {
      log.error("[collaboration/auth] audit log write failed", err);
    });
}

export async function POST(req: Request): Promise<Response> {
  const [user, tenantId] = await Promise.all([currentUser(), getOrgId()]);
  if (!(user && tenantId)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { room?: string };
  const room = body.room ?? "";

  // AC-003: validate room ID format
  const roomValidation = validateRoomId(room);
  if (!roomValidation.valid) {
    return Response.json({ error: roomValidation.reason }, { status: 400 });
  }

  // AC-004: room must be scoped to caller's tenant (cross-tenant rejection)
  if (roomValidation.orgId !== tenantId) {
    logCrossTenantAttempt(user.id, room);
    return Response.json(
      { error: "Cross-tenant access denied" },
      { status: 403 }
    );
  }

  // AC-003: look up role to determine write permissions
  const member = await database.tenantMember.findFirst({
    where: { tenantId, userId: user.id },
    select: { role: true },
  });
  const role = member?.role ?? "MEMBER";
  const canWrite = WRITE_ROLES.has(role);

  return authenticateRoom({
    userId: user.id,
    room,
    canWrite,
    userInfo: {
      name: user.name ?? user.email,
      avatar: user.image ?? undefined,
      color: randomColor(),
    },
  });
}
