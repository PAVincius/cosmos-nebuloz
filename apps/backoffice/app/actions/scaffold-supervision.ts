"use server";

import type { ScaffoldPhaseState } from "@repo/database";
import { platformDb } from "@repo/provisioning";
import { requirePlatformStaff, StaffAuthError } from "@/lib/guard";
import { janela, listagem } from "@/lib/paginacao";
import { type Result, safeAction } from "@/lib/safe-action";

// Fila de supervisão do Scaffold — S-08, SN-06.
//
// Esta é a única superfície do produto que atravessa organizações, e é por isso
// que ela vive AQUI e não em `apps/app`. A ADR-0013 fez de `platformDb` a porta
// única de leitura cross-tenant, importável só por `packages/provisioning` e
// por este app — e um teste em `apps/app` falha se alguém tentar importá-la de
// lá. Ver `specs/002-scaffold-adoption/research.md` §R4.
//
// O requisito inteiro está em SN-06: a fila expõe METADADO DE GATE suficiente
// para triagem — trilha, org, fase, idade, status de critérios — e NUNCA os
// artefatos do cliente por trás deles.
//
// A defesa está na CONSULTA, não na projeção. Buscar o artefato e descartá-lo
// depois deixaria o dado passar pela memória deste processo, e a primeira
// refatoração distraída o devolveria à tela.

/** Dias da janela de observação da Fase 4 — SG-06. Espelha
 *  `apps/app/lib/scaffold/phases.ts`; duplicar uma constante é mais barato que
 *  fazer o back-office importar do app do cliente. */
const OBSERVATION_WINDOW_DAYS = 30;

const DAY_MS = 86_400_000;

/** Estados que exigem atenção da consultora. `OPEN` fica de fora de propósito:
 *  fase em andamento é trabalho do cliente, não fila de ninguém. */
const ATTENTION_STATES: ScaffoldPhaseState[] = [
  "GATE_READY",
  "BLOCKED",
  "OBSERVING",
];

export type QueueKind = "sign-off" | "blocked" | "observing";

/**
 * O que a fila entrega. Este shape É o requisito.
 *
 * Nenhum campo carrega conteúdo do cliente: `criteriaMet`/`criteriaTotal` são
 * contagem, não enunciado; `processName` fica de fora porque descreve a
 * operação do cliente, e o código da trilha basta para triagem.
 */
export type QueueEntry = {
  phaseInstanceId: string;
  trackId: string;
  trackCode: string;
  orgName: string;
  phase: string;
  ageDays: number;
  ageLabel: string;
  criteriaMet: number;
  criteriaTotal: number;
  kind: QueueKind;
};

const KIND_TO_STATE: Record<QueueKind, ScaffoldPhaseState> = {
  blocked: "BLOCKED",
  observing: "OBSERVING",
  "sign-off": "GATE_READY",
};

function kindOf(state: string): QueueKind {
  if (state === "BLOCKED") {
    return "blocked";
  }
  if (state === "OBSERVING") {
    return "observing";
  }
  return "sign-off";
}

function daysSince(d: Date | null): number {
  if (!d) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / DAY_MS));
}

