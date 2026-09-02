import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Biblioteca de templates — ST-01..ST-04.
//
// As três regras que este arquivo protege são regras sobre o QUE NÃO ACONTECE:
//
//   ST-01  Publicar não atualiza nada.
//   ST-02  Publicar não sobrescreve customização em silêncio.
//   ST-03  Publicar não toca em trilha em curso.
//
// Regra negativa é a mais fácil de quebrar sem perceber, porque nada falha na
// hora — a trilha do cliente só muda debaixo dele semanas depois.

const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  templateFindUnique: vi.fn(),
  templateFindMany: vi.fn(),
  versionFindUnique: vi.fn(),
  versionFindFirst: vi.fn(),
  versionCreate: vi.fn(),
  overlayFindMany: vi.fn(),
  overlayUpsert: vi.fn(),
  overlayUpdate: vi.fn(),
  conflictCreate: vi.fn(),
  conflictDeleteMany: vi.fn(),
  conflictFindFirst: vi.fn(),
  conflictUpdate: vi.fn(),
  conflictCount: vi.fn(),
  trackGroupBy: vi.fn(),
  trackCreate: vi.fn(),
  sequenceUpsert: vi.fn(),
  promotionFindFirst: vi.fn(),
  promotionUpdate: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/scaffold/guards", () => ({
  requireScaffoldPermissionContext: h.requirePerm,
  requireScaffoldContext: h.requirePerm,
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      scaffoldTemplate: {
        findUnique: h.templateFindUnique,
        findMany: h.templateFindMany,
      },
      scaffoldTemplateVersion: {
        findUnique: h.versionFindUnique,
        findFirst: h.versionFindFirst,
        create: h.versionCreate,
      },
      scaffoldTemplateOverlay: {
        findMany: h.overlayFindMany,
        upsert: h.overlayUpsert,
        update: h.overlayUpdate,
      },
      scaffoldOverlayConflict: {
        create: h.conflictCreate,
        deleteMany: h.conflictDeleteMany,
        findFirst: h.conflictFindFirst,
        update: h.conflictUpdate,
        count: h.conflictCount,
      },
      scaffoldTrack: { groupBy: h.trackGroupBy, create: h.trackCreate },
      scaffoldSequence: { upsert: h.sequenceUpsert },
      meridianGapPromotion: {
        findFirst: h.promotionFindFirst,
        update: h.promotionUpdate,
      },
      auditLog: { create: h.auditCreate },
    }),
}));

import {
  publishVersion,
  resolveConflict,
  saveOverlay,
} from "@/app/(scaffold)/actions/templates";
import { createTrackFromGap } from "@/app/(scaffold)/actions/tracks";

const CTX = {
  tenantId: "t1",
  userId: "u1",
  role: "ADMIN",
  scaffoldRole: "CONSULTANT",
  user: { name: "Marina", email: "m@x.com" },
};

const TPL = "clx00000000000000000tpl01";
const V3 = "clx000000000000000000v003";
const V4 = "clx000000000000000000v004";
const OVL = "clx00000000000000000ovl01";

const PILOT_STEPS = [
  {
    phase: "PILOT" as const,
    key: "run-pilot",
    statement: "Rodar o piloto em 20% do volume",
    expectedArtefact: "Log do piloto",
    required: true,
  },
];

/** v3 sem o critério de rollback; v4 com ele. O caso do protótipo. */
function shape(withRollback: boolean) {
  return {
    id: withRollback ? V4 : V3,
    templateId: TPL,
    label: withRollback ? "v4" : "v3",
    steps: [
      {
        key: "run-pilot",
        statement: "Rodar o piloto em 20% do volume",
        required: true,
        expectedArtefact: "Log do piloto",
        seq: 1,
      },
    ],
    criteria: [
      {
        key: "beats-baseline",
        statement: "Piloto vence o baseline",
        evaluationType: "MANUAL",
        seq: 1,
      },
      ...(withRollback
        ? [
            {
              key: "rollback-tested-prod",
              statement: "Rollback testado em produção ao menos uma vez",
              evaluationType: "MANUAL",
              seq: 2,
            },
          ]
        : []),
    ],
  };
}

const VANTA_OPS = [
  {
    op: "ADD" as const,
    target: "criterion" as const,
    key: "rollback-tested-prod",
    patch: { statement: "Rollback validado em staging com volume espelhado" },
  },
];

