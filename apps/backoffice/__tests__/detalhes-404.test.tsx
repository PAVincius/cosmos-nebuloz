/** @vitest-environment jsdom */
// detalhes-404.test.tsx — crítica rodada 3, heurística 9: os três detalhes
// ofereciam "Tentar de novo" para um id que não existe. Retry não resolve
// 404; `not-found.tsx` já existe e `clientes/[slug]` já o usa. A leitura
// passa a sinalizar `code: "NOT_FOUND"` e a página chama `notFound()`.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { notFoundMock, staffMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  staffMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: staffMock,
  StaffAuthError: class extends Error {},
}));
// Lê o enum do Prisma via `@repo/database`, que sob jsdom tropeça no guard de
// env do @t3-oss antes de a página renderizar.
vi.mock("@/lib/modulos", () => ({ MODULOS_DA_PLATAFORMA: [] }));

const naoExiste = {
  ok: false as const,
  error: "não existe",
  code: "NOT_FOUND",
};

vi.mock("@/app/actions/services", () => ({
  getServiceDetail: vi.fn(async () => naoExiste),
  listServices: vi.fn(async () => ({ ok: true, data: [] })),
}));
vi.mock("@/app/actions/maturidade", () => ({
  lerAvaliacao: vi.fn(async () => naoExiste),
}));
vi.mock("@/app/actions/proposta-escopo", () => ({
  getPropostaParaEdicao: vi.fn(async () => naoExiste),
}));
vi.mock("@/app/actions/proposals", () => ({
  submitProposalAction: vi.fn(),
}));
vi.mock("@/app/actions/catalogo-comercial", () => ({
  listarCatalogoComercial: vi.fn(async () => ({ ok: true, data: {} })),
}));

beforeEach(() => {
  notFoundMock.mockClear();
  staffMock.mockResolvedValue({ canWrite: true, role: "ADMIN" });
});

describe("detalhes com id inexistente chamam notFound()", () => {
  it("/servicos/[codigo]", async () => {
    const { default: Page } = await import(
      "@/app/(staff)/servicos/[codigo]/page"
    );
    await expect(
      Page({ params: Promise.resolve({ codigo: "nao-existe" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("/growth/readiness/[id]", async () => {
    const { default: Page } = await import(
      "@/app/(staff)/growth/readiness/[id]/page"
    );
    await expect(
      Page({ params: Promise.resolve({ id: "nao-existe" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("/propostas/[id]", async () => {
    const { default: Page } = await import("@/app/(staff)/propostas/[id]/page");
    await expect(
      Page({ params: Promise.resolve({ id: "nao-existe" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});
