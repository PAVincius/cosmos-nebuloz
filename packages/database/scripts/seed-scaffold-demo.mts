// seed-scaffold-demo.mts — trilhas de demonstração do Scaffold (SC-DEV-08).
//
// SÓ DESENVOLVIMENTO. Recusa rodar contra qualquer banco que não seja a própria
// máquina (localhost, 127.0.0.1, ::1): trilha fictícia num banco de cliente é
// dado falso sobre gente real. O catálogo de templates (`seed-scaffold.mts`) é
// que vai a produção; este não.
//
// Uso (Postgres local, tenant de demo já existente):
//   SCAFFOLD_DEMO_TENANT=<slug> pnpm --filter @repo/database seed:scaffold-demo
//
// Roda depois de `seed:scaffold`: usa a versão mais nova de cada template.
// Idempotente: trilha com o mesmo código no tenant é pulada, nunca reescrita.
//
// Sem número inventado (SC-PO-06): os nomes são os que o PDF nomeia, e as
// trilhas sem nome no PDF levam o rótulo do template com "demonstração". O
// escalonamento é só de ESTADO (não iniciado → aprovado); nenhuma métrica ou
// caso de negócio assinado é fabricado, então toda trilha fica na Fase 1, com
// passos e entregáveis em todas as quatro fases.

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/client";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Recusa banco que não seja local. Não repete a URL na mensagem: ela carrega a
 *  senha. */
export function assertLocalDatabaseUrl(url: string | undefined): void {
  let host = "";
  try {
    host = new URL(url ?? "").hostname;
  } catch {
    // cai na recusa abaixo
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      "seed-scaffold-demo só roda contra um Postgres em localhost (localhost, 127.0.0.1 ou ::1). Recusado."
    );
  }
}

type DemoTrack = {
  code: string;
  name: string;
  templateKey:
    | "conversational"
    | "analysis"
    | "docreview"
    | "triage"
    | "reporting";
  /** Sem nome no PDF: o rótulo é do template, e não um caso inventado. */
  placeholder?: boolean;
};

/** As nove do backlog (DEV-35), na ordem dele. */
export const DEMO_TRACKS: DemoTrack[] = [
  { code: "TR-110", name: "Orbi", templateKey: "conversational" },
  { code: "TR-112", name: "Agrônomo virtual", templateKey: "conversational" },
  { code: "TR-114", name: "Glosas hospitalares", templateKey: "analysis" },
  {
    code: "TR-104",
    name: "Triagem de autorizações prévias",
    templateKey: "triage",
  },
  {
    code: "TR-105",
    name: "Revisão de documentos — demonstração",
    templateKey: "docreview",
    placeholder: true,
  },
  {
    code: "TR-092",
    name: "Relatórios recorrentes — demonstração",
    templateKey: "reporting",
    placeholder: true,
  },
  {
    code: "TR-088",
    name: "Triagem de demanda — demonstração",
    templateKey: "triage",
    placeholder: true,
  },
  {
    code: "TR-096",
    name: "Análise e priorização — demonstração",
    templateKey: "analysis",
    placeholder: true,
  },
  {
    code: "TR-071",
    name: "Revisão de laudos — demonstração",
    templateKey: "docreview",
    placeholder: true,
  },
];

const STAGES = ["NOT_STARTED", "IN_PROGRESS", "IN_REVIEW", "APPROVED"] as const;
type Stage = (typeof STAGES)[number];

const CHAIN: Record<Stage, string[]> = {
  NOT_STARTED: [],
  IN_PROGRESS: ["START"],
  IN_REVIEW: ["START", "SUBMIT"],
  APPROVED: ["START", "SUBMIT", "APPROVE"],
};
const CHAIN_STATUS: Record<string, Stage> = {
  START: "IN_PROGRESS",
  SUBMIT: "IN_REVIEW",
  APPROVE: "APPROVED",
};

const PHASES = ["ASSESS", "PILOT", "SCALE", "EMBED"] as const;

type Ctx = { tenantId: string; ownerId: string; authorId: string };
type Db = InstanceType<typeof PrismaClient>;