type VersionWhere = { where: { id?: string; templateId_label?: unknown } };

/**
 * Duas consultas diferentes caem no mesmo mock: a checagem de rótulo duplicado
 * (`where: { templateId_label }`) e a carga da forma (`where: { id }`). Sem
 * discriminar, a checagem de duplicata acha versão em toda publicação.
 *
 * `v4Exists` diz se a v4 já foi criada — é o que faz a reaplicação do overlay
 * enxergar o critério de rollback que ela acrescentou.
 */
function versionLookup(v4Exists: boolean) {
  return ({ where }: VersionWhere) => {
    if (where.templateId_label) {
      return Promise.resolve(null);
    }
    if (v4Exists && where.id === V4) {
      return Promise.resolve(shape(true));
    }
    return Promise.resolve(shape(false));
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.requirePerm.mockResolvedValue(CTX);
  h.templateFindUnique.mockResolvedValue({
    id: TPL,
    name: "Triagem de suporte",
    versions: [{ id: V3, label: "v3" }],
  });
  // Duas consultas diferentes caem neste mock: a checagem de rótulo duplicado
  // (`where: { templateId_label }`) e a carga da forma (`where: { id }`). Sem
  // discriminar, a checagem de duplicata acha versão em toda publicação.
  h.versionFindUnique.mockImplementation(versionLookup(false));
  h.versionFindFirst.mockResolvedValue(null);
  h.versionCreate.mockResolvedValue({ id: V4, label: "v4" });
  h.overlayFindMany.mockResolvedValue([]);
  h.overlayUpsert.mockResolvedValue({ id: OVL });
  h.overlayUpdate.mockResolvedValue({});
  h.conflictCreate.mockResolvedValue({ id: "cf1" });
  h.conflictDeleteMany.mockResolvedValue({ count: 0 });
  h.conflictUpdate.mockResolvedValue({});
  h.conflictCount.mockResolvedValue(0);
  h.trackGroupBy.mockResolvedValue([]);
  h.auditCreate.mockResolvedValue({});
});

// ── ST-01 ────────────────────────────────────────────────────────────────────

describe("ST-01 — versão publicada é imutável", () => {
  it("publicar CRIA versão, nunca atualiza", async () => {
    const res = await publishVersion({
      templateId: TPL,
      label: "v4",
      note: "Rollback em produção virou critério de gate do Pilot",
      steps: PILOT_STEPS,
      criteria: [],
    });
    expect(res.ok).toBe(true);
    expect(h.versionCreate).toHaveBeenCalledTimes(1);
  });

  it("recusa republicar o mesmo rótulo", async () => {
    // É a violação de ST-01 mais fácil de cometer sem perceber: republicar a
    // "v4" com conteúdo diferente reescreveria o método sob o qual trilhas já
    // rodam.
    h.versionFindUnique.mockImplementation(({ where }: VersionWhere) =>
      Promise.resolve(where.templateId_label ? { id: V4 } : shape(false))
    );
    const res = await publishVersion({
      templateId: TPL,
      label: "v4",
      note: "Tentativa de republicar o mesmo rótulo",
      steps: PILOT_STEPS,
      criteria: [],
    });
    expect(res).toMatchObject({ ok: false, code: "VERSION_IMMUTABLE" });
    expect(h.versionCreate).not.toHaveBeenCalled();
  });

  it("o modelo não tem updatedAt — imutabilidade é forma, não checagem", () => {
    const schema = readFileSync(
      join(
        import.meta.dirname,
        "..",
        "..",
        "..",
        "..",
        "packages",
        "database",
        "prisma",
        "schema",
        "scaffold.prisma"
      ),
      "utf8"
    );
    const model = schema.slice(
      schema.indexOf("model ScaffoldTemplateVersion {"),
      schema.indexOf("model ScaffoldStepTemplate {")
    );
    expect(model).not.toMatch(/^\s+updatedAt/m);
  });
});

// ── ST-03 ────────────────────────────────────────────────────────────────────

