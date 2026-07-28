/**
 * verify-seed.ts — critério de sucesso executável do seed.
 *
 * Não testa código: testa que o BANCO SEMEADO contém o que cada tela e cada
 * fluxo precisam. Roda depois do seed. Sai com 1 se qualquer asserção falhar,
 * para poder entrar em CI.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../../../packages/database/generated";
import { parseTaskBlocks } from "../app/(cosmos)/actions/epic-tree.constants";
import { STATUS_CHAINS } from "./flow-status-chains";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const TENANT_SLUG = process.env.SEED_TENANT_SLUG ?? "cosmos-dev";

type Failure = { name: string; detail: string };
const failures: Failure[] = [];
let passed = 0;

async function check(name: string, fn: () => Promise<string | null>) {
  try {
    const detail = await fn();
    if (detail === null) {
      passed++;
    } else {
      failures.push({ name, detail });
    }
  } catch (error) {
    failures.push({
      name,
      detail: `lançou: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Helper: falha com contagem quando não há linha alguma.
async function expectRows(
  label: string,
  count: () => Promise<number>,
  min = 1
): Promise<string | null> {
  const n = await count();
  return n >= min ? null : `${label}: esperado >= ${min}, encontrado ${n}`;
}

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
    select: { id: true },
  });
  if (!tenant) {
    process.stdout.write(
      `FALHA: tenant "${TENANT_SLUG}" não existe. Rode o seed primeiro.\n`
    );
    process.exit(1);
  }
  const t = tenant.id;

  // ─── Task 1: papéis ────────────────────────────────────────────────────
  await check("os sete MemberRole têm usuário", async () => {
    const roles = ["ADMIN", "STE", "RTE", "SM", "PO", "DEV", "MEMBER"];
    const found = await prisma.tenantMember.findMany({
      where: { tenantId: t },
      select: { role: true },
    });
    const have = new Set(found.map((m) => m.role));
    const missing = roles.filter((r) => !have.has(r as never));
    return missing.length ? `papéis sem usuário: ${missing.join(", ")}` : null;
  });

  // As tasks seguintes acrescentam blocos aqui, na mesma forma.

  // ─── Task 2: integrations e tasks importadas ───────────────────────────
  await check("existe Integration ACTIVE", () =>
    expectRows("Integration ACTIVE", () =>
      prisma.integration.count({ where: { tenantId: t, status: "ACTIVE" } })
    )
  );

  await check("existe Integration não-ACTIVE", () =>
    expectRows("Integration inativa", () =>
      prisma.integration.count({
        where: { tenantId: t, status: { not: "ACTIVE" } },
      })
    )
  );

  await check("existe Task importada de provider conectado", async () => {
    const active = await prisma.integration.findMany({
      where: { tenantId: t, status: "ACTIVE" },
      select: { source: true },
    });
    const sources = active.map((i) => i.source);
    if (!sources.length) {
      return "nenhuma Integration ACTIVE para casar com Task";
    }
    const n = await prisma.task.count({
      where: { tenantId: t, externalSource: { in: sources } },
    });
    return n > 0
      ? null
      : `nenhuma Task com externalSource em ${sources.join("/")}`;
  });

  await check("existe Task importada de provider NÃO conectado", async () => {
    const active = await prisma.integration.findMany({
      where: { tenantId: t, status: "ACTIVE" },
      select: { source: true },
    });
    const sources = active.map((i) => i.source);
    const n = await prisma.task.count({
      where: {
        tenantId: t,
        externalSource: {
          not: null,
          notIn: sources.length ? sources : ["__none__"],
        },
      },
    });
    return n > 0 ? null : "nenhuma Task importada de provider desconectado";
  });

  // Contrato real é o da UI (parseTaskBlocks), não "coluna não é SQL NULL":
  // um noteBlocks presente mas corrompido passaria numa checagem de nulidade
  // e a UI abriria a nota mostrando os blocos padrão em silêncio.
  await check(
    "existe Task nativa com noteBlocks que a UI consegue ler",
    async () => {
      const rows = await prisma.task.findMany({
        where: { tenantId: t, externalSource: null },
        select: { noteBlocks: true },
      });
      const n = rows.filter(
        (r) => parseTaskBlocks(r.noteBlocks) !== null
      ).length;
      return n > 0
        ? null
        : "nenhuma Task nativa tem noteBlocks que passe em parseTaskBlocks";
    }
  );

  // ─── Task 3: cadeia completa do drill-down ─────────────────────────────
  await check("existe Epic → Feature → Story → Task completa", async () => {
    const epic = await prisma.epic.findFirst({
      where: {
        tenantId: t,
        features: { some: { stories: { some: { tasks: { some: {} } } } } },
      },
      select: { id: true, title: true },
    });
    return epic ? null : "nenhum Epic tem Feature com Story com Task";
  });

  await check("toda Feature semeada tem pelo menos uma Story", async () => {
    const n = await prisma.feature.count({
      where: { tenantId: t, stories: { none: {} } },
    });
    return n === 0 ? null : `${n} Feature(s) sem Story`;
  });

  await check("toda Story semeada tem pelo menos uma Task", async () => {
    const n = await prisma.story.count({
      where: { tenantId: t, tasks: { none: {} } },
    });
    return n === 0 ? null : `${n} Story(ies) sem Task`;
  });

  await check("existe Story com acceptanceCriteria preenchido", () =>
    expectRows("Story com AC", () =>
      prisma.story.count({
        where: { tenantId: t, acceptanceCriteria: { not: null } },
      })
    )
  );

  // ─── Task 4: Large Solution ────────────────────────────────────────────
  for (const [label, count] of [
    [
      "SolutionTrain",
      () => prisma.solutionTrain.count({ where: { tenantId: t } }),
    ],
    ["Capability", () => prisma.capability.count({ where: { tenantId: t } })],
    ["LACE", () => prisma.lACE.count({ where: { tenantId: t } })],
    ["Supplier", () => prisma.supplier.count({ where: { tenantId: t } })],
    [
      "SolutionRisk",
      () => prisma.solutionRisk.count({ where: { tenantId: t } }),
    ],
  ] as const) {
    await check(`${label} semeado`, () => expectRows(label, count));
  }

  await check("Capability ligada a Feature", () =>
    expectRows("Feature com capabilityId", () =>
      prisma.feature.count({
        where: { tenantId: t, capabilityId: { not: null } },
      })
    )
  );

  // ─── Task 5: Estratégia, horizontes e roadmap ──────────────────────────
  for (const [label, count] of [
    [
      "StrategyPillar",
      () => prisma.strategyPillar.count({ where: { tenantId: t } }),
    ],
    [
      "InvestmentHorizon",
      () => prisma.investmentHorizon.count({ where: { tenantId: t } }),
    ],
    ["RoadmapItem", () => prisma.roadmapItem.count({ where: { tenantId: t } })],
    [
      "EpicValueMetric",
      () => prisma.epicValueMetric.count({ where: { tenantId: t } }),
    ],
  ] as const) {
    await check(`${label} semeado`, () => expectRows(label, count));
  }

  await check("StrategicTheme ligada a StrategyPillar", () =>
    expectRows("StrategicTheme com pillarId", () =>
      prisma.strategicTheme.count({
        where: { tenantId: t, pillarId: { not: null } },
      })
    )
  );

  await check("existe Epic com EpicValueMetric", async () => {
    const metrics = await prisma.epicValueMetric.findMany({
      where: { tenantId: t },
      select: { epicId: true },
    });
    if (!metrics.length) {
      return "nenhuma EpicValueMetric semeada";
    }
    const epicIds = metrics.map((m) => m.epicId);
    const n = await prisma.epic.count({
      where: { tenantId: t, id: { in: epicIds } },
    });
    return n > 0 ? null : "nenhum Epic corresponde a epicId de EpicValueMetric";
  });

  await check(
    "existe EpicValueMetric com plannedValue e actualValue divergentes",
    async () => {
      // Prisma não compara duas colunas diretamente em `where`; busca em
      // memória para a divergência real.
      const rows = await prisma.epicValueMetric.findMany({
        where: { tenantId: t, actualValue: { not: null } },
        select: { plannedValue: true, actualValue: true },
      });
      const diverges = rows.some((r) => r.actualValue !== r.plannedValue);
      return diverges
        ? null
        : `nenhuma EpicValueMetric com actualValue != plannedValue (checadas ${rows.length})`;
    }
  );

  await check("LeanBudget referencia InvestmentHorizon", () =>
    expectRows("LeanBudget com horizonId", () =>
      prisma.leanBudget.count({
        where: { tenantId: t, horizonId: { not: null } },
      })
    )
  );

  // ─── Task 6: FinOps ─────────────────────────────────────────────────────
  // Nota: Anomaly/AnomalyDetectionRun/AnomalyRuleConfig (schema
  // flow-intelligence.prisma) formam um pipeline de anomalias de FLUXO
  // (velocity/WIP), não de custo. A tela `anomalies` do portfólio é lida a
  // partir de CostAnomaly (finops.prisma) — ver comentário em
  // app/(cosmos)/actions/anomalies.ts. AnomalyRuleConfig É reaproveitada
  // pelo FinOps (getAnomalySensitivity/setAnomalySensitivity), então entra
  // aqui; Anomaly e AnomalyDetectionRun não têm relação com FinOps e não são
  // semeadas nesta task.
  for (const [label, count] of [
    ["TagRule", () => prisma.tagRule.count({ where: { tenantId: t } })],
    [
      "BillingEntry",
      () => prisma.billingEntry.count({ where: { tenantId: t } }),
    ],
    [
      "BillingEntryAllocation",
      () => prisma.billingEntryAllocation.count({ where: { tenantId: t } }),
    ],
    [
      "CostSnapshot",
      () => prisma.costSnapshot.count({ where: { tenantId: t } }),
    ],
    ["CostAnomaly", () => prisma.costAnomaly.count({ where: { tenantId: t } })],
    [
      "UnmappedCostBucket",
      () => prisma.unmappedCostBucket.count({ where: { tenantId: t } }),
    ],
    [
      "AnomalyRuleConfig (sensibilidade de custo)",
      () => prisma.anomalyRuleConfig.count({ where: { tenantId: t } }),
    ],
  ] as const) {
    await check(`${label} semeado`, () => expectRows(label, count));
  }

  await check(
    "BillingEntry cobre pelo menos dois meses distintos",
    async () => {
      const rows = await prisma.billingEntry.findMany({
        where: { tenantId: t },
        select: { usageStartDate: true },
      });
      const months = new Set(
        rows.map((r) => r.usageStartDate.toISOString().slice(0, 7))
      );
      return months.size >= 2
        ? null
        : `apenas ${months.size} mês(es) distinto(s) em BillingEntry`;
    }
  );

  await check(
    "existe BillingEntryAllocation ligando custo a StrategicTheme e a Epic",
    () =>
      expectRows("BillingEntryAllocation com themeId e epicId", () =>
        prisma.billingEntryAllocation.count({
          where: { tenantId: t, themeId: { not: null }, epicId: { not: null } },
        })
      )
  );

  await check("existe CostAnomaly NÃO reconhecida (aberta)", () =>
    expectRows("CostAnomaly status OPEN", () =>
      prisma.costAnomaly.count({ where: { tenantId: t, status: "OPEN" } })
    )
  );

  await check("existe CostAnomaly já reconhecida", () =>
    expectRows("CostAnomaly com acknowledgedAt", () =>
      prisma.costAnomaly.count({
        where: { tenantId: t, acknowledgedAt: { not: null } },
      })
    )
  );

  // ─── Task 7: governança e PI Planning ──────────────────────────────────
  // Campos reais (packages/database/prisma/schema/governance.prisma): tanto
  // ApprovalRequest quanto ApprovalStepInstance usam `estado` (não `status`).
  await check(
    "existe ApprovalRequest aberta com pelo menos um step pendente",
    async () => {
      const req = await prisma.approvalRequest.findFirst({
        where: {
          tenantId: t,
          estado: { in: ["open", "in_review"] },
          steps: { some: { estado: "pending" } },
        },
        select: { id: true },
      });
      return req
        ? null
        : "nenhuma ApprovalRequest aberta com step pendente — nada para aprovar na UI";
    }
  );

  await check(
    "existe ApprovalRequest aprovada com todos os steps decididos",
    async () => {
      const req = await prisma.approvalRequest.findFirst({
        where: {
          tenantId: t,
          estado: "approved",
          steps: { none: { estado: "pending" } },
        },
        select: { id: true, steps: { select: { id: true } } },
      });
      if (!req) {
        return "nenhuma ApprovalRequest aprovada com steps todos decididos";
      }
      return req.steps.length > 0
        ? null
        : "ApprovalRequest aprovada não tem nenhum step";
    }
  );

  await check("PIPlan tem participantes cobrindo os sete papéis", async () => {
    const rows = await prisma.pIParticipant.findMany({
      where: { tenantId: t },
      select: { userId: true },
    });
    const distinctUsers = new Set(rows.map((r) => r.userId));
    return distinctUsers.size >= 7
      ? null
      : `PIParticipant: esperado >= 7 usuários distintos, encontrado ${distinctUsers.size}`;
  });

  await check(
    "existe Feature atribuída a um PI, e outra ainda livre",
    async () => {
      const totalFeatures = await prisma.feature.count({
        where: { tenantId: t },
      });
      const assigned = await prisma.pIPlanFeatureAssignment.count({
        where: { tenantId: t },
      });
      if (assigned === 0) {
        return "nenhuma PIPlanFeatureAssignment — nada para reatribuir";
      }
      return assigned < totalFeatures
        ? null
        : `todas as ${totalFeatures} Features já estão atribuídas — fluxo de "atribuir" não é demonstrável`;
    }
  );

  // ─── Task 8: config de tenant, webhooks e workflows ────────────────────
  for (const [label, count] of [
    [
      "WebhookEndpoint",
      () => prisma.webhookEndpoint.count({ where: { tenantId: t } }),
    ],
    [
      "BpmnDefinition",
      () => prisma.bpmnDefinition.count({ where: { tenantId: t } }),
    ],
    [
      "TeamWorkflowNode",
      () => prisma.teamWorkflowNode.count({ where: { tenantId: t } }),
    ],
    [
      "TeamWorkflowEdge",
      () => prisma.teamWorkflowEdge.count({ where: { tenantId: t } }),
    ],
    [
      "TenantSSOConfig",
      () => prisma.tenantSSOConfig.count({ where: { tenantId: t } }),
    ],
    [
      "TenantSecurityPolicy",
      () => prisma.tenantSecurityPolicy.count({ where: { tenantId: t } }),
    ],
    [
      "TenantInvitation",
      () => prisma.tenantInvitation.count({ where: { tenantId: t } }),
    ],
    [
      "WsjfSettings",
      () => prisma.wsjfSettings.count({ where: { tenantId: t } }),
    ],
    ["CustomRole", () => prisma.customRole.count({ where: { tenantId: t } })],
    [
      "CustomRoleAssignment",
      () => prisma.customRoleAssignment.count({ where: { tenantId: t } }),
    ],
    [
      "ARTMembership",
      () => prisma.aRTMembership.count({ where: { tenantId: t } }),
    ],
    [
      "MeetingIntegration",
      () => prisma.meetingIntegration.count({ where: { tenantId: t } }),
    ],
    [
      "MeetingTranscript",
      () => prisma.meetingTranscript.count({ where: { tenantId: t } }),
    ],
    [
      "MeetingInsight",
      () => prisma.meetingInsight.count({ where: { tenantId: t } }),
    ],
    [
      "ScheduledReport",
      () => prisma.scheduledReport.count({ where: { tenantId: t } }),
    ],
  ] as const) {
    await check(`${label} semeado`, () => expectRows(label, count));
  }

  await check(
    "existe TenantInvitation PENDING (alvo para reenviar/revogar)",
    () =>
      expectRows("TenantInvitation PENDING", () =>
        prisma.tenantInvitation.count({
          where: { tenantId: t, status: "PENDING" },
        })
      )
  );

  await check(
    "WsjfSettings tem pesos diferentes do default (bv=1/tc=1/rr=1)",
    async () => {
      const settings = await prisma.wsjfSettings.findUnique({
        where: { tenantId: t },
        select: { weightBv: true, weightTc: true, weightRr: true },
      });
      if (!settings) {
        return "nenhuma WsjfSettings semeada";
      }
      const differs =
        settings.weightBv !== 1 ||
        settings.weightTc !== 1 ||
        settings.weightRr !== 1;
      return differs
        ? null
        : `pesos iguais ao default (bv=${settings.weightBv}, tc=${settings.weightTc}, rr=${settings.weightRr})`;
    }
  );

  await check(
    "TenantSSOConfig está configurado (metadados) mas desligado (enabled=false)",
    async () => {
      const sso = await prisma.tenantSSOConfig.findUnique({
        where: { tenantId: t },
        select: { enabled: true, idpMetadataUrl: true, idpCertificate: true },
      });
      if (!sso) {
        return "nenhuma TenantSSOConfig semeada";
      }
      if (sso.enabled) {
        return "TenantSSOConfig.enabled deveria ser false (configurado, não ativado)";
      }
      return sso.idpMetadataUrl && sso.idpCertificate
        ? null
        : "TenantSSOConfig sem idpMetadataUrl/idpCertificate preenchidos";
    }
  );

  // ─── Task 9: StateTransitionHistory (série bruta do CFD da tela flow) ────
  await check(
    "StateTransitionHistory cobre pelo menos 10 stories distintas",
    async () => {
      const rows = await prisma.stateTransitionHistory.findMany({
        where: { tenantId: t, entityType: "Story" },
        select: { entityId: true },
      });
      const distinct = new Set(rows.map((r) => r.entityId));
      return distinct.size >= 10
        ? null
        : `apenas ${distinct.size} stories distintas, esperado >= 10`;
    }
  );

  await check("StateTransitionHistory cobre pelo menos 14 dias", async () => {
    const agg = await prisma.stateTransitionHistory.aggregate({
      where: { tenantId: t, entityType: "Story" },
      _min: { transitionedAt: true },
      _max: { transitionedAt: true },
    });
    if (!(agg._min.transitionedAt && agg._max.transitionedAt)) {
      return "nenhuma StateTransitionHistory semeada";
    }
    const days =
      (agg._max.transitionedAt.getTime() - agg._min.transitionedAt.getTime()) /
      86_400_000;
    return days >= 14
      ? null
      : `span de ${days.toFixed(1)} dias, esperado >= 14`;
  });

  // Generaliza a checagem de ordem: em vez de só testar "está ordenado"
  // (que, lido na própria ordem de inserção, só pega erro de digitação nos
  // daysAgo da tabela — não pegaria, por ex., uma story REVIEW semeada com
  // uma única transição fabricada CREATED→REVIEW, que passaria por count,
  // span, e pelas checagens nomeadas de DONE/BACKLOG abaixo sem detecção),
  // comparamos a sequência de (fromStatus,toStatus) TAL COMO ARMAZENADA
  // contra a cadeia completa que STATUS_CHAINS prevê para o status atual
  // da story — a mesma fonte de verdade usada por seedFlowHistory, importada
  // de ./flow-status-chains em vez de duplicada aqui. Isso cobre todo status
  // presente em STATUS_CHAINS (incluindo TODO, REVIEW, SPLIT_INTO, que as
  // checagens nomeadas abaixo não tocam), e ainda pega ordem cronológica
  // fora de linha, porque a cadeia esperada é ela própria não-decrescente
  // em daysAgo.
  await check(
    "cada story segue exatamente a cadeia de transições esperada para seu status atual",
    async () => {
      // orderBy id (cuid, cresce com a ordem de criação) preserva a ordem
      // em que as linhas foram de fato gravadas — comparar contra isso, e
      // não contra um re-sort por transitionedAt, é o que evita a checagem
      // virar tautológica.
      const rows = await prisma.stateTransitionHistory.findMany({
        where: { tenantId: t, entityType: "Story" },
        orderBy: { id: "asc" },
        select: {
          entityId: true,
          fromStatus: true,
          toStatus: true,
          transitionedAt: true,
        },
      });
      const byStory = new Map<
        string,
        { fromStatus: string; toStatus: string; transitionedAt: Date }[]
      >();
      for (const r of rows) {
        const steps = byStory.get(r.entityId) ?? [];
        steps.push(r);
        byStory.set(r.entityId, steps);
      }

      const stories = await prisma.story.findMany({
        where: { tenantId: t, id: { in: [...byStory.keys()] } },
        select: { id: true, status: true },
      });

      const offenders: string[] = [];
      for (const story of stories) {
        const expected = STATUS_CHAINS[story.status];
        const actual = byStory.get(story.id) ?? [];
        if (!expected) {
          offenders.push(
            `${story.id}: status "${story.status}" sem cadeia definida em STATUS_CHAINS`
          );
          continue;
        }
        if (actual.length !== expected.length) {
          offenders.push(
            `${story.id}: ${actual.length} transição(ões) armazenada(s), esperado ${expected.length} para status ${story.status}`
          );
          continue;
        }
        let mismatch: string | null = null;
        for (let i = 0; i < expected.length; i++) {
          if (
            actual[i].fromStatus !== expected[i].from ||
            actual[i].toStatus !== expected[i].to
          ) {
            mismatch = `passo ${i}: armazenado ${actual[i].fromStatus}→${actual[i].toStatus}, esperado ${expected[i].from}→${expected[i].to}`;
            break;
          }
          if (
            i > 0 &&
            actual[i].transitionedAt.getTime() <
              actual[i - 1].transitionedAt.getTime()
          ) {
            mismatch = `passo ${i}: transitionedAt anterior ao passo ${i - 1}`;
            break;
          }
        }
        if (mismatch) {
          offenders.push(`${story.id}: ${mismatch}`);
        }
      }
      return offenders.length ? offenders.join("; ") : null;
    }
  );

  await check(
    "toda story DONE passou por uma transição para IN_PROGRESS antes de DONE",
    async () => {
      const doneStories = await prisma.story.findMany({
        where: { tenantId: t, status: "DONE" },
        select: { id: true },
      });
      const missing: string[] = [];
      for (const s of doneStories) {
        const count = await prisma.stateTransitionHistory.count({
          where: {
            tenantId: t,
            entityType: "Story",
            entityId: s.id,
            toStatus: "IN_PROGRESS",
          },
        });
        if (count === 0) {
          missing.push(s.id);
        }
      }
      return missing.length
        ? `stories DONE sem transição prévia para IN_PROGRESS: ${missing.join(", ")}`
        : null;
    }
  );

  await check(
    "nenhuma story em BACKLOG tem transição para DONE no histórico",
    async () => {
      const backlogStories = await prisma.story.findMany({
        where: { tenantId: t, status: "BACKLOG" },
        select: { id: true },
      });
      const offenders: string[] = [];
      for (const s of backlogStories) {
        const count = await prisma.stateTransitionHistory.count({
          where: {
            tenantId: t,
            entityType: "Story",
            entityId: s.id,
            toStatus: "DONE",
          },
        });
        if (count > 0) {
          offenders.push(s.id);
        }
      }
      return offenders.length
        ? `stories em BACKLOG com transição para DONE registrada: ${offenders.join(", ")}`
        : null;
    }
  );

  await check(
    "a última transição de cada story bate com o status atual da story",
    async () => {
      const rows = await prisma.stateTransitionHistory.findMany({
        where: { tenantId: t, entityType: "Story" },
        orderBy: { id: "asc" },
        select: { entityId: true, toStatus: true },
      });
      const lastByStory = new Map<string, string>();
      for (const r of rows) {
        lastByStory.set(r.entityId, r.toStatus);
      }
      const stories = await prisma.story.findMany({
        where: { tenantId: t, id: { in: [...lastByStory.keys()] } },
        select: { id: true, status: true },
      });
      const mismatches = stories
        .filter((s) => lastByStory.get(s.id) !== s.status)
        .map((s) => s.id);
      return mismatches.length
        ? `stories cujo status atual diverge da última transição registrada: ${mismatches.join(", ")}`
        : null;
    }
  );

  // ─── Task 10: isolamento multi-tenant ──────────────────────────────────
  // Estas asserções rodam INCONDICIONALMENTE — não dependem de um segundo
  // tenant existir — porque são baratas e detectam o defeito mais caro que
  // este seed pode introduzir: um FK cruzando fronteira de tenant. Cobrem
  // toda a espinha do drill-down (Epic → Feature → Story → Task, o mesmo
  // caminho onde createNativeTask criou uma Task no tenant do chamador
  // pendurada numa Story de outro tenant) mais três pares tocados nas
  // tasks de governança/PI Planning anteriores. Nenhuma delas filtra por
  // tenantId: t — varrem TODOS os tenants do banco, porque um vazamento
  // pode aparecer entre quaisquer dois. O tenant `system` (isSystem=true)
  // não grava linha nenhuma nessas tabelas (só na tabela do relatório de
  // auditoria — ver lib/inngest/isolation-audit.ts), então não precisa
  // ser excluído aqui; a exclusão relevante fica na checagem "há pelo
  // menos dois tenants de cliente com dados" abaixo.
  function leaksOf<T extends { id: string; tenantId: string }>(
    rows: readonly (T & { parentTenantId: string | null })[]
  ): T[] {
    return rows.filter(
      (r) => r.parentTenantId !== null && r.parentTenantId !== r.tenantId
    );
  }
  function leakDetail(label: string, leaks: { id: string }[]): string | null {
    return leaks.length === 0
      ? null
      : `${leaks.length} ${label} cruzam tenant: ${leaks
          .slice(0, 3)
          .map((r) => r.id)
          .join(", ")}`;
  }

  await check("nenhuma Feature referencia Epic de outro tenant", async () => {
    const rows = await prisma.feature.findMany({
      where: { epicId: { not: null } },
      select: {
        id: true,
        tenantId: true,
        epic: { select: { tenantId: true } },
      },
    });
    const leaks = leaksOf(
      rows.map((r) => ({ ...r, parentTenantId: r.epic?.tenantId ?? null }))
    );
    return leakDetail("Feature(s)", leaks);
  });

  await check("nenhuma Story referencia Feature de outro tenant", async () => {
    const rows = await prisma.story.findMany({
      where: { featureId: { not: null } },
      select: {
        id: true,
        tenantId: true,
        feature: { select: { tenantId: true } },
      },
    });
    const leaks = leaksOf(
      rows.map((r) => ({ ...r, parentTenantId: r.feature?.tenantId ?? null }))
    );
    return leakDetail("Story(ies)", leaks);
  });

  await check("nenhuma Task referencia Story de outro tenant", async () => {
    const rows = await prisma.task.findMany({
      select: {
        id: true,
        tenantId: true,
        story: { select: { tenantId: true } },
      },
    });
    const leaks = leaksOf(
      rows.map((r) => ({ ...r, parentTenantId: r.story?.tenantId ?? null }))
    );
    return leakDetail("Task(s)", leaks);
  });

  await check(
    "nenhuma Feature referencia Capability de outro tenant",
    async () => {
      const rows = await prisma.feature.findMany({
        where: { capabilityId: { not: null } },
        select: {
          id: true,
          tenantId: true,
          capability: { select: { tenantId: true } },
        },
      });
      const leaks = leaksOf(
        rows.map((r) => ({
          ...r,
          parentTenantId: r.capability?.tenantId ?? null,
        }))
      );
      return leakDetail("Feature(s)", leaks);
    }
  );

  await check(
    "nenhum GovernedEpic referencia Epic de outro tenant",
    async () => {
      const rows = await prisma.governedEpic.findMany({
        select: {
          id: true,
          tenantId: true,
          epic: { select: { tenantId: true } },
        },
      });
      const leaks = leaksOf(
        rows.map((r) => ({ ...r, parentTenantId: r.epic?.tenantId ?? null }))
      );
      return leakDetail("GovernedEpic(s)", leaks);
    }
  );

  await check(
    "nenhum ApprovalStepInstance referencia ApprovalRequest de outro tenant",
    async () => {
      const rows = await prisma.approvalStepInstance.findMany({
        select: {
          id: true,
          tenantId: true,
          approvalRequest: { select: { tenantId: true } },
        },
      });
      const leaks = leaksOf(
        rows.map((r) => ({
          ...r,
          parentTenantId: r.approvalRequest?.tenantId ?? null,
        }))
      );
      return leakDetail("ApprovalStepInstance(s)", leaks);
    }
  );

  await check(
    "nenhuma PIPlanFeatureAssignment referencia Feature de outro tenant",
    async () => {
      // PIPlanFeatureAssignment.featureId não é uma relação Prisma (só a
      // coluna) — join manual em vez de `include`.
      const assignments = await prisma.pIPlanFeatureAssignment.findMany({
        select: { id: true, tenantId: true, featureId: true },
      });
      if (assignments.length === 0) {
        return null;
      }
      const features = await prisma.feature.findMany({
        where: { id: { in: assignments.map((a) => a.featureId) } },
        select: { id: true, tenantId: true },
      });
      const featureTenantById = new Map(
        features.map((f) => [f.id, f.tenantId])
      );
      const leaks = leaksOf(
        assignments.map((a) => ({
          ...a,
          parentTenantId: featureTenantById.get(a.featureId) ?? null,
        }))
      );
      return leakDetail("PIPlanFeatureAssignment(s)", leaks);
    }
  );

  await check(
    "há pelo menos dois tenants de cliente (isSystem=false) com Epic próprio",
    async () => {
      const tenants = await prisma.tenant.findMany({
        where: { isSystem: false, epics: { some: {} } },
        select: { id: true },
      });
      return tenants.length >= 2
        ? null
        : `apenas ${tenants.length} tenant(s) de cliente com Epic — isolamento não é demonstrável na UI sem um segundo tenant povoado (rode pnpm seed:tenants)`;
    }
  );

  // ─── Relatório ─────────────────────────────────────────────────────────
  process.stdout.write(`\n${passed} asserções passaram\n`);
  if (failures.length) {
    process.stdout.write(`${failures.length} FALHARAM:\n`);
    for (const f of failures) {
      process.stdout.write(`  ✗ ${f.name}\n    ${f.detail}\n`);
    }
    await prisma.$disconnect();
    process.exit(1);
  }
  await prisma.$disconnect();
}

main().catch(async (error) => {
  process.stdout.write(`erro fatal: ${String(error)}\n`);
  await prisma.$disconnect();
  process.exit(1);
});
