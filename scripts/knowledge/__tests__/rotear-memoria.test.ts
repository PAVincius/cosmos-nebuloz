import { describe, expect, it } from "vitest";
import { rotear } from "../rotear-memoria.mts";

// Nomes reais de .claude/completions em 2026-09-03.
const casos: [string, string][] = [
  ["2026-08-28-meridian-diagnose.md", "meridian"],
  ["2026-07-30-charter-case-detail-risk-screens.md", "charter"],
  ["2026-07-30-charter-e2e.md", "charter"],
  ["2026-09-02-scaffold-us2-gate-engine.md", "scaffold"],
  ["2026-09-02-scaffold-mvp-ligacao-meridian.md", "scaffold"],
  ["2026-05-26-kanban-card-review.md", "cosmos"],
  ["2026-06-10-stories-021-025-pi-planning.md", "cosmos"],
  ["2026-07-27-epic-drilldown-story-task.md", "cosmos"],
  ["2026-06-09-meeting-intelligence-foundation.md", "cosmos"],
  ["2026-07-19-cosmos-6-screens.md", "cosmos"],
  ["2026-06-11-story-028.md", "cosmos"],
  ["2026-06-10-story-034-lgpd-audit-isolation.md", "plataforma"],
  ["2026-06-10-story-038-rbac-enforcement.md", "plataforma"],
  ["2026-07-28-isolamento-tenant.md", "plataforma"],
  ["2026-07-28-seed-entrypoint-guard.md", "plataforma"],
  ["2026-06-10-ci-green-step-c.md", "compartilhado"],
  ["2026-05-31-ux-lab-cosmos.md", "cosmos"],
  ["2026-09-16-backoffice-financeiro.md", "backoffice"],
  ["2026-09-02-signal-fundacao.md", "signal"],
];

describe("rotear", () => {
  it.each(casos)("%s → %s", (nome, esperado) => {
    expect(rotear(nome).destino).toBe(esperado);
  });

  it("a primeira lista que casa decide: scaffold-mvp-ligacao-meridian é scaffold, não meridian", () => {
    expect(rotear("2026-09-02-scaffold-mvp-ligacao-meridian.md").destino).toBe(
      "scaffold"
    );
  });

  it("story-034-lgpd: 'story-0' é cosmos mas 'lgpd' é plataforma — quem vence?", () => {
    // A ordem das listas em PALAVRAS_CHAVE põe plataforma antes de cosmos; "lgpd" casa lá primeiro.
    expect(rotear("2026-06-10-story-034-lgpd-audit-isolation.md").destino).toBe(
      "plataforma"
    );
  });

  it("título conta quando o nome não diz nada", () => {
    expect(
      rotear("2026-09-01-nota.md", "Ajuste no Charter interno").destino
    ).toBe("charter");
  });

  it("é case-insensitive", () => {
    expect(rotear("MERIDIAN-Rollout.md").destino).toBe("meridian");
  });

  it("sem palavra-chave vai para compartilhado com motivo explícito", () => {
    const r = rotear("2026-01-01-nada.md");
    expect(r).toEqual({
      destino: "compartilhado",
      motivo: "sem palavra-chave",
    });
  });

  it("motivo é o termo que casou", () => {
    expect(rotear("x-wsjf-y.md").motivo).toBe("wsjf");
  });
});
