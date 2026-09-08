import { beforeEach, describe, expect, it, vi } from "vitest";

// Configuração — US7.
//
// O que estes testes protegem: que as réguas continuem sendo decisão registrada
// e não preferência silenciosa. Mudar `valueBar` muda o veredito de todas as
// iniciativas na próxima leitura — sem trilha, o comitê seguinte veria outro
// número sem nenhuma pista de por quê.

const h = vi.hoisted(() => ({
  requireSignalPermissionContext: vi.fn(),
  withTenantDb: vi.fn(),
  logSignalAudit: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@repo/database", () => ({ withTenantDb: h.withTenantDb }));
vi.mock("@repo/rbac", () => ({
  SIGNAL_ROLE_LABEL: {
    VIEWER: "Leitor",
    OWNER: "Dono",
    ANALYST: "Analista",
    ADMIN: "Administrador",
  },
}));
vi.mock("@/lib/signal/guards", async () => {
  const errors = await vi.importActual<typeof import("@/lib/signal/errors")>(
    "../../../lib/signal/errors"
  );
  return {
    ...errors,
    requireSignalPermissionContext: h.requireSignalPermissionContext,
  };
});
vi.mock("@/app/(signal)/actions/_shared", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/(signal)/actions/_shared")
  >("../../../app/(signal)/actions/_shared");
  return { ...actual, logSignalAudit: h.logSignalAudit };
});

import {
  getSettings,
  setMemberRole,
  updateSettings,
} from "@/app/(signal)/actions/settings";

const CTX = {
  tenantId: "tnt_1",
  userId: "usr_1",
  signalRole: "ADMIN",
  user: { id: "usr_1", name: "Marina", email: "m@vanta.test" },
};

type Db = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
let db: Db;

const stored = (over: Record<string, unknown> = {}) => ({
  adoptionBar: 60,
  valueBar: "1.5",
  lowAdoptionPct: 40,
  lowAdoptionWeeks: 8,
  weakRoi: "1.0",
  staleHours: 48,
  currency: "BRL",
  fiscalYearLabel: "FY26",
  ...over,
});

const valid = {
  adoptionBar: 60,
  valueBar: 1.5,
  lowAdoptionPct: 40,
  lowAdoptionWeeks: 8,
  weakRoi: 1.0,
  staleHours: 48,
  currency: "BRL",
  fiscalYearLabel: "FY26",
};

beforeEach(() => {
  vi.clearAllMocks();
  h.requireSignalPermissionContext.mockResolvedValue(CTX);
  db = {
    signalSettings: {
      findUnique: vi.fn().mockResolvedValue(stored()),
      upsert: vi.fn().mockResolvedValue({}),
    },
    signalMember: {
      findUnique: vi.fn().mockResolvedValue({
        id: "sm_1",
        role: "VIEWER",
        user: { name: "Rafael", email: "r@vanta.test" },
      }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  h.withTenantDb.mockImplementation(
    (_tenantId: string, fn: (d: Db) => unknown) => fn(db)
  );
});

describe("limites são regra do schema, não do formulário", () => {
  it("recusa adoptionBar acima de 100", async () => {
    const res = await updateSettings({ ...valid, adoptionBar: 140 });

    expect(res.ok).toBe(false);
    expect(db.signalSettings.upsert).not.toHaveBeenCalled();
  });

  it("recusa adoptionBar negativo", async () => {
    const res = await updateSettings({ ...valid, adoptionBar: -1 });

    expect(res.ok).toBe(false);
  });

  it("recusa régua de valor zerada — zero aceitaria qualquer retorno", async () => {
    const res = await updateSettings({ ...valid, valueBar: 0 });

    expect(res.ok).toBe(false);
  });

  it("recusa limiar de adoção baixa acima da barra de adoção", async () => {
    // Assim o alerta LOW acusaria de baixa uma iniciativa que a régua da mesma
    // organização considera adotada.
    const res = await updateSettings({
      ...valid,
      adoptionBar: 50,
      lowAdoptionPct: 70,
    });

    expect(res.ok === false && res.rule).toBe("settings.bars.order");
    expect(db.signalSettings.upsert).not.toHaveBeenCalled();
  });
});

describe("mudar régua vai para a trilha", () => {
  it("grava o de → para de valueBar", async () => {
    const res = await updateSettings({ ...valid, valueBar: 2.5 });

    expect(res.ok).toBe(true);
    const diff = h.logSignalAudit.mock.calls[0][2].diff;
    expect(diff).toContainEqual(["Régua de valor", "1.5", "2.5"]);
  });

  it("não polui a trilha com campos que não mudaram", async () => {
    await updateSettings({ ...valid, valueBar: 2.5 });

    const diff = h.logSignalAudit.mock.calls[0][2].diff;
    expect(diff).toHaveLength(1);
  });

  it("não grava veredito: ele é derivado na leitura", async () => {
    await updateSettings({ ...valid, valueBar: 2.5 });

    const data = db.signalSettings.upsert.mock.calls[0][0].update;
    expect(Object.keys(data)).not.toContain("verdict");
  });

  it("revalida as telas que dependem das réguas", async () => {
    await updateSettings({ ...valid, valueBar: 2.5 });

    const paths = h.revalidatePath.mock.calls.map((c) => c[0]);
    expect(paths).toContain("/signal/overview");
    expect(paths).toContain("/signal/initiatives");
    expect(paths).toContain("/signal/alerts");
  });
});

describe("getSettings", () => {
  it("devolve os padrões quando a organização ainda não configurou", async () => {
    db.signalSettings.findUnique.mockResolvedValue(null);

    const res = await getSettings();

    expect(res.ok && res.data.adoptionBar).toBe(60);
    expect(res.ok && res.data.valueBar).toBe(1.5);
  });

  it("converte Decimal para número — a tela não formata string de banco", async () => {
    const res = await getSettings();

    expect(res.ok && res.data.valueBar).toBe(1.5);
    expect(res.ok && res.data.weakRoi).toBe(1);
  });
});

describe("setMemberRole", () => {
  it("muda o papel e grava a trilha", async () => {
    const res = await setMemberRole({ userId: "usr_2", role: "ANALYST" });

    expect(res.ok).toBe(true);
    expect(db.signalMember.update.mock.calls[0][0].data.role).toBe("ANALYST");
    expect(h.logSignalAudit.mock.calls[0][2].diff).toEqual([
      ["Papel", "Leitor", "Analista"],
    ]);
  });

  it("impede rebaixar a si mesmo", async () => {
    const res = await setMemberRole({ userId: "usr_1", role: "VIEWER" });

    expect(res.ok === false && res.rule).toBe("member.self-demote");
    expect(db.signalMember.update).not.toHaveBeenCalled();
  });

  it("recusa quem não faz parte do Signal nesta organização", async () => {
    db.signalMember.findUnique.mockResolvedValue(null);

    const res = await setMemberRole({ userId: "usr_9", role: "ANALYST" });

    expect(res.ok === false && res.rule).toBe("member.not-found");
  });
});
