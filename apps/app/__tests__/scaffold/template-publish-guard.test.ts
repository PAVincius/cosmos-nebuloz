import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasScaffoldPermission,
  scaffoldDenialReason,
} from "../../../../packages/rbac/src/scaffold-matrix";

// publishVersion escreve numa versão de template GLOBAL (sem tenantId): a mais
// recente vira a base das trilhas novas de todas as organizações. Estes testes
// provam o que NÃO acontece: o ADMIN de um cliente não publica, e nem o
// consultor publica de dentro de um tenant de cliente. O guard aqui é o de
// verdade (matriz real); só a sessão é simulada.

const h = vi.hoisted(() => ({
  role: "ADMIN",
  internal: false,
  asked: [] as string[],
  versionCreate: vi.fn(),
  auditCreate: vi.fn(),
  overlayFindMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/scaffold/guards", () => ({
  requireScaffoldPermissionContext: async (permission: string) => {
    h.asked.push(permission);
    if (!hasScaffoldPermission(h.role as never, permission as never)) {
      throw new Error(scaffoldDenialReason(permission as never));
    }
    return {
      tenantId: "tenantA",
      userId: "u1",
      role: "ADMIN",
      scaffoldRole: h.role,
      user: { name: "Marina", email: "m@x.com" },
    };
  },
}));

const SHAPE = {
  id: "clx000000000000000000v001",
  templateId: "clx00000000000000000tpl01",
  label: "v1",
  steps: [],
  criteria: [],
  deliverables: [],
};

vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      tenant: { findFirst: async () => ({ isInternalTenant: h.internal }) },
      scaffoldTemplate: {
        findUnique: async () => ({
          id: "clx00000000000000000tpl01",
          versions: [],
        }),
      },
      scaffoldTemplateVersion: {
        findUnique: async ({ where }: { where: Record<string, unknown> }) =>
          where.templateId_label ? null : SHAPE,
        create: h.versionCreate,
      },
      scaffoldTemplateOverlay: { findMany: h.overlayFindMany },
      scaffoldOverlayConflict: {
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
      auditLog: { create: h.auditCreate },
    }),
}));

import {
  publishVersion,
  resolveConflict,
  saveOverlay,
} from "@/app/(scaffold)/actions/templates";

const INPUT = {
  templateId: "clx00000000000000000tpl01",
  label: "v2",
  note: "Nova versão do método para teste",
  steps: [
    {
      phase: "PILOT" as const,
      key: "run-pilot",
      statement: "Rodar o piloto",
      expectedArtefact: "Log do piloto",
      required: true,
    },
  ],
  criteria: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.role = "ADMIN";
  h.internal = false;
  h.asked = [];
  h.versionCreate.mockResolvedValue({ id: "v2", label: "v2" });
  h.overlayFindMany.mockResolvedValue([]);
});

describe("publishVersion — método global", () => {
  it("o ADMIN do tenant A é recusado e nada é gravado", async () => {
    const res = await publishVersion(INPUT);
    expect(res.ok).toBe(false);
    expect(h.versionCreate).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("o consultor dentro de um tenant de cliente também é recusado: publicar é da organização interna", async () => {
    h.role = "CONSULTANT";
    h.internal = false;
    const res = await publishVersion(INPUT);
    expect(res).toMatchObject({
      ok: false,
      code: "TEMPLATE_PUBLISH_INTERNAL_ONLY",
    });
    expect(h.versionCreate).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("o consultor no tenant interno publica", async () => {
    h.role = "CONSULTANT";
    h.internal = true;
    const res = await publishVersion(INPUT);
    expect(res.ok).toBe(true);
    expect(h.versionCreate).toHaveBeenCalledTimes(1);
  });
});

describe("overlay é da organização: continua com o ADMIN do cliente", () => {
  it("saveOverlay e resolveConflict pedem overlay.manage, não template.publish", async () => {
    h.role = "ADMIN";
    await saveOverlay({
      templateId: "clx00000000000000000tpl01",
      baseVersionId: "clx000000000000000000v001",
      name: "Overlay do cliente",
      ops: [],
    });
    await resolveConflict({
      conflictId: "clx00000000000000000cf01",
      resolution: "drop_operation",
    });
    expect(h.asked).toEqual(["overlay.manage", "overlay.manage"]);
  });
});
