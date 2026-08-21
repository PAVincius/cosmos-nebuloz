import "server-only";

import { database } from "@repo/database";
import { log } from "@repo/observability/log";

// ─── Security event types ────────────────────────────────────────────────────

export type SecurityAction =
  | "auth.login.success"
  | "auth.login.failure"
  | "auth.logout"
  | "auth.password.reset_requested"
  | "auth.password.reset_completed"
  | "auth.mfa.enabled"
  | "auth.mfa.disabled"
  | "auth.mfa.verified"
  | "auth.mfa.failed"
  | "auth.session.revoked"
  | "access.denied"
  | "access.role.changed"
  | "access.member.invited"
  | "access.member.removed"
  | "access.member.deprovisioned"
  | "data.export.requested"
  | "data.export.completed"
  | "data.deletion.requested"
  | "admin.tenant.created"
  | "admin.tenant.suspended"
  | "admin.impersonation.started"
  | "admin.impersonation.ended"
  | "integration.credentials.rotated"
  | "integration.connected"
  | "integration.disconnected";

export type DataAction = "created" | "updated" | "deleted" | "bulk_deleted";

type BaseAuditPayload = {
  userId?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

interface SecurityAuditPayload extends BaseAuditPayload {
  action: SecurityAction;
  targetUserId?: string;
  reason?: string;
}

interface DataAuditPayload extends BaseAuditPayload {
  tenantId: string;
  action: DataAction;
  entityType: string;
  entityId: string;
  diff?: Record<string, unknown>;
}

// ─── Audit service ───────────────────────────────────────────────────────────

/**
 * Grava uma linha do `AuditLog`.
 *
 * Cada campo vai na SUA coluna. O modelo tem `actorId`, `actorType`,
 * `metadata`, `ipAddress`, `userAgent`, `targetUserId` e `reason` — e a versão
 * anterior desta função não gravava nenhuma delas: empilhava `ipAddress`,
 * `userAgent`, `reason` e `metadata` todos dentro de `diff`.
 *
 * O efeito era silencioso e do pior tipo. `apps/app/app/api/audit/route.ts`
 * seleciona `actorId`, `actorType`, `metadata` e `ipAddress` — quatro colunas
 * que voltavam nulas em toda linha de evento de segurança, sem erro nenhum. O
 * `email` que `auth-events.ts` passa em `metadata` caía no `diff`, que aquela
 * rota nem seleciona. Uma consulta por `targetUserId` ou por `ipAddress` não
 * achava nada, e "não achou nada" é indistinguível de "não aconteceu" — que é
 * exatamente a pergunta que uma trilha de auditoria existe para responder.
 */
async function writeToDb(payload: {
  tenantId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  diff?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  targetUserId?: string;
  reason?: string;
}): Promise<void> {
  try {
    await database.auditLog.create({
      data: {
        tenantId: payload.tenantId,
        userId: payload.userId ?? null,
        // `actorId`/`actorType` são o que a rota de audit do produto lê para
        // dizer QUEM agiu. Sem eles a linha existe e não identifica ninguém.
        // "user" porque este caminho só é chamado a partir de uma sessão; ato
        // de sistema não passa por aqui.
        actorId: payload.userId ?? null,
        actorType: payload.userId ? "user" : "system",
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId,
        diff: payload.diff as object | undefined,
        metadata: payload.metadata as object | undefined,
        ipAddress: payload.ipAddress ?? null,
        userAgent: payload.userAgent ?? null,
        targetUserId: payload.targetUserId ?? null,
        reason: payload.reason ?? null,
      },
    });
  } catch (err) {
    // Non-blocking: log failure but don't crash the request
    log.error("[audit] Failed to write audit log to database", {
      error: err,
      payload,
    });
  }
}

function writeToLog(
  level: "info" | "warn",
  data: Record<string, unknown>
): void {
  log[level]("[audit]", data);
}

/**
 * Log a security event (auth, access control, admin actions).
 * Works with or without a tenantId — system-level events go to observability only.
 */
export async function logSecurityEvent(
  payload: SecurityAuditPayload
): Promise<void> {
  const logData = {
    action: payload.action,
    userId: payload.userId,
    tenantId: payload.tenantId,
    targetUserId: payload.targetUserId,
    ipAddress: payload.ipAddress,
    userAgent: payload.userAgent,
    reason: payload.reason,
    metadata: payload.metadata,
    timestamp: new Date().toISOString(),
  };

  const isFailure =
    payload.action.endsWith(".failure") ||
    payload.action.endsWith(".failed") ||
    payload.action === "access.denied";

  writeToLog(isFailure ? "warn" : "info", logData);

  // Write to database when tenantId is available
  if (payload.tenantId) {
    await writeToDb({
      tenantId: payload.tenantId,
      userId: payload.userId,
      action: payload.action,
      entityType: "SECURITY_EVENT",
      entityId: payload.targetUserId ?? payload.userId ?? "system",
      metadata: payload.metadata,
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
      targetUserId: payload.targetUserId,
      reason: payload.reason,
    });
  }
}

/**
 * Log a data mutation event (CRUD on domain entities).
 * Always requires tenantId for multi-tenant isolation.
 */
export async function logDataEvent(payload: DataAuditPayload): Promise<void> {
  writeToLog("info", {
    action: payload.action,
    entityType: payload.entityType,
    entityId: payload.entityId,
    userId: payload.userId,
    tenantId: payload.tenantId,
    timestamp: new Date().toISOString(),
  });

  await writeToDb({
    tenantId: payload.tenantId,
    userId: payload.userId,
    action: payload.action,
    entityType: payload.entityType,
    entityId: payload.entityId,
    // `diff` aqui é o antes/depois da mutação e vai mesmo em `diff`. O resto do
    // contexto tem coluna própria.
    diff: payload.diff,
    metadata: payload.metadata,
    ipAddress: payload.ipAddress,
    userAgent: payload.userAgent,
  });
}

/**
 * Log an admin action (super-admin impersonation, tenant management).
 * Always logged to observability for tamper-evident trail.
 */
export async function logAdminEvent(
  payload: SecurityAuditPayload
): Promise<void> {
  // Admin events always go to log (cannot be suppressed by DB failure)
  log.warn("[audit:admin]", {
    action: payload.action,
    userId: payload.userId,
    tenantId: payload.tenantId,
    targetUserId: payload.targetUserId,
    metadata: payload.metadata,
    timestamp: new Date().toISOString(),
  });

  if (payload.tenantId) {
    await writeToDb({
      tenantId: payload.tenantId,
      userId: payload.userId,
      action: payload.action,
      entityType: "ADMIN_EVENT",
      entityId: payload.targetUserId ?? "system",
      metadata: payload.metadata,
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
      targetUserId: payload.targetUserId,
      reason: payload.reason,
    });
  }
}
