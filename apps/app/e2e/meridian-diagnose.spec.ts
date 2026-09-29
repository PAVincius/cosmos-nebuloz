import { expect, test } from "@playwright/test";
import { meridianStorageState } from "./setup/auth.setup";

/**
 * E2E — Meridian V1 (Diagnose).
 *
 * Cobre os cenários de `specs/001-meridian-diagnose/quickstart.md` que só o
 * navegador prova: o guard de papel, a navegação da carteira, a validação do
 * override, o grafo de dependências, a declaração de retenção do benchmark e
 * o link do respondente.
 *
 * Duas sessões, de propósito. O admin do e2e tem o módulo contratado mas
 * nenhum `MeridianMembership`, então é ele que prova que o portão fecha; a
 * consultora semeada por `seed-meridian.ts` é quem prova que ele abre. Uma
 * sessão só não conseguiria fazer as duas coisas.
 *
 * Pré-requisito: `globalSetup` roda `seed:meridian cosmos-dev` e salva a
 * sessão da consultora.
 */

test.describe("Meridian · guard de papel @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("admin sem papel de diagnóstico não entra, mesmo com o módulo contratado", async ({
    page,
  }) => {
    await page.goto("/meridian");
    await page.waitForURL(/\/meridian-indisponivel/, { timeout: 30_000 });

    // A mensagem distingue as duas recusas: quem não tem papel resolve com um
    // consultor, quem não tem módulo resolve com quem assina o contrato.
    await expect(
      page.getByRole("heading", { name: /papel de diagnóstico/ })
    ).toBeVisible();
  });

  test("rota profunda é barrada igual, não só a raiz", async ({ page }) => {
    await page.goto("/meridian/registry");
    await page.waitForURL(/\/meridian-indisponivel/, { timeout: 30_000 });
  });
});

test.describe("Meridian · diagnóstico @auth @meridian", () => {
  test.use({ storageState: meridianStorageState("consultant") });

  test("carteira lista os assessments e filtra por status", async ({
    page,
  }) => {
    await page.goto("/meridian");

    await expect(
      page.getByRole("heading", { name: "Assessments" })
    ).toBeVisible();
    await expect(page.getByText("Eixos contestados")).toBeVisible();
    await expect(page.getByText("Vanta Saúde").first()).toBeVisible();

    await page.getByRole("button", { name: "Coletando", exact: true }).click();
    await expect(page.getByText("Helix Agro").first()).toBeVisible();
    await expect(page.getByText("Vanta Saúde")).toHaveCount(0);
  });

  test("detalhe abre em Scoring e mostra o computado ao lado do override", async ({
    page,
  }) => {
    await page.goto("/meridian");
    await page
      .getByRole("button", { name: /Vanta Saúde/ })
      .first()
      .click();
    await page.waitForURL(/\/meridian\/assessment\//, { timeout: 30_000 });

    // "Governance" aparece no card do eixo e de novo na linha do histórico de
    // override — o `.first()` mira o card, que é onde o par computado/final
    // convive.
    await expect(page.getByText("Governance").first()).toBeVisible();
    // O override não esconde o número que ele substituiu — é o que sustenta a
    // resposta a "por que o número mudou?".
    await expect(page.getByText(/computado: \d+/)).toBeVisible();
    await expect(page.getByText("Contestado").first()).toBeVisible();
  });

  test("grafo de dependências renderiza sem derrubar a aba", async ({
    page,
  }) => {
    // Regressão: a lista de arestas entrava nas dependências do efeito de
    // medição e a aba morria com "Maximum update depth exceeded".
    const quebras: string[] = [];
    page.on("pageerror", (e) => quebras.push(e.message));

    await page.goto("/meridian");
    await page
      .getByRole("button", { name: /Vanta Saúde/ })
      .first()
      .click();
    await page.waitForURL(/\/meridian\/assessment\//, { timeout: 30_000 });
    await page.getByRole("button", { name: /Gap register/ }).click();

    await expect(page.getByText("Grafo de dependências")).toBeVisible();
    await expect(page.getByText("Sem pré-requisito")).toBeVisible();
    expect(quebras.filter((m) => /Maximum update depth/.test(m))).toEqual([]);
  });

  test("plano gravado aparece sem precisar regerar", async ({ page }) => {
    await page.goto("/meridian");
    await page
      .getByRole("button", { name: /Vanta Saúde/ })
      .first()
      .click();
    await page.waitForURL(/\/meridian\/assessment\//, { timeout: 30_000 });
    await page.getByRole("button", { name: /Plano 12 meses/ }).click();

    await expect(page.getByText("Plano sequenciado")).toBeVisible();
    await expect(page.getByText("Plano ainda não gerado")).toHaveCount(0);
  });

  test("override recusa justificativa curta e score sem mudança", async ({
    page,
  }) => {
    await page.goto("/meridian");
    await page
      .getByRole("button", { name: /Vanta Saúde/ })
      .first()
      .click();
    await page.waitForURL(/\/meridian\/assessment\//, { timeout: 30_000 });
    await page.getByRole("button", { name: /Revisar e decidir/ }).click();

    const registrar = page.getByRole("button", { name: "Registrar override" });
    await expect(registrar).toBeDisabled();

    // Justificativa suficiente, mas o score continua igual ao computado:
    // override sem mudança não é decisão.
    await page
      .getByPlaceholder(/O que a evidência mostra/)
      .fill("Evidência mostra zero casos revisados pelo comitê em seis meses.");
    await expect(registrar).toBeDisabled();
  });

  test("fila de revisão traz o eixo contestado com o motivo", async ({
    page,
  }) => {
    await page.goto("/meridian/queue");

    await expect(
      page.getByRole("heading", { name: "Fila de revisão" })
    ).toBeVisible();
    await expect(page.getByText(/acima do limiar de \d+/)).toBeVisible();
  });

  test("gap register mostra o registro canônico e a regra de fronteira", async ({
    page,
  }) => {
    await page.goto("/meridian/registry");

    await expect(
      page.getByRole("heading", { name: "Gap register" })
    ).toBeVisible();
    await expect(page.getByText("Custo de atraso parado")).toBeVisible();
    await expect(page.getByText(/origin_gap_id/)).toBeVisible();
  });

  test("benchmark declara a coorte retida em vez de desenhar o gráfico", async ({
    page,
  }) => {
    await page.goto("/meridian/benchmark");

    await expect(
      page.getByRole("heading", { name: "Benchmark pool" })
    ).toBeVisible();
    await expect(page.getByText("Coortes retidas")).toBeVisible();
    await expect(
      page.getByText("agregado existe, leitura bloqueada").first()
    ).toBeVisible();
  });

  test("escala de confiança expõe os três níveis da suíte", async ({
    page,
  }) => {
    await page.goto("/meridian/confidence");

    await expect(
      page.getByRole("heading", { name: "Escala de confiança" })
    ).toBeVisible();
    for (const nivel of ["Medido", "Estimado", "Declarado"]) {
      await expect(
        page.getByText(nivel, { exact: true }).first()
      ).toBeVisible();
    }
  });
});

test.describe("Meridian · link do respondente", () => {
  // Sem sessão de propósito: o respondente não tem conta na plataforma.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("token inválido devolve a mesma mensagem genérica", async ({ page }) => {
    await page.goto(`/meridian-responder/${"f".repeat(64)}`);

    await expect(
      page.getByRole("heading", { name: "Link inválido ou expirado" })
    ).toBeVisible();
    // Não pode revelar se o assessment existe.
    await expect(page.locator("body")).not.toContainText(
      /expirado em|revogado/
    );
  });
});
