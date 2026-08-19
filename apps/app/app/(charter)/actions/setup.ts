"use server";

import type { CharterRole } from "@repo/database";
import { withTenantDb } from "@repo/database";
import { POLICY_SECTIONS } from "@repo/provisioning";
import {
  CHARTER_ROLE_LABEL,
  type CharterPermission,
  hasCharterPermission,
  rolesGranting,
} from "@repo/rbac";
import { requireCharterContext } from "@/lib/charter/guards";
import { type Result, safeAction } from "../../actions/_base";

// Passo a passo de montagem — FR do onboarding: uma compliance lead abrindo o
// Charter pela primeira vez não sabe por onde começar, e a ordem já existe: o
// provisionamento grava nove seções vazias, nessa ordem, no instante em que o
// tenant nasce. Ninguém escreve "usos permitidos" antes de "classificação de
// dados". O produto só nunca disse isso.
//
// Progresso é lido, nunca guardado: uma tabela de acompanhamento seria uma
// segunda fonte de verdade que diverge da primeira.

export type SetupStepId =
  | "policy.write"
  | "policy.publish"
  | "roles.assign"
  | "usecase.first"
  | "decision.first";

export type SetupStep = {
  id: SetupStepId;
  titulo: string;
  /** Por que o passo importa. Nunca onde clicar — isso o href resolve. */
  porque: string;
  estado: "feito" | "disponivel" | "bloqueado";
  /** Só no passo 1: é o único longo o bastante para alguém desistir no meio. */
  progresso?: { feito: number; total: number };
  href: string;
  /** Legível, não código: "Escreva as nove seções primeiro." */
  bloqueadoPor?: string;
  /** O papel de quem está olhando permite executar este passo? */
  podeAgir: boolean;
  /** Quando não permite: "Compliance". */
  quemPode?: string;
};

export type SetupProgress = {
  passos: SetupStep[];
  concluidos: number;
  total: number;
  /** Todos os cinco fechados — o painel se recolhe. */
  completo: boolean;
};

// Mesma fonte que o provisionamento grava — nunca um segundo 9 escrito à mão
// que pode divergir do array que `bootstrapCharter` de fato usa.
const TOTAL_SECOES = POLICY_SECTIONS.length;

/** `feito` vence `bloqueado`: dado seedado torto ou provisionamento antigo pode
 *  produzir um passo concluído com o pré-requisito ainda aberto — e um passo
 *  bloqueado que já aconteceu é o painel discutindo com o banco. */
function estadoDoPasso(
  feito: boolean,
  bloqueado: boolean
): SetupStep["estado"] {
  if (feito) {
    return "feito";
  }
  return bloqueado ? "bloqueado" : "disponivel";
}

/** Lista pt-BR dos papéis que concedem `permission`, para o "quem pode" do
 *  passo desabilitado — esconder o passo faria a pessoa achar que quebrou. */
function papeisQueConcedem(permission: CharterPermission): string {
  const labels = rolesGranting(permission).map((r) => CHARTER_ROLE_LABEL[r]);
  const last = labels.pop();
  return labels.length ? `${labels.join(", ")} ou ${last}` : (last ?? "");
}

/** `podeAgir` via matriz de permissões — vale para todo passo exceto o 3
 *  (roles.assign), que `setMemberCharterRole` decide sem consultar a matriz. */
function podeAgirPorPermissao(
  role: CharterRole,
  permission: CharterPermission
): Pick<SetupStep, "podeAgir" | "quemPode"> {
  const podeAgir = hasCharterPermission(role, permission);
  return podeAgir
    ? { podeAgir }
    : { podeAgir, quemPode: papeisQueConcedem(permission) };
}

/**
 * As cinco etapas de montagem do Charter, computadas a partir do estado real
 * do tenant — nunca de uma tabela de progresso. Roda em todo load do
 * dashboard: uma única `withTenantDb`, quatro `count` mais um `findMany` em
 * `charterPolicySection` restrito a `body` (a regra é `body.trim() !== ""`, e
 * `count` com `{ not: "" }` deixaria passar seção só de espaço).
 */
