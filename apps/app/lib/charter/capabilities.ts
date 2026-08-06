import "server-only";
import { withTenantDb } from "@repo/database";
import { CHARTER_ENTITY_TYPES } from "@/app/(charter)/actions/audit.constants";
import { severidade } from "@/lib/charter/risk-matrix";
import { scoreLabel } from "@/lib/charter/rules";

/**
 * Catálogo do que o Charter consegue **provar**.
 *
 * A cobertura de uma exigência não guarda o texto da evidência; ela aponta para
 * uma capacidade, e a capacidade busca a evidência no banco a cada leitura.
 * `POLICY_ATTESTATION` não responde "sim" — responde "37 aceites registrados,
 * o mais recente em 12/07".
 *
 * Mora em código, e não em tabela, porque catálogo em banco vira ficção: alguém
 * cadastra capacidade que o código não tem e o mapa mente para o comprador.
 *
 * A proteção contra campo removido do schema é `capabilities.test.ts` **mais**
 * `tsc --noEmit` — não o teste sozinho. O teste, com banco stub, garante que
 * cada `evidencia()` roda e devolve o formato certo; quem confirma que
 * `version`, `changeCount`, `personName` etc. realmente existem no schema é o
 * `tsc`, compilando contra o Prisma Client gerado. No CI (`ci.yml`), o job
 * `typecheck` roda esse `tsc` sem `continue-on-error` — quebra de verdade se
 * um campo sumir — e `build` só roda depois de `typecheck` passar (`needs:`),
 * então a mudança não chega a um run verde. Rodar só `vitest` localmente não
 * pega nome de campo errado.
 */
export type Evidencia = { total: number; amostra: string[]; href?: string };

export type Capability = {
  id: string;
  label: string;
  evidencia: (tenantId: string) => Promise<Evidencia>;
};