export async function listGateQueue(input: {
  kind?: QueueKind;
}): Promise<Result<QueueEntry[]>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    // Tipado: `string[]` aqui quebra a inferência do `select` inteiro, e o
    // Prisma cai no payload padrão — que traz colunas que SN-06 manda não
    // trazer.
    const states: ScaffoldPhaseState[] = input.kind
      ? [KIND_TO_STATE[input.kind]]
      : ATTENTION_STATES;

    const rows = await platformDb.scaffoldPhaseInstance.findMany({
      where: {
        state: { in: states },
        track: {
          status: { in: ["ACTIVE", "STALLED"] },
          // O tenant interno não é cliente — a coluna existe exatamente para
          // isto (ADR-0013).
          tenant: { isSystem: false },
        },
      },
      // Do mais antigo para o mais novo: é fila de espera, e quem espera há
      // mais tempo aparece primeiro.
      orderBy: { openedAt: "asc" },
      // Teto como toda listagem do painel (`lib/paginacao.ts`): a fila cresce
      // com cada trilha ativa de cada cliente. O teto corta os mais novos —
      // quem espera há mais tempo continua na tela.
      ...janela(),
      select: {
        id: true,
        phase: true,
        state: true,
        openedAt: true,
        observationEndsAt: true,
        track: {
          select: {
            id: true,
            code: true,
            lastGateAt: true,
            startedAt: true,
            tenant: { select: { name: true } },
            // Só as CHAVES dos critérios, para contar. O enunciado é prosa do
            // método aplicada ao processo do cliente, e não atravessa.
            templateVersion: {
              select: { criteria: { select: { phase: true, key: true } } },
            },
          },
        },
        // Último resultado, só pelo snapshot — de onde sai a contagem de
        // atendidos. `criteriaSnapshot` guarda `met` por chave.
        results: {
          orderBy: { cycle: "desc" },
          take: 1,
          select: { criteriaSnapshot: true },
        },
      },
    });

    const fila = rows.map((p): QueueEntry => {
      // Critérios DA FASE, não do template inteiro: contar todos faria a fila
      // mostrar "0 de 3" para um gate que já tem dois atendidos.
      const criteriaTotal = p.track.templateVersion.criteria.filter(
        (c) => c.phase === p.phase
      ).length;

      const snapshot = p.results[0]?.criteriaSnapshot as
        | { key: string; met: boolean }[]
        | undefined;
      const criteriaMet = snapshot?.filter((c) => c.met).length ?? 0;

      const endsAt = p.state === "OBSERVING" ? p.observationEndsAt : null;
      const elapsed = endsAt
        ? OBSERVATION_WINDOW_DAYS -
          Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / DAY_MS))
        : daysSince(p.track.lastGateAt ?? p.track.startedAt);

      return {
        phaseInstanceId: p.id,
        trackId: p.track.id,
        trackCode: p.track.code,
        orgName: p.track.tenant.name,
        phase: p.phase,
        ageDays: elapsed,
        // Na observação, a idade é quanto já correu da janela — não o tempo
        // desde o último gate. São números diferentes, e o que importa aqui é
        // quanto falta.
        ageLabel: endsAt
          ? `${elapsed} de ${OBSERVATION_WINDOW_DAYS} dias`
          : `${elapsed} dia${elapsed === 1 ? "" : "s"}`,
        criteriaMet,
        criteriaTotal,
        kind: kindOf(p.state),
      };
    });
    return listagem(fila, undefined);
  });
}

export type TenantCrossing = {
  destination: string;
  orgName: string;
  accessLogId: string;
};

/**
 * Travessia explícita para o tenant do cliente — SN-06.
 *
 * A fila entrega metadado; ver o artefato exige entrar. Esta função grava o
 * registro de acesso e devolve uma PORTA, não conteúdo: quem atravessa passa
 * pelo guard do app do cliente do outro lado, com o papel que tiver lá.
 *
 * O log vem ANTES do destino, e a justificativa é obrigatória. Um acesso
 * cross-tenant sem motivo escrito é o tipo de linha que ninguém consegue
 * defender numa auditoria seis meses depois.
 */
export async function enterTenantContext(input: {
  trackId: string;
  rationale: string;
}): Promise<Result<TenantCrossing>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();

    const rationale = input.rationale.trim();
    if (rationale.length < 12) {
      throw new StaffAuthError(
        "FORBIDDEN",
        "Descreva por que precisa entrar no tenant do cliente. O motivo vai para o registro de acesso."
      );
    }

    const track = await platformDb.scaffoldTrack.findFirst({
      where: { id: input.trackId, tenant: { isSystem: false } },
      select: {
        id: true,
        code: true,
        tenant: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!track) {
      throw new StaffAuthError(
        "FORBIDDEN",
        "Trilha não encontrada em nenhum cliente."
      );
    }

    const log = await platformDb.accessLog.create({
      data: {
        tenantId: track.tenant.id,
        userId: staff.userId,
        email: staff.email,
        evento: "LOGIN",
        motivo: `Scaffold · ${track.code} — ${rationale}`,
      },
      select: { id: true },
    });

    return {
      destination: `/scaffold/track/${track.id}`,
      orgName: track.tenant.name,
      accessLogId: log.id,
    };
  });
}
