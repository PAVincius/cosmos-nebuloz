import { describe, expect, it, vi } from "vitest";

vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: class {} }));
vi.mock("pg", () => ({ Pool: class {} }));
vi.mock("../generated/client", () => ({
  PrismaClient: class {
    $disconnect() {}
  },
}));

import {
  assertLocalDatabaseUrl,
  DEMO_TRACKS,
  seedDemoTrack,
} from "../scripts/seed-scaffold-demo.mts";

// SC-DEV-08 — seed de demonstração. Só em desenvolvimento: o script recusa
// qualquer banco que não seja a própria máquina, porque semear trilhas fictícias
// num banco de cliente é dado falso sobre gente real.

describe("assertLocalDatabaseUrl", () => {
  it.each([
    "postgresql://u:p@localhost:5432/x",
    "postgres://u:p@127.0.0.1:5432/x",
    "postgresql://u:p@[::1]:5432/x",
  ])("aceita %s", (url) => {
    expect(() => assertLocalDatabaseUrl(url)).not.toThrow();
  });

  it.each([
    "postgresql://u:p@db.abcd.supabase.co:5432/postgres",
    "postgresql://u:p@aws-0-sa-east-1.pooler.supabase.com:6543/postgres",
    "postgresql://u:p@localhost.evil.com:5432/x",
    "postgresql://u:p@10.0.0.5:5432/x",
    "not a url",
    "",
    undefined,
  ])("recusa %s", (url) => {
    expect(() => assertLocalDatabaseUrl(url as string)).toThrow(/localhost/i);
  });

  it("a mensagem de recusa não vaza a senha", () => {
    try {
      assertLocalDatabaseUrl("postgresql://u:segredo123@db.x.supabase.co/x");
    } catch (e) {
      expect(String(e)).not.toContain("segredo123");
    }
  });
});

describe("DEMO_TRACKS", () => {
  it("são as 9 trilhas do backlog mais o Atlas, com os códigos e sem repetir", () => {
    expect(DEMO_TRACKS.map((t) => t.code)).toEqual([
      "TR-110",
      "TR-112",
      "TR-114",
      "TR-104",
      "TR-105",
      "TR-092",
      "TR-088",
      "TR-096",
      "TR-071",
      "TR-120",
    ]);
  });

  it("cada uma usa um dos 5 templates de forma ou a Fundação de Prontidão", () => {
    for (const t of DEMO_TRACKS) {
      expect([
        "conversational",
        "analysis",
        "docreview",
        "triage",
        "reporting",
        "ai-readiness-foundation",
      ]).toContain(t.templateKey);
    }
  });

  it("só o Atlas usa a Fundação e só ele leva overlay", () => {
    const fundacao = DEMO_TRACKS.filter(
      (t) => t.templateKey === "ai-readiness-foundation"
    );
    expect(fundacao.map((t) => t.code)).toEqual(["TR-120"]);
    expect(DEMO_TRACKS.filter((t) => t.atlas).map((t) => t.code)).toEqual([
      "TR-120",
    ]);
  });

  it("nenhum número inventado: nomes só do que o PDF nomeia", () => {
    const named = DEMO_TRACKS.filter((t) => !t.placeholder).map((t) => t.name);
    expect(named).toEqual(
      expect.arrayContaining([
        "Triagem de autorizações prévias",
        "Glosas hospitalares",
      ])
    );
    for (const t of DEMO_TRACKS) {
      expect(t.name).not.toMatch(/\d+\s*%/);
    }
  });
});