describe("ST-03 — trilha em curso não é afetada por publicação", () => {
  it("nenhuma escrita de publicação alcança ScaffoldStepInstance", () => {
    // Estático de propósito: um teste de comportamento passaria numa base onde
    // ninguém escreveu a chamada AINDA. Este falha no momento em que alguém a
    // escrever.
    const raw = readFileSync(
      join(
        import.meta.dirname,
        "..",
        "..",
        "app",
        "(scaffold)",
        "actions",
        "templates.ts"
      ),
      "utf8"
    );
    // Comentários fora: a linha que EXPLICA a regra não pode acusar violação.
    // Mesmo erro que `gates-architecture.test.ts` cometeu na primeira versão.
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(src).not.toMatch(
      /scaffoldStepInstance\s*\.\s*(update|delete|create)/
    );
    expect(src).not.toMatch(
      /scaffoldPhaseInstance\s*\.\s*(update|delete|create)/
    );
  });

  it("publicar com overlays existentes não toca em trilha", async () => {
    h.overlayFindMany.mockResolvedValue([
      {
        id: OVL,
        name: "Overlay Vanta",
        baseVersionId: V3,
        ops: VANTA_OPS,
        baseVersion: { id: V3, label: "v3" },
      },
    ]);
    h.versionFindUnique.mockImplementation(versionLookup(true));
    await publishVersion({
      templateId: TPL,
      label: "v4",
      note: "Rollback em produção virou critério de gate do Pilot",
      steps: PILOT_STEPS,
      criteria: [],
    });
    expect(h.trackCreate).not.toHaveBeenCalled();
  });
});

// ── ST-02 ────────────────────────────────────────────────────────────────────

describe("ST-02 — o conflito da Vanta", () => {
  beforeEach(() => {
    h.overlayFindMany.mockResolvedValue([
      {
        id: OVL,
        name: "Overlay Vanta",
        baseVersionId: V3,
        ops: VANTA_OPS,
        baseVersion: { id: V3, label: "v3" },
      },
    ]);
    // A v4 recém-criada tem o critério; a v3 base não.
    h.versionFindUnique.mockImplementation(versionLookup(true));
  });

  it("publicar a v4 grava conflito contra o overlay da Vanta", async () => {
    const res = await publishVersion({
      templateId: TPL,
      label: "v4",
      note: "Rollback em produção virou critério de gate do Pilot",
      steps: PILOT_STEPS,
      criteria: [],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.conflicts).toHaveLength(1);
      expect(res.data.conflicts[0]).toMatchObject({
        overlayName: "Overlay Vanta",
        targetKey: "rollback-tested-prod",
      });
    }
    expect(h.conflictCreate).toHaveBeenCalledTimes(1);
  });

  it("publicar NÃO falha por causa do conflito — o método não fica refém", async () => {
    // O método novo é decisão da Nebuloz. O que trava é criar trilha com o
    // overlay em conflito, não publicar.
    const res = await publishVersion({
      templateId: TPL,
      label: "v4",
      note: "Rollback em produção virou critério de gate do Pilot",
      steps: PILOT_STEPS,
      criteria: [],
    });
    expect(res.ok).toBe(true);
    expect(h.versionCreate).toHaveBeenCalledTimes(1);
  });

  it("nada é sobrescrito: o overlay continua com as operações dele", async () => {
    await publishVersion({
      templateId: TPL,
      label: "v4",
      note: "Rollback em produção virou critério de gate do Pilot",
      steps: PILOT_STEPS,
      criteria: [],
    });
    expect(h.overlayUpdate).not.toHaveBeenCalled();
  });
});

describe("saveOverlay", () => {
  it("descarta conflitos antigos ao reescrever as operações", async () => {
    // O cliente reescreveu o overlay: a discordância antiga pode nem existir
    // mais. Mantê-la faria ele resolver conflito de uma versão que ele próprio
    // já substituiu.
    await saveOverlay({
      templateId: TPL,
      baseVersionId: V3,
      name: "Overlay Vanta",
      ops: VANTA_OPS,
    });
    expect(h.conflictDeleteMany).toHaveBeenCalledTimes(1);
  });

  it("já detecta conflito contra a versão mais recente ao salvar", async () => {
    // Se o cliente escreve sobre a v3 quando a v4 já existe, o conflito
    // aparece agora — não na próxima publicação, semanas depois.
    h.versionFindFirst.mockResolvedValue({ id: V4 });
    h.versionFindUnique.mockImplementation(versionLookup(true));
    const res = await saveOverlay({
      templateId: TPL,
      baseVersionId: V3,
      name: "Overlay Vanta",
      ops: VANTA_OPS,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.conflicts).toHaveLength(1);
    }
  });

  it("overlay sobre a versão mais recente não gera conflito", async () => {
    h.versionFindFirst.mockResolvedValue({ id: V3 });
    const res = await saveOverlay({
      templateId: TPL,
      baseVersionId: V3,
      name: "Overlay Vanta",
      ops: VANTA_OPS,
    });
    if (res.ok) {
      expect(res.data.conflicts).toEqual([]);
    }
    expect(h.conflictCreate).not.toHaveBeenCalled();
  });
});