const numberOf = (code: string) =>
  Number.parseInt(code.split("-")[1] ?? "0", 10);

/** Estado do j-ésimo entregável da ASSESS: as trilhas ficam em pontos diferentes
 *  do caminho, para a demonstração mostrar todos os estados. O A3.2 é o caso de
 *  negócio e não se aprova à mão. */
function stageFor(trackIndex: number, j: number, code: string): Stage {
  if (code === "A3.2") {
    return "NOT_STARTED";
  }
  const level = (trackIndex % 4) + 1 - j;
  return STAGES[Math.max(0, Math.min(3, level))] as Stage;
}

export async function seedDemoTrack(
  db: Db,
  ctx: Ctx,
  spec: DemoTrack
): Promise<"created" | "skipped"> {
  const existing = await db.scaffoldTrack.findFirst({
    where: { tenantId: ctx.tenantId, code: spec.code },
    select: { id: true },
  });
  if (existing) {
    return "skipped";
  }

  const template = await db.scaffoldTemplate.findUnique({
    where: { key: spec.templateKey },
    select: {
      id: true,
      // A forma do trabalho é do template: trilha de demonstração sem ela sairia
      // "sem arquétipo" no portfólio (Crivo G4).
      archetype: true,
      versions: {
        orderBy: { publishedAt: "desc" },
        take: 1,
        select: {
          id: true,
          steps: { orderBy: { seq: "asc" } },
          deliverables: { orderBy: [{ phase: "asc" }, { seq: "asc" }] },
        },
      },
    },
  });
  const version = template?.versions[0];
  if (!(template && version) || version.deliverables.length === 0) {
    throw new Error(
      `Template ${spec.templateKey} sem versão com entregáveis. Rode seed:scaffold antes.`
    );
  }

  const trackIndex = DEMO_TRACKS.findIndex((t) => t.code === spec.code);
  const n = numberOf(spec.code);

  // Estado por entregável, decidido antes para que o passo saiba se fechou.
  const planned = version.deliverables.map((d, i) => {
    const j = version.deliverables
      .filter((x) => x.phase === d.phase)
      .findIndex((x) => x.code === d.code);
    return {
      d,
      stage: (d.phase === "ASSESS"
        ? stageFor(trackIndex, j, d.code)
        : "NOT_STARTED") as Stage,
      i,
    };
  });
  const stepDone = (phase: string, key: string) => {
    const items = planned.filter(
      (p) => p.d.phase === phase && p.d.stepCode === key
    );
    return items.length > 0 && items.every((p) => p.stage === "APPROVED");
  };

  const track = await db.scaffoldTrack.create({
    data: {
      tenantId: ctx.tenantId,
      code: spec.code,
      processName: spec.name,
      archetype: template.archetype,
      ownerId: ctx.ownerId,
      templateVersionId: version.id,
      phases: {
        create: PHASES.map((phase) => ({
          phase,
          state: phase === "ASSESS" ? ("OPEN" as const) : ("IDLE" as const),
          openedAt: phase === "ASSESS" ? new Date() : null,
          steps: {
            create: version.steps
              .filter((s) => s.phase === phase)
              .map((s) => ({
                stepTemplateKey: s.key,
                seq: s.seq,
                statement: s.statement,
                expectedArtefact: s.expectedArtefact,
                required: s.required,
                state: stepDone(phase, s.key)
                  ? ("DONE" as const)
                  : ("TODO" as const),
                completedAt: stepDone(phase, s.key) ? new Date() : null,
              })),
          },
        })),
      },
    },
    select: { id: true },
  });

  // Caso de negócio em rascunho, como o de qualquer trilha nova (SB-01).
  const bc = await db.scaffoldBusinessCase.create({
    data: {
      tenantId: ctx.tenantId,
      trackId: track.id,
      code: `BC-${String(n).padStart(3, "0")}`,
      state: "DRAFT",
      sponsorId: ctx.ownerId,
      sponsorRoleLabel: "Dono do processo",
      authorId: ctx.authorId,
      benefitBasis: "",
      versions: {
        create: {
          tenantId: ctx.tenantId,
          label: "v1",
          state: "DRAFT",
          note: "Versão inicial, aberta com a trilha.",
          authoredById: ctx.authorId,
        },
      },
    },
    select: { id: true, versions: { select: { id: true } } },
  });
  await db.scaffoldBusinessCase.update({
    where: { id: bc.id },
    data: { currentVersionId: bc.versions[0]?.id },
  });

  const phaseId = new Map(
    (
      await db.scaffoldPhaseInstance.findMany({
        where: { trackId: track.id, track: { tenantId: ctx.tenantId } },
        select: { id: true, phase: true },
      })
    ).map((p) => [p.phase, p.id])
  );
  const charter = await db.tenantModule.findFirst({
    where: {
      tenantId: ctx.tenantId,
      module: "CHARTER",
      status: { in: ["ACTIVE", "TRIAL"] },
    },
    select: { module: true },
  });

  for (const { d, stage } of planned) {
    const dispensed = d.requiresModule === "CHARTER" && !charter;
    const row = await db.scaffoldDeliverableInstance.create({
      data: {
        tenantId: ctx.tenantId,
        trackId: track.id,
        phaseInstanceId: phaseId.get(d.phase) as string,
        stepCode: d.stepCode,
        code: d.code,
        templateKey: d.code,
        title: d.title,
        description: d.description,
        kind: d.kind,
        producer: d.producer,
        isExtra: false,
        required: dispensed ? false : d.required,
        dispensedReason: dispensed
          ? "O módulo Charter não está contratado por esta organização; dispensado pelo sistema."
          : null,
        status: stage,
        ownerId: ctx.ownerId,
      },
      select: { id: true },
    });
    const chain = CHAIN[stage];
    if (chain.length > 0) {
      let from: Stage = "NOT_STARTED";
      await db.scaffoldDeliverableEvent.createMany({
        data: chain.map((action) => {
          const to = CHAIN_STATUS[action] as Stage;
          const e = {
            tenantId: ctx.tenantId,
            deliverableId: row.id,
            // O aprovador não é o dono: quem aprova aqui é o autor do seed.
            actorId: action === "APPROVE" ? ctx.authorId : ctx.ownerId,
            action: action as never,
            fromStatus: from,
            toStatus: to,
          };
          from = to;
          return e;
        }),
      });
    }
  }

  // A sequência nunca fica abaixo do maior código semeado: a próxima trilha
  // criada pela tela não pode colidir com TR-112.
  for (const kind of ["track", "businesscase"] as const) {
    const cur = await db.scaffoldSequence.findUnique({
      where: { tenantId_kind: { tenantId: ctx.tenantId, kind } },
      select: { next: true },
    });
    await db.scaffoldSequence.upsert({
      where: { tenantId_kind: { tenantId: ctx.tenantId, kind } },
      create: { tenantId: ctx.tenantId, kind, next: n + 1 },
      update: { next: Math.max(cur?.next ?? 0, n + 1) },
    });
  }
  return "created";
}

async function main() {
  assertLocalDatabaseUrl(process.env.DATABASE_URL);
  const slug = process.env.SCAFFOLD_DEMO_TENANT;
  if (!slug) {
    throw new Error(
      "Defina SCAFFOLD_DEMO_TENANT com o slug do tenant de demo."
    );
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const tenant = await db.tenant.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!tenant) {
      throw new Error(`Tenant "${slug}" não encontrado.`);
    }
    const admin = await db.tenantMember.findFirst({
      where: { tenantId: tenant.id, role: "ADMIN" },
      select: { userId: true },
    });
    if (!admin) {
      throw new Error("O tenant de demo não tem nenhum administrador.");
    }
    const ctx = {
      tenantId: tenant.id,
      ownerId: admin.userId,
      authorId: admin.userId,
    };
    for (const spec of DEMO_TRACKS) {
      const r = await db.$transaction((tx) =>
        seedDemoTrack(tx as unknown as Db, ctx, spec)
      );
      console.log(
        `${spec.code} ${spec.name}: ${r === "created" ? "criada" : "já existia"}`
      );
    }
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

const isEntrypoint =
  !!process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (isEntrypoint) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
