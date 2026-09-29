import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NAV, TITLES } from "@/components/scaffold/nav";

// PDF p.3 / SC-PO-07: "Biblioteca de templates" vira "Versões e overlays". O
// nome é provisório (Norte), a rota `templates` continua a mesma.

const h = vi.hoisted(() => ({ listTemplates: vi.fn() }));

vi.mock("@/app/(scaffold)/actions/templates", () => ({
  listTemplates: h.listTemplates,
  publishVersion: vi.fn(),
  saveOverlay: vi.fn(),
  resolveConflict: vi.fn(),
  getTemplate: vi.fn(),
}));

import TemplatesScreen from "@/components/scaffold/screens/templates";

beforeEach(() => {
  h.listTemplates.mockResolvedValue({ ok: true, data: [] });
});

describe("Versões e overlays", () => {
  it("o menu e o título da aba usam o nome novo, na mesma rota", () => {
    expect(TITLES.templates?.[0]).toBe("Versões e overlays");
    const item = NAV.flatMap((s) => s.items).find((i) => i.id === "templates");
    expect(item?.label).toBe("Versões e overlays");
  });

  it("o nome antigo não sobra em lugar nenhum da navegação", () => {
    const all = [
      ...Object.values(TITLES).flat(),
      ...NAV.flatMap((s) => s.items.map((i) => i.label)),
    ];
    expect(all.join("|")).not.toMatch(/Biblioteca de templates/);
  });

  it("a tela se chama Versões e overlays", async () => {
    render(<TemplatesScreen />);
    expect(
      await screen.findByRole("heading", { name: "Versões e overlays" })
    ).toBeDefined();
    expect(screen.queryByText("Biblioteca de templates")).toBeNull();
  });
});
