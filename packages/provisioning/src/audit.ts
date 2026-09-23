export type AuditDiff = [field: string, before: string, after: string][];

export type PlatformAuditEntry = {
  tenantId: string;
  actorUserId: string;
  actorName?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  /** Alvo legível: "vanta-saude · CHARTER". */
  target: string;
  note?: string;
  diff?: AuditDiff;
  /** `false` quando quem age é o próprio cliente — o autocadastro do app usa
   *  `provisionTenant` também. Omitido é staff: todo outro chamador é.
   *  ponytail: opcional com padrão staff; obrigatório quando surgir o segundo
   *  caminho de autosserviço. */
  platformStaff?: boolean;
};

/** Sintaxe de método pelo mesmo motivo do `ModuleDb`: bivariância deixa o
 *  client real do Prisma e o objeto falso do teste caberem no mesmo tipo. */
export type AuditWriter = {
  auditLog: { create(args: { data: unknown }): Promise<unknown> };
};

/** Ato de staff registrado no tenant do CLIENTE, não no tenant interno: quem
 *  audita a conta do cliente procura pela conta do cliente. O `platformStaff`
 *  é o que separa esses atos dos do próprio cliente na leitura. */
export async function logPlatformAudit(
  db: AuditWriter,
  entry: PlatformAuditEntry
): Promise<void> {
  await db.auditLog.create({
    data: {
      tenantId: entry.tenantId,
      userId: entry.actorUserId,
      actorId: entry.actorUserId,
      actorType: "user",
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      diff: entry.diff ?? null,
      metadata: {
        target: entry.target,
        note: entry.note ?? null,
        actorName: entry.actorName ?? null,
        platformStaff: entry.platformStaff ?? true,
      },
    },
  });
}
