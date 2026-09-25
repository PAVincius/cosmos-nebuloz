"use server";

import { database } from "@repo/database";
import { clientListArgs } from "@/lib/client-queries";
import { mensagemDeErro } from "@/lib/erro-de-integracao";
import { requirePlatformStaff, SYSTEM_TENANT_ID } from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Acesso ao painel (FR-30) e observabilidade cruzada da plataforma.
 *
 * O `AccessLog` é separado do `AuditLog` de propósito: aquele registra o que se
 * FEZ num tenant; este registra o acesso ao painel em si, inclusive tentativa
 * recusada. Juntar os dois encheria a trilha de um cliente de linha de login
 * que não tem nada a ver com ele.
 *
 * Aqui só se LÊ a trilha. Quem grava é `lib/registro-de-acesso.ts`, chamado
 * pela rota de auth — nunca uma export deste arquivo: todo export de módulo
 * `"use server"` é RPC pública, e a action que gravava daqui não tinha sessão
 * nem teto.
 */

/** Quantas integrações quebradas a tela lista. A contagem é à parte. */
const LIMITE_DE_QUEBRADAS = 50;

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
  /** A causa do último sync com erro, sem credencial
   *  (`lib/erro-de-integracao.ts`). */
  mensagem: string;
};

export type SaudeDaPlataforma = {
  integracoes: IntegracaoQuebrada[];
  /** Todas as integrações com erro, contadas no banco. A lista para em
   *  `LIMITE_DE_QUEBRADAS`; o KPI "Integrações com erro" contava a lista e
   *  saturava em 50 sem dizer. */
  integracoesComErro: number;
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

/** Sem log de erro, admite-se que não há detalhe — uma causa plausível
 *  inventada mandaria o operador consertar a coisa errada. */
const SEM_DETALHE =
  "Falha registrada sem detalhe no log de sincronização. Rode um novo sync para capturar a causa.";

export async function listPlatformHealth(): Promise<Result<SaudeDaPlataforma>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    // Só o que exige atenção. A tela existe para mostrar o que está
    // quebrado; listar tudo faria o operador procurar o problema no meio do
    // que está funcionando.
    const quebradas = { status: { in: ["ERROR"] } };

    const [integracoes, integracoesComErro, acessos, eventos, tenants] =
      await Promise.all([
        database.integration.findMany({
          where: quebradas,
          orderBy: { lastSyncAt: "desc" },
          take: LIMITE_DE_QUEBRADAS,
          // NFR-1.7 — `config` e `mapping` fora do select. Credencial é
          // write-only, e aqui vale igual à aba por tenant. A mensagem do
          // log passa por `semSegredo` antes de sair daqui.
          select: {
            id: true,
            source: true,
            name: true,
            status: true,
            lastSyncAt: true,
            tenant: { select: { slug: true, name: true } },
            syncLogs: {
              where: { status: "error" },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { errors: true },
            },
          },
        }),
        database.integration.count({ where: quebradas }),
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
        // O filtro da carteira: a Home e `/clientes` dão o mesmo número.
        database.tenant.count({ where: clientListArgs().where }),
      ]);

    return {
      tenants,
      integracoesComErro,
      integracoes: integracoes.map((i) => ({
        id: i.id,
        tenantSlug: i.tenant?.slug ?? "—",
        tenantNome: i.tenant?.name ?? "—",
        source: i.source,
        name: i.name,
        status: i.status,
        ultimoSync: i.lastSyncAt ? i.lastSyncAt.toISOString() : null,
        mensagem: mensagemDeErro(i.syncLogs[0]?.errors) ?? SEM_DETALHE,
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