describe("seedDemoTrack", () => {
  const setup = (existingCode: string | null = null) => {
    const created: { track?: Record<string, unknown> } = {};
    const events: Record<string, unknown>[] = [];
    const db = {
      scaffoldTrack: {
        findFirst: async () => (existingCode ? { id: "old" } : null),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          created.track = data;
          return { id: "trk1" };
        }),
      },
      scaffoldTemplate: {
        findUnique: async () => ({
          id: "tpl",
          archetype: "TRIAGE",
          versions: [
            {
              id: "ver",
              steps: [
                {
                  phase: "ASSESS",
                  seq: 1,
                  key: "A1",
                  statement: "Mapear o processo",
                  expectedArtefact: "x",
                  required: true,
                },
                {
                  phase: "PILOT",
                  seq: 1,
                  key: "B1",
                  statement: "Preparar o piloto",
                  expectedArtefact: "y",
                  required: true,
                },
              ],
              deliverables: [
                {
                  phase: "ASSESS",
                  stepCode: "A1",
                  code: "A1.1",
                  seq: 1,
                  title: "Mapa",
                  description: "d",
                  kind: "SPREADSHEET",
                  producer: "OWNER",
                  required: true,
                  requiresModule: null,
                },
                {
                  phase: "ASSESS",
                  stepCode: "A1",
                  code: "A1.2",
                  seq: 2,
                  title: "Outro",
                  description: "d",
                  kind: "DOCUMENT",
                  producer: "OWNER",
                  required: true,
                  requiresModule: null,
                },
                {
                  phase: "PILOT",
                  stepCode: "B1",
                  code: "B1.1",
                  seq: 1,
                  title: "Critério",
                  description: "d",
                  kind: "DOCUMENT",
                  producer: "CONSULTANT",
                  required: true,
                  requiresModule: null,
                },
              ],
            },
          ],
        }),
      },
      scaffoldPhaseInstance: {
        findMany: async () => [
          { id: "ph-a", phase: "ASSESS" },
          { id: "ph-p", phase: "PILOT" },
          { id: "ph-s", phase: "SCALE" },
          { id: "ph-e", phase: "EMBED" },
        ],
      },
      scaffoldBusinessCase: {
        create: vi.fn(async () => ({ id: "bc", versions: [{ id: "bcv" }] })),
        update: vi.fn(),
      },
      scaffoldDeliverableInstance: {
        create: vi.fn(async ({ data }: { data: { code: string } }) => ({
          id: `d-${data.code}`,
        })),
      },
      scaffoldDeliverableEvent: {
        createMany: vi.fn(
          async ({ data }: { data: Record<string, unknown>[] }) => {
            events.push(...data);
          }
        ),
      },
      tenantModule: { findFirst: async () => null },
      scaffoldSequence: {
        findUnique: async () => ({ next: 2 }),
        upsert: vi.fn(),
      },
    };
    return { db, created, events };
  };

  const ctx = { tenantId: "t1", ownerId: "u1", authorId: "u1" };
  const spec = DEMO_TRACKS[3]!;

  it("cria a trilha com o código fixo, na versão mais nova do template", async () => {
    const { db, created } = setup();
    const r = await seedDemoTrack(db as never, ctx, spec);
    expect(r).toBe("created");
    expect(created.track).toMatchObject({
      tenantId: "t1",
      code: "TR-104",
      processName: "Triagem de autorizações prévias",
      templateVersionId: "ver",
    });
  });

  it("a trilha nasce com a forma de trabalho do template, não sem arquétipo (Crivo G4)", async () => {
    const { db, created } = setup();
    await seedDemoTrack(db as never, ctx, spec);
    expect(created.track).toMatchObject({ archetype: "TRIAGE" });
  });

  it("idempotente: trilha com o mesmo código no tenant não é recriada", async () => {
    const { db } = setup("TR-104");
    expect(await seedDemoTrack(db as never, ctx, spec)).toBe("skipped");
    expect(db.scaffoldTrack.create).not.toHaveBeenCalled();
  });

  it("toda fase tem passos e entregáveis; só a ASSESS anda", async () => {
    const { db } = setup();
    await seedDemoTrack(db as never, ctx, spec);
    const data = db.scaffoldTrack.create.mock.calls[0]?.[0].data as {
      phases: {
        create: {
          phase: string;
          state: string;
          steps: { create: unknown[] };
        }[];
      };
    };
    const phases = data.phases.create;
    expect(phases.map((p) => p.state)).toEqual([
      "OPEN",
      "IDLE",
      "IDLE",
      "IDLE",
    ]);
    expect(phases[0]?.steps.create.length).toBeGreaterThan(0);
    expect(phases[1]?.steps.create.length).toBeGreaterThan(0);
    const codes = db.scaffoldDeliverableInstance.create.mock.calls.map(
      (c) => (c[0] as { data: { code: string } }).data.code
    );
    expect(codes).toEqual(["A1.1", "A1.2", "B1.1"]);
  });

  it("o histórico acompanha o estado escalonado, sem pular etapa", async () => {
    const { db, events } = setup();
    await seedDemoTrack(db as never, ctx, spec);
    const byDeliverable = new Map<string, string[]>();
    for (const e of events) {
      const k = String(e.deliverableId);
      byDeliverable.set(k, [...(byDeliverable.get(k) ?? []), String(e.action)]);
    }
    const valid = [
      [],
      ["START"],
      ["START", "SUBMIT"],
      ["START", "SUBMIT", "APPROVE"],
    ];
    for (const actions of byDeliverable.values()) {
      expect(valid).toContainEqual(actions);
    }
  });

  it("não deixa a sequência abaixo do maior código semeado", async () => {
    const { db } = setup();
    await seedDemoTrack(db as never, ctx, spec);
    const arg = db.scaffoldSequence.upsert.mock.calls[0]?.[0] as {
      update: { next: number };
    };
    expect(arg.update.next).toBeGreaterThan(104);
  });
});
