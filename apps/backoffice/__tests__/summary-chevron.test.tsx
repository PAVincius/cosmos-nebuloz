/** @vitest-environment jsdom */
// summary-chevron.test.tsx — `<summary>` com `listStyle: none` precisa de
// outro sinal de que expande.
//
// O `<details>` nativo já dá teclado e `aria-expanded` de graça; o que sumiu
// com o `listStyle: none` foi o triângulo, e a linha passou a parecer texto
// estático. Volta um chevron (SVG de traço único do kit, sem emoji) que gira
// quando o `details` abre — o giro é CSS em `details[open]`, sem estado.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuditTimeline } from "@/app/(staff)/clientes/[slug]/observabilidade";
import type { AuditEventoRow } from "@/app/actions/audit";

const mocks = vi.hoisted(() => ({
  listAuditEvents: vi.fn(),
  listAuditTenants: vi.fn(),
}));

vi.mock("@/app/actions/audit", () => ({
  listAuditEvents: mocks.listAuditEvents,
  listAuditTenants: mocks.listAuditTenants,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/audit",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const EVENTO: AuditEventoRow = {
  action: "tenant.module.suspend",
  alvo: "COSMOS",
  ator: "vini",
  diff: null,
  entityId: "e1",
  entityType: "TenantModule",
  id: "ev-1",
  quando: "2026-09-01T12:00:00.000Z",
  semDiff: true,
  tenantNome: "Acme",
  tenantSlug: "acme",
};

function chevronDe(summary: Element): SVGElement | null {
  return summary.querySelector("svg.bo-chevron");
}

describe("summary com chevron", () => {
  it("audit explorer: cada linha tem um chevron SVG dentro do summary", async () => {
    mocks.listAuditTenants.mockResolvedValue({ data: [], ok: true });
    mocks.listAuditEvents.mockResolvedValue({
      data: { eventos: [EVENTO], pagina: 1, porPagina: 50, total: 1 },
      ok: true,
    });
    const { default: Page } = await import("@/app/(staff)/audit/page");
    const { container } = render(
      await Page({ searchParams: Promise.resolve({}) })
    );

    const summary = container.querySelector("details > summary") as Element;
    expect(summary).toBeTruthy();
    const chevron = chevronDe(summary);
    expect(chevron).toBeTruthy();
    expect(chevron?.getAttribute("aria-hidden")).toBe("true");
    expect(summary.textContent).not.toMatch(/[▸▾▶▼➤]/);
  });

  it("observabilidade do cliente: idem, e o chevron é a primeira coisa da linha", () => {
    const { container } = render(
      <AuditTimeline
        eventos={[
          {
            action: EVENTO.action,
            alvo: EVENTO.alvo,
            ator: EVENTO.ator,
            diff: null,
            entityId: EVENTO.entityId,
            entityType: EVENTO.entityType,
            id: EVENTO.id,
            quando: EVENTO.quando,
            semDiff: true,
          },
        ]}
      />
    );

    const summary = container.querySelector("details > summary") as Element;
    const chevron = chevronDe(summary);
    expect(chevron).toBeTruthy();
    expect(summary.firstElementChild).toBe(chevron);
    expect(screen.getByText("tenant.module.suspend")).toBeTruthy();
  });
});