export const CAPABILITIES: readonly Capability[] = [
  {
    id: "POLICY_VERSIONING",
    label: "Versionamento de política com diff e histórico",
    evidencia: (tenantId) =>
      withTenantDb(tenantId, async (db) => {
        const total = await db.charterPolicyVersion.count({
          where: { tenantId },
        });
        const rows = await db.charterPolicyVersion.findMany({
          where: { tenantId },
          orderBy: { publishedAt: "desc" },
          take: 3,
          select: { version: true, changeCount: true },
        });
        return {
          total,
          amostra: rows.map((r) => `v${r.version} · ${r.changeCount} mudanças`),
          href: "/charter/policy",
        };
      }),
  },
  {
    id: "POLICY_ATTESTATION",
    label: "Aceite individual de política, com revalidação por versão",
    evidencia: (tenantId) =>
      withTenantDb(tenantId, async (db) => {
        const total = await db.charterAcknowledgment.count({
          where: { tenantId, status: "ACKNOWLEDGED" },
        });
        const rows = await db.charterAcknowledgment.findMany({
          where: { tenantId, status: "ACKNOWLEDGED" },
          orderBy: { acknowledgedAt: "desc" },
          take: 3,
          select: { personName: true, acknowledgedAt: true },
        });
        return {
          total,
          amostra: rows.map(
            (r) =>
              `${r.personName} · ${r.acknowledgedAt?.toLocaleDateString("pt-BR") ?? "—"}`
          ),
          href: "/charter/onboarding",
        };
      }),
  },
  {
    id: "DECISION_RECORD",
    label: "Decisão com aprovador, data, condicionantes e justificativa",
    evidencia: (tenantId) =>
      withTenantDb(tenantId, async (db) => {
        const total = await db.charterDecision.count({ where: { tenantId } });
        const rows = await db.charterDecision.findMany({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: { outcome: true, conditions: true, createdAt: true },
        });
        return {
          total,
          amostra: rows.map(
            (r) => `${r.outcome} · ${r.conditions.length} condicionantes`
          ),
          href: "/charter/cases",
        };
      }),
  },
  {
    id: "VENDOR_TIER",
    label: "Fornecedor classificado como aprovado, restrito ou bloqueado",
    evidencia: (tenantId) =>
      withTenantDb(tenantId, async (db) => {
        const total = await db.charterVendor.count({ where: { tenantId } });
        const rows = await db.charterVendor.findMany({
          where: { tenantId },
          orderBy: { name: "asc" },
          take: 3,
          select: { name: true, tier: true },
        });
        return {
          total,
          amostra: rows.map((r) => `${r.name} · ${r.tier}`),
          href: "/charter/vendors",
        };
      }),
  },
  {
    id: "POLICY_LINK",
    label: "Política vinculada a caso de uso e fornecedor",
    evidencia: (tenantId) =>
      withTenantDb(tenantId, async (db) => {
        const total = await db.charterPolicyLink.count({ where: { tenantId } });
        const rows = await db.charterPolicyLink.findMany({
          where: { tenantId },
          take: 3,
          select: { alvoTipo: true, alvoId: true },
        });
        return {
          total,
          amostra: rows.map((r) => `${r.alvoTipo} · ${r.alvoId}`),
          href: "/charter/policy",
        };
      }),
  },
  {
    id: "RISK_SCORING",
    // Corrigido na review final: a versão anterior prometia "impacto ×
    // probabilidade em 7 dimensões", mas nenhuma tela escreve nos campos
    // prob* (Task 2 criou a coluna, ninguém ainda a captura) — todo caso
    // carrega probabilidade default 1, e severidade(impacto, 1) === impacto.
    // 7 dimensões continua verdadeiro (CharterUseCase tem sete categorias de
    // risco, todas preenchidas pelo intake/decisão reais); "× probabilidade"
    // não é, então saiu do rótulo até a UI de fato capturar esse eixo — ver
    // lib/charter/risk-matrix.ts, mantido pronto para esse dia.
    label: "Risco pontuado por impacto em 7 dimensões",
    evidencia: (tenantId) =>
      withTenantDb(tenantId, async (db) => {
        const total = await db.charterUseCase.count({ where: { tenantId } });
        const rows = await db.charterUseCase.findMany({
          where: { tenantId },
          orderBy: { code: "asc" },
          take: 3,
          select: { code: true, riskPrivacy: true, probPrivacy: true },
        });
        return {
          total,
          // scoreLabel() (lib/charter/rules.ts) — nunca nivel()
          // (risk-matrix.ts): são duas tabelas de limiares diferentes (16/9/4
          // vs 15/9/4) e só uma é a que o resto do Charter (tela de risco,
          // caso de uso) mostra ao cliente. Um mapa que fala a palavra errada
          // de severidade para o comprador é o defeito que a review final
          // achou aqui.
          amostra: rows.map(
            (r) =>
              `${r.code} · privacidade ${scoreLabel(severidade(r.riskPrivacy, r.probPrivacy))}`
          ),
          href: "/charter/risk",
        };
      }),
  },
  {
    id: "AUDIT_EXPORT",
    label: "Trilha de auditoria append-only, exportável",
    evidencia: (tenantId) =>
      withTenantDb(tenantId, async (db) => {
        // auditLog é compartilhada com o resto da plataforma (system.prisma) —
        // sem o filtro de entityType, total/amostra incluiriam PI Planning,
        // backoffice etc., e a única capacidade que responde "existe trilha
        // de auditoria" responderia com número contaminado por outro produto.
        const where = {
          tenantId,
          entityType: { in: CHARTER_ENTITY_TYPES },
        };
        const total = await db.auditLog.count({ where });
        const rows = await db.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: 3,
          select: { action: true, createdAt: true },
        });
        return {
          total,
          amostra: rows.map(
            (r) => `${r.action} · ${r.createdAt.toLocaleDateString("pt-BR")}`
          ),
          href: "/charter/audit",
        };
      }),
  },
] as const;

export type CapabilityId = (typeof CAPABILITIES)[number]["id"];

export function getCapability(id: string): Capability | undefined {
  return CAPABILITIES.find((c) => c.id === id);
}