export async function getSetupProgress(): Promise<Result<SetupProgress>> {
  return await safeAction(async () => {
    const ctx = await requireCharterContext();

    const { secoesEscritas, versoes, membros, casos, decisoes } =
      await withTenantDb(ctx.tenantId, async (db) => {
        const [secoes, versoesPublicadas, membership, useCases, decisions] =
          await Promise.all([
            db.charterPolicySection.findMany({
              where: { tenantId: ctx.tenantId },
              select: { body: true },
            }),
            db.charterPolicyVersion.count({
              where: { tenantId: ctx.tenantId },
            }),
            db.charterMembership.count({ where: { tenantId: ctx.tenantId } }),
            db.charterUseCase.count({ where: { tenantId: ctx.tenantId } }),
            db.charterDecision.count({ where: { tenantId: ctx.tenantId } }),
          ]);

        return {
          secoesEscritas: secoes.filter((s) => s.body.trim() !== "").length,
          versoes: versoesPublicadas,
          membros: membership,
          casos: useCases,
          decisoes: decisions,
        };
      });

    const politicaCompleta = secoesEscritas === TOTAL_SECOES;
    const politicaPublicada = versoes > 0;
    const temCaso = casos > 0;

    const passos: SetupStep[] = [
      {
        id: "policy.write",
        titulo: "Escreva as seções da política",
        porque:
          "Sem as nove seções preenchidas não há política para publicar, nem caso de uso para avaliar contra ela.",
        estado: estadoDoPasso(politicaCompleta, false),
        progresso: { feito: secoesEscritas, total: TOTAL_SECOES },
        href: "/charter/policy",
        ...podeAgirPorPermissao(ctx.charterRole, "policy.edit"),
      },
      {
        id: "policy.publish",
        titulo: "Publique a primeira versão",
        porque:
          "Rascunho não é evidência. Só uma versão publicada pode ser citada numa decisão ou numa auditoria.",
        estado: estadoDoPasso(politicaPublicada, !politicaCompleta),
        bloqueadoPor: politicaCompleta
          ? undefined
          : "Escreva as nove seções primeiro.",
        href: "/charter/policy",
        ...podeAgirPorPermissao(ctx.charterRole, "policy.publish"),
      },
      {
        id: "roles.assign",
        titulo: "Atribua papéis de governança",
        porque:
          "Sozinho, a mesma pessoa submete e decide — o primeiro auditor que perguntar reprova.",
        // Nunca bloqueia: a montagem não pode travar esperando alguém aceitar
        // convite.
        estado: estadoDoPasso(membros > 1, false),
        href: "/charter/settings",
        // setMemberCharterRole não consulta a matriz de permissões: é a
        // permissão que distribui todas as outras, então só o papel
        // Compliance atribui papel — comparado direto, sem hasCharterPermission.
        podeAgir: ctx.charterRole === "COMPLIANCE",
        quemPode:
          ctx.charterRole === "COMPLIANCE"
            ? undefined
            : CHARTER_ROLE_LABEL.COMPLIANCE,
      },
      {
        id: "usecase.first",
        titulo: "Submeta o primeiro caso de uso",
        porque:
          "É o que a política existe para avaliar — sem um caso, ela nunca sai do papel.",
        estado: estadoDoPasso(temCaso, !politicaPublicada),
        bloqueadoPor: politicaPublicada
          ? undefined
          : "Publique a política primeiro.",
        href: "/charter/cases",
        ...podeAgirPorPermissao(ctx.charterRole, "case.submit"),
      },
      {
        id: "decision.first",
        titulo: "Decida o primeiro caso",
        porque:
          "Aprovar, restringir ou bloquear — é a decisão que vira trilha de auditoria.",
        estado: estadoDoPasso(decisoes > 0, !temCaso),
        bloqueadoPor: temCaso ? undefined : "Submeta um caso de uso primeiro.",
        href: "/charter/cases",
        ...podeAgirPorPermissao(ctx.charterRole, "case.decide"),
      },
    ];

    const concluidos = passos.filter((p) => p.estado === "feito").length;

    return {
      passos,
      concluidos,
      total: passos.length,
      completo: concluidos === passos.length,
    };
  });
}