describe("resolveConflict", () => {
  const CONFLICT = {
    id: "cf1",
    overlayId: OVL,
    againstVersionId: V4,
    targetType: "criterion",
    targetKey: "rollback-tested-prod",
    overlay: { id: OVL, name: "Overlay Vanta", ops: VANTA_OPS },
  };

  it("keep_overlay mantém as operações intactas", async () => {
    h.conflictFindFirst.mockResolvedValue(CONFLICT);
    const res = await resolveConflict({
      conflictId: "clx00000000000000000cf01",
      resolution: "keep_overlay",
    });
    expect(res.ok).toBe(true);
    expect(h.overlayUpdate).not.toHaveBeenCalled();
    expect(h.conflictUpdate.mock.calls[0][0].data.resolvedAt).toBeInstanceOf(
      Date
    );
  });

  it("take_upstream remove a operação e rebaseia na versão nova", async () => {
    h.conflictFindFirst.mockResolvedValue(CONFLICT);
    await resolveConflict({
      conflictId: "clx00000000000000000cf01",
      resolution: "take_upstream",
    });
    const data = h.overlayUpdate.mock.calls[0][0].data;
    expect(data.ops).toEqual([]);
    expect(data.baseVersionId).toBe(V4);
  });

  it("drop_operation remove a operação sem rebasear", async () => {
    h.conflictFindFirst.mockResolvedValue(CONFLICT);
    await resolveConflict({
      conflictId: "clx00000000000000000cf01",
      resolution: "drop_operation",
    });
    const data = h.overlayUpdate.mock.calls[0][0].data;
    expect(data.ops).toEqual([]);
    expect(data.baseVersionId).toBeUndefined();
  });
});

// ── ST-02, do lado da trilha ─────────────────────────────────────────────────

describe("overlay com conflito pendente não gera trilha", () => {
  const INPUT = {
    gapId: "clx000000000000000000g001",
    promotionId: "clx000000000000000000p001",
    templateId: TPL,
    overlayId: "clx00000000000000000ovl1",
    processName: "Triagem de autorizações prévias",
    ownerId: "clx000000000000000000o001",
  };

  beforeEach(() => {
    h.promotionFindFirst.mockResolvedValue({
      id: "clx000000000000000000p001",
      targetEntityId: null,
      targetProduct: "SCAFFOLD",
    });
    h.versionFindFirst.mockResolvedValue({
      id: V3,
      label: "v3",
      steps: [],
    });
    h.sequenceUpsert.mockResolvedValue({ next: 2 });
    h.trackCreate.mockResolvedValue({ id: "trk1", code: "TR-001" });
    h.promotionUpdate.mockResolvedValue({});
  });

  it("recusa com OVERLAY_HAS_UNRESOLVED_CONFLICT", async () => {
    h.conflictCount.mockResolvedValue(1);
    const res = await createTrackFromGap(INPUT);
    expect(res).toMatchObject({
      ok: false,
      code: "OVERLAY_HAS_UNRESOLVED_CONFLICT",
    });
    expect(h.trackCreate).not.toHaveBeenCalled();
  });

  it("aceita quando o conflito foi resolvido", async () => {
    h.conflictCount.mockResolvedValue(0);
    const res = await createTrackFromGap(INPUT);
    expect(res.ok).toBe(true);
  });

  it("trilha sem overlay não consulta conflito", async () => {
    const { overlayId: _ignored, ...semOverlay } = INPUT;
    const res = await createTrackFromGap(semOverlay);
    expect(res.ok).toBe(true);
    expect(h.conflictCount).not.toHaveBeenCalled();
  });

  it("ST-04 — a trilha guarda versão E overlay, em duas colunas", async () => {
    h.conflictCount.mockResolvedValue(0);
    await createTrackFromGap(INPUT);
    expect(h.trackCreate.mock.calls[0][0].data).toMatchObject({
      templateVersionId: V3,
      overlayId: INPUT.overlayId,
    });
  });
});
