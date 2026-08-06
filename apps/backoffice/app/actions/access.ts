"use server";

import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { headers } from "next/headers";
import { z } from "zod";
import { requirePlatformStaff, SYSTEM_TENANT_ID } from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Acesso ao painel (FR-30) e observabilidade cruzada da plataforma.
 *
 * O `AccessLog` é separado do `AuditLog` de propósito: aquele registra o que se
 * FEZ num tenant; este registra o acesso ao painel em si, inclusive tentativa
 * recusada. Juntar os dois encheria a trilha de um cliente de linha de login
 * que não tem nada a ver com ele.
 */

const EVENTOS = ["LOGIN", "LOGOUT", "RECUSADO"] as const;

const AcessoSchema = z.object({
  email: z.string().min(3).max(200),
  evento: z.enum(EVENTOS),
  motivo: z.string().max(300).optional(),
  userId: z.string().optional(),
});

/**
 * Registra uma passagem pelo portão de entrada.
 *
 * **Não exige sessão**, porque roda no momento em que a sessão ainda não
 * existe — inclusive quando a tentativa é recusada, que é justamente a linha
 * mais interessante da trilha.
 *
 * **Nunca lança.** Se gravar falhar, a pessoa ainda entra: auditoria que
 * bloqueia autenticação transforma um problema de log num incidente de acesso.
 * A falha vai para o logger, que é onde ela deve aparecer.
 */
export async function registrarAcesso(
  input: z.input<typeof AcessoSchema>
): Promise<void> {
  try {
    const dados = AcessoSchema.parse(input);
    const h = await headers();

    await database.accessLog.create({
      data: {
        tenantId: SYSTEM_TENANT_ID,
        userId: dados.userId ?? null,
        // Normalizado: trilha com "Ana@" e "ana@" separaria a mesma pessoa em
        // duas e cada metade pareceria ter entrado menos vezes.
        email: dados.email.trim().toLowerCase(),
        evento: dados.evento,
        motivo: dados.motivo ?? null,
        ip:
          h.get?.("x-forwarded-for")?.split(",")[0]?.trim() ??
          h.get?.("x-real-ip") ??
          null,
        userAgent: h.get?.("user-agent") ?? null,
      },
    });
  } catch (e) {
    log.error("[backoffice] falha ao registrar acesso", { error: String(e) });
  }
}

export type AcessoRow = {
  id: string;
  email: string;
  evento: string;
  motivo: string | null;
  ip: string | null;
  quando: string;
};

export type IntegracaoQuebrada = {
  id: string;
  tenantSlug: string;
  tenantNome: string;
  source: string;
  name: string;
  status: string;
  ultimoSync: string | null;
};

export type SaudeDaPlataforma = {
  integracoes: IntegracaoQuebrada[];
  acessos: AcessoRow[];
  recusas: number;
  tenants: number;
  ultimosEventos: {
    id: string;
    action: string;
    alvo: string | null;
    quando: string;
  }[];
};

export async function listPlatformHealth(): Promise<Result<SaudeDaPlataforma>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const [integracoes, acessos, eventos, tenants] = await Promise.all([
      database.integration.findMany({
        // Só o que exige atenção. A tela existe para mostrar o que está
        // quebrado; listar tudo faria o operador procurar o problema no meio
        // do que está funcionando.
        where: { status: { in: ["ERROR"] } },
        orderBy: { lastSyncAt: "desc" },
        take: 50,
        // NFR-1.7 — `config` e `mapping` fora do select. Credencial é
        // write-only, e aqui vale igual à aba por tenant.
        select: {
          id: true,
          source: true,
          name: true,
          status: true,
          lastSyncAt: true,
          tenant: { select: { slug: true, name: true } },
        },
      }),
      database.accessLog.findMany({
        where: { tenantId: SYSTEM_TENANT_ID },
        orderBy: { criadoEm: "desc" },
        take: 50,
        select: {
          id: true,
          email: true,
          evento: true,
          motivo: true,
          ip: true,
          criadoEm: true,
        },
      }),
      database.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          action: true,
          metadata: true,
          createdAt: true,
        },
      }),
      database.tenant.count({ where: { isSystem: false } }),
    ]);

    return {
      tenants,
      integracoes: integracoes.map((i) => ({
        id: i.id,
        tenantSlug: i.tenant?.slug ?? "—",
        tenantNome: i.tenant?.name ?? "—",
        source: i.source,
        name: i.name,
        status: i.status,
        ultimoSync: i.lastSyncAt ? i.lastSyncAt.toISOString() : null,
      })),
      acessos: acessos.map((a) => ({
        id: a.id,
        email: a.email,
        evento: a.evento,
        motivo: a.motivo,
        ip: a.ip,
        quando: a.criadoEm.toISOString(),
      })),
      recusas: acessos.filter((a) => a.evento === "RECUSADO").length,
      ultimosEventos: eventos.map((e) => {
        const meta = (e.metadata ?? {}) as { target?: string };
        return {
          id: e.id,
          action: e.action,
          alvo: meta.target ?? null,
          quando: e.createdAt.toISOString(),
        };
      }),
    };
  });
}
