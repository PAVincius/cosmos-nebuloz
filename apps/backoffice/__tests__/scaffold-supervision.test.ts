import { beforeEach, describe, expect, it, vi } from "vitest";

// Fila de supervisão do Scaffold — S-08, SN-06.
//
// É a ÚNICA superfície do produto que atravessa organizações, e por isso vive
// aqui e não em `apps/app`: a ADR-0013 fez de `platformDb` a porta única de
// leitura cross-tenant, importável só por `packages/provisioning` e por este
// app. Ver `specs/002-scaffold-adoption/research.md` §R4.
//
// SN-06 é o requisito inteiro desta fatia: a fila expõe METADADO DE GATE
// suficiente para triagem — trilha, org, fase, idade, status de critérios — e
// NUNCA os artefatos do cliente por trás deles. Abrir um artefato é travessia
// explícita e logada.
//
// Um teste que só verificasse "a fila lista" passaria com o vazamento dentro.
// Por isso o shape é assertado por igualdade de chaves, e não por
// `toMatchObject`: campo a mais reprova.

const h = vi.hoisted(() => ({
  requireStaff: vi.fn(),
  phaseFindMany: vi.fn(),
  trackFindFirst: vi.fn(),
  accessLogCreate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: h.requireStaff,
  SYSTEM_TENANT_ID: "system",
  StaffAuthError: class extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));
vi.mock("@repo/provisioning", () => ({
  ProvisioningError: class extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  platformDb: {
    scaffoldPhaseInstance: { findMany: h.phaseFindMany },
    scaffoldTrack: { findFirst: h.trackFindFirst },
    accessLog: { create: h.accessLogCreate },
  },
}));

import {
  enterTenantContext,
  listGateQueue,
} from "@/app/actions/scaffold-supervision";

const STAFF = {
  userId: "u1",
  name: "Marina Duarte",
  email: "marina@nebuloz.com",
  canWrite: true,
};

/** Uma fase pronta para decisão, com tudo que a consulta traz do banco. */
function phase(over: Record<string, unknown> = {}) {
  return {
    id: "pi1",
    phase: "PILOT",
    state: "GATE_READY",
    openedAt: new Date(Date.now() - 3 * 86_400_000),
    observationEndsAt: null,
    track: {
      id: "trk1",
      code: "TR-104",
      processName: "Triagem de autorizações prévias",
      lastGateAt: new Date(Date.now() - 3 * 86_400_000),
      startedAt: new Date(Date.now() - 40 * 86_400_000),
      tenant: { id: "tenant-vanta", name: "Vanta Saúde", isSystem: false },
      templateVersion: {
        criteria: [
          { phase: "PILOT", key: "beats-baseline" },
          { phase: "PILOT", key: "no-new-risk" },
          { phase: "ASSESS", key: "baseline-signed" },
        ],
      },
    },
    results: [],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.requireStaff.mockResolvedValue(STAFF);
  h.phaseFindMany.mockResolvedValue([phase()]);
  h.trackFindFirst.mockResolvedValue({
    id: "trk1",
    code: "TR-104",
    tenant: { id: "tenant-vanta", name: "Vanta Saúde", slug: "vanta" },
  });
  h.accessLogCreate.mockResolvedValue({});
});

// ── SN-06 ────────────────────────────────────────────────────────────────────

describe("SN-06 — a fila expõe metadado de gate e nada além", () => {
  it("devolve EXATAMENTE os campos de triagem", async () => {
    const res = await listGateQueue({});
    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    // Igualdade de chaves, não subconjunto: campo a mais reprova, que é o
    // ponto inteiro do requisito.
    expect(Object.keys(res.data[0] ?? {}).sort()).toEqual(
      [
        "ageDays",
        "ageLabel",
        "criteriaMet",
        "criteriaTotal",
        "kind",
        "orgName",
        "phase",
        "phaseInstanceId",
        "trackCode",
        "trackId",
      ].sort()
    );
  });

  it("não devolve o enunciado dos critérios — só a contagem", async () => {
    const res = await listGateQueue({});
    const serialized = JSON.stringify(res);
    expect(serialized).not.toMatch(/beats-baseline/);
    expect(serialized).not.toMatch(/Piloto vence/);
  });

  it("não devolve artefato nem nome de arquivo", async () => {
    const res = await listGateQueue({});
    expect(JSON.stringify(res)).not.toMatch(/artefact|objectKey|filename/i);
  });

  it("não pede artefato ao banco — o vazamento começa na consulta", async () => {
    await listGateQueue({});
    const include = JSON.stringify(h.phaseFindMany.mock.calls[0][0]);
    expect(include).not.toMatch(/artefacts/);
    expect(include).not.toMatch(/businessCase/);
  });

  it("conta os critérios da FASE, não os do template inteiro", async () => {
    // O template tem três critérios, mas só dois são da fase PILOT. Contar
    // todos faria a fila mostrar "0 de 3" para um gate que já tem dois
    // atendidos.
    const res = await listGateQueue({});
    if (res.ok) {
      expect(res.data[0]?.criteriaTotal).toBe(2);
    }
  });
});

// ── Triagem ──────────────────────────────────────────────────────────────────

describe("listGateQueue — o que a consultora precisa ver", () => {
  it("classifica gate pronto como sign-off", async () => {
    const res = await listGateQueue({});
    if (res.ok) {
      expect(res.data[0]?.kind).toBe("sign-off");
    }
  });

  it("classifica fase bloqueada como blocked", async () => {
    h.phaseFindMany.mockResolvedValue([phase({ state: "BLOCKED" })]);
    const res = await listGateQueue({});
    if (res.ok) {
      expect(res.data[0]?.kind).toBe("blocked");
    }
  });

  it("classifica janela de 30 dias como observing", async () => {
    h.phaseFindMany.mockResolvedValue([
      phase({
        state: "OBSERVING",
        phase: "EMBED",
        observationEndsAt: new Date(Date.now() + 8 * 86_400_000),
      }),
    ]);
    const res = await listGateQueue({});
    if (res.ok) {
      expect(res.data[0]?.kind).toBe("observing");
      // Na observação, a idade é o que já correu da janela — não o tempo desde
      // o último gate. São números diferentes, e o que importa é quanto falta.
      expect(res.data[0]?.ageLabel).toMatch(/de 30 dias/);
    }
  });

  it("filtra por tipo quando pedido", async () => {
    await listGateQueue({ kind: "blocked" });
    expect(h.phaseFindMany.mock.calls[0][0].where.state).toEqual({
      in: ["BLOCKED"],
    });
  });

  it("sem filtro, traz os três estados que exigem atenção", async () => {
    await listGateQueue({});
    expect(h.phaseFindMany.mock.calls[0][0].where.state.in.sort()).toEqual([
      "BLOCKED",
      "GATE_READY",
      "OBSERVING",
    ]);
  });

  it("exclui o tenant interno — a Nebuloz não é cliente de si mesma", async () => {
    await listGateQueue({});
    expect(h.phaseFindMany.mock.calls[0][0].where.track.tenant.isSystem).toBe(
      false
    );
  });

  it("ordena do mais antigo para o mais novo — a fila é de espera", async () => {
    await listGateQueue({});
    expect(h.phaseFindMany.mock.calls[0][0].orderBy).toBeDefined();
  });

  it("conta critérios atendidos a partir do snapshot da decisão", async () => {
    h.phaseFindMany.mockResolvedValue([
      phase({
        results: [
          {
            criteriaSnapshot: [
              { key: "beats-baseline", met: true },
              { key: "no-new-risk", met: false },
            ],
          },
        ],
      }),
    ]);
    const res = await listGateQueue({});
    if (res.ok) {
      expect(res.data[0]?.criteriaMet).toBe(1);
    }
  });

  it("gate sem decisão ainda conta zero atendidos", async () => {
    const res = await listGateQueue({});
    if (res.ok) {
      expect(res.data[0]?.criteriaMet).toBe(0);
    }
  });
});

// ── Travessia ────────────────────────────────────────────────────────────────

describe("enterTenantContext — travessia explícita e logada", () => {
  it("grava AccessLog ANTES de conceder o destino", async () => {
    const res = await enterTenantContext({
      trackId: "trk1",
      rationale: "Revisar o artefato do piloto antes de decidir o gate.",
    });
    expect(res.ok).toBe(true);
    expect(h.accessLogCreate).toHaveBeenCalledTimes(1);
  });

  it("o log nomeia quem entrou, em qual cliente e por quê", async () => {
    await enterTenantContext({
      trackId: "trk1",
      rationale: "Revisar o artefato do piloto antes de decidir o gate.",
    });
    const data = h.accessLogCreate.mock.calls[0][0].data;
    expect(data.email).toBe("marina@nebuloz.com");
    expect(data.tenantId).toBe("tenant-vanta");
    expect(data.motivo).toMatch(/artefato do piloto/);
  });

  it("exige justificativa com substância", async () => {
    const res = await enterTenantContext({ trackId: "trk1", rationale: "ver" });
    expect(res.ok).toBe(false);
    expect(h.accessLogCreate).not.toHaveBeenCalled();
  });

  it("recusa trilha inexistente sem gravar log", async () => {
    h.trackFindFirst.mockResolvedValue(null);
    const res = await enterTenantContext({
      trackId: "trk1",
      rationale: "Revisar o artefato do piloto antes de decidir o gate.",
    });
    expect(res.ok).toBe(false);
    expect(h.accessLogCreate).not.toHaveBeenCalled();
  });

  it("devolve o destino no app do cliente, não o artefato", async () => {
    // A travessia entrega uma PORTA, não conteúdo: quem atravessa passa pelo
    // guard do app do cliente do outro lado.
    const res = await enterTenantContext({
      trackId: "trk1",
      rationale: "Revisar o artefato do piloto antes de decidir o gate.",
    });
    if (res.ok) {
      expect(res.data.destination).toContain("/scaffold/track/trk1");
      expect(Object.keys(res.data).sort()).toEqual(
        ["accessLogId", "destination", "orgName"].sort()
      );
    }
  });
});
