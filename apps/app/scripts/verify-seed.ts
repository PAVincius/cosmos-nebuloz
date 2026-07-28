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
