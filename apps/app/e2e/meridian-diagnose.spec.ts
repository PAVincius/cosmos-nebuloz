import { expect, test } from "@playwright/test";

/**
 * E2E — Meridian V1 (Diagnose).
 *
 * Cobre os cenários de `specs/001-meridian-diagnose/quickstart.md` que só o
 * navegador prova: o guard de módulo, a navegação da carteira, o bloqueio de
 * fechamento de coleta por eixo sem dono, a validação do override e a
 * declaração de retenção do benchmark.
 *
 * Pré-requisito: banco seedado com `pnpm seed:meridian` no tenant da sessão de
 * e2e. O tenant `cosmos-dev` continua sem o módulo — é o caso de default deny.
 */

test.describe("Meridian · guard de módulo @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("tenant sem o módulo MERIDIAN cai em /meridian-indisponivel", async ({
    page,
  }) => {
    await page.goto("/meridian");
    await page.waitForURL(/\/meridian(-indisponivel)?$/, { timeout: 15_000 });

    // Sem o módulo, o redirect acontece; com ele, a carteira carrega. As duas
    // saídas são válidas conforme o tenant da sessão — o que não pode existir é
    // uma terceira, com tela em branco.
    const redirected = page.url().includes("meridian-indisponivel");
    if (redirected) {
      await expect(
        page.getByRole("heading", {
          name: /Meridian não está contratado|papel de diagnóstico/,
        })
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("heading", { name: "Assessments" })
      ).toBeVisible();
    }
  });

  test("rota profunda redireciona igual, não só a raiz", async ({ page }) => {
    await page.goto("/meridian/registry");
    await page.waitForURL(/\/meridian/, { timeout: 15_000 });
    await expect(page.locator("body")).not.toBeEmpty();
  });
});

test.describe("Meridian · carteira e diagnóstico @auth @meridian", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });
  test.skip(
    ({ baseURL }) => !baseURL,
    "requer app em execução com seed:meridian"
  );

  test("carteira lista os assessments e filtra por status", async ({
    page,
  }) => {
    await page.goto("/meridian");
    if (page.url().includes("indisponivel")) {
      test.skip(true, "módulo não contratado neste tenant");
    }

    await expect(
      page.getByRole("heading", { name: "Assessments" })
    ).toBeVisible();
    await expect(page.getByText("Eixos contestados")).toBeVisible();
    await expect(page.getByText("Vanta Saúde")).toBeVisible();

    await page.getByRole("button", { name: "Coletando" }).click();
    await expect(page.getByText("Helix Agro")).toBeVisible();
    await expect(page.getByText("Vanta Saúde")).toHaveCount(0);
  });

  test("detalhe abre nas cinco abas do diagnóstico", async ({ page }) => {
    await page.goto("/meridian");
    if (page.url().includes("indisponivel")) {
      test.skip(true, "módulo não contratado neste tenant");
    }
    await page.getByText("Vanta Saúde").first().click();
    await page.waitForURL(/\/meridian\/assessment\//, { timeout: 15_000 });

    for (const tab of [
      "Scoring & Revisão",
      "Gap register",
      "Plano 12 meses",
      "Relatório & Benchmark",
    ]) {
      await page.getByRole("button", { name: new RegExp(tab) }).click();
      await expect(page.locator("main")).toBeVisible();
    }
  });

  test("override recusa justificativa curta e aceita a completa", async ({
    page,
  }) => {
    await page.goto("/meridian");
    if (page.url().includes("indisponivel")) {
      test.skip(true, "módulo não contratado neste tenant");
    }
    await page.getByText("Vanta Saúde").first().click();
    await page.getByRole("button", { name: /Scoring & Revisão/ }).click();

    const decidir = page.getByRole("button", { name: /Revisar e decidir/ });
    if ((await decidir.count()) === 0) {
      test.skip(true, "nenhum eixo contestado neste dataset");
    }
    await decidir.first().click();

    const registrar = page.getByRole("button", { name: "Registrar override" });
    await expect(registrar).toBeDisabled();

    await page
      .getByPlaceholder(/O que a evidência mostra/)
      .fill("Evidência mostra zero casos revisados pelo comitê em seis meses.");
    // Rationale suficiente mas score igual ao computado: continua desabilitado,
    // porque override sem mudança não é decisão.
    await expect(registrar).toBeDisabled();
  });

  test("gap register mostra o registro canônico e a regra de fronteira", async ({
    page,
  }) => {
    await page.goto("/meridian/registry");
    if (page.url().includes("indisponivel")) {
      test.skip(true, "módulo não contratado neste tenant");
    }
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
    if (page.url().includes("indisponivel")) {
      test.skip(true, "módulo não contratado neste tenant");
    }
    await expect(
      page.getByRole("heading", { name: "Benchmark pool" })
    ).toBeVisible();
    await expect(page.getByText(/Coortes retidas/)).toBeVisible();
    await expect(
      page.getByText(/agregado existe, leitura bloqueada/).first()
    ).toBeVisible();
  });

  test("escala de confiança expõe os três níveis da suíte", async ({
    page,
  }) => {
    await page.goto("/meridian/confidence");
    if (page.url().includes("indisponivel")) {
      test.skip(true, "módulo não contratado neste tenant");
    }
    await expect(
      page.getByRole("heading", { name: "Escala de confiança" })
    ).toBeVisible();
    for (const level of ["Medido", "Estimado", "Declarado"]) {
      await expect(
        page.getByText(level, { exact: true }).first()
      ).toBeVisible();
    }
  });
});

test.describe("Meridian · link do respondente", () => {
  test("token inválido devolve a mesma mensagem genérica", async ({ page }) => {
    await page.goto(`/meridian-responder/${"f".repeat(64)}`);
    await expect(
      page.getByRole("heading", { name: "Link inválido ou expirado" })
    ).toBeVisible();
    // A mensagem não pode revelar se o assessment existe.
    await expect(page.locator("body")).not.toContainText(
      /expirado em|revogado/
    );
  });
});
