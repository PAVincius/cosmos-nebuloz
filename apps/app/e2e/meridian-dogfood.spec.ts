import { expect, test } from "@playwright/test";
import { meridianStorageState } from "./setup/auth.setup";

/**
 * E2E — Meridian dogfood (Ensaio local, plano
 * docs/qualidade/2026-09-23-plano-dogfood-esteira.md · Produto 1).
 *
 * Cobre o fluxo principal de ponta a ponta que `meridian-diagnose.spec.ts`
 * não cobre: responder a bateria até o fim, fechar coleta e rodar scoring,
 * fila de revisão com override+rationale, gap register, plano de 12 meses,
 * relatório e promoção de gap para o Scaffold.
 *
 * Não cobre criar assessment nem convidar respondente pela UI — não existe UI
 * para isso (atrito P0, docs/qualidade/dogfood/meridian/atrito.md). O
 * assessment AS-200 "Solaris Digital" e os quatro primeiros respondentes são
 * plantados por `scripts/seed-meridian.ts` como workaround; só o quinto
 * respondente (eixo Infraestrutura, token fixo abaixo) fica de fato sem
 * resposta, pra este spec completar pelo navegador.
 *
 * Pré-requisito: `globalSetup` roda `seed:meridian cosmos-dev`.
 */

// Mesmo literal de scripts/seed-meridian.ts (DOGFOOD_RESPONDENT_TOKEN) — token
// de teste fixo, não usar em produção.
const DOGFOOD_RESPONDENT_TOKEN =
  "meridian-dogfood-e2e-fixed-token-nao-usar-em-producao";

test.describe("Meridian dogfood · M1/M2 bloqueados pelo atrito P0 @meridian", () => {
  // Não há tela/botão para criar assessment nem para convidar respondente por
  // eixo (atrito P0, docs/qualidade/dogfood/meridian/atrito.md) — confirmado
  // por `grep -rl "createAssessment\|assignRespondent" apps/app/components
  // apps/app/app`: as duas actions (`(meridian)/actions/assessments.ts:348`
  // e `(meridian)/actions/collection.ts:40`) não são importadas por nenhum
  // componente. Corpo abaixo documenta o passo do roteiro
  // (docs/qualidade/dogfood/meridian/roteiro.md M1/M2) para religar assim
  // que a Bussola entregar a tela — não é executado até lá.
  test.use({ storageState: meridianStorageState("consultant") });

  test.fixme(
    "M1 — CEO abre o AS-NBZ-002 pela carteira, do zero (SC-001 início)",
    async ({ page }) => {
      await page.goto("/meridian");
      await page.getByRole("button", { name: /Novo assessment/ }).click();
      await page.getByLabel(/Organização/).selectOption({ label: "Nebuloz" });
      await page.getByLabel(/Versão do template/).selectOption({ index: 0 });
      await page.getByLabel(/Prazo/).fill("2026-12-31");
      await page.getByRole("button", { name: "Criar assessment" }).click();
      await expect(page.getByText("AS-NBZ-002")).toBeVisible();
    }
  );

  test.fixme(
    "M2 — CEO convida dois respondentes por eixo (dez convites)",
    async ({ page }) => {
      await page.goto("/meridian");
      await page.getByText("AS-NBZ-002").click();
      await page.getByRole("button", { name: /Coleta/ }).click();
      for (const axis of [
        "Data",
        "Process",
        "People",
        "Governance",
        "Infrastructure",
      ]) {
        for (const owner of ["fundador", "auditoria de repositório"]) {
          await page
            .getByRole("row", { name: axis })
            .getByRole("button", { name: /Atribuir respondente/ })
            .click();
          await page.getByLabel(/Papel/).selectOption({ label: owner });
          await page.getByRole("button", { name: "Convidar" }).click();
        }
      }
      await expect(page.getByText(/10 respondentes atribuídos/)).toBeVisible();
    }
  );
});

test.describe("Meridian dogfood · respondente completa a bateria @meridian", () => {
  // Sem sessão de propósito: o respondente não tem conta na plataforma.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("responde Infraestrutura, anexa evidência e envia (SC-006)", async ({
    page,
  }) => {
    await page.goto(`/meridian-responder/${DOGFOOD_RESPONDENT_TOKEN}`);

    await expect(
      page.getByText("Bateria de prontidão — Infraestrutura")
    ).toBeVisible();

    // Três perguntas do eixo: Q-I01 (LIKERT), Q-I02 (LIKERT), Q-I03 (YES_NO).
    // Respostas propositalmente baixas: é o que faz o eixo nascer abaixo do
    // limiar (60) e derivar gap na hora do scoring.
    await page
      .getByRole("button", { name: "Discordo forte", exact: true })
      .nth(0)
      .click();
    await page
      .getByRole("button", { name: "Discordo forte", exact: true })
      .nth(1)
      .click();
    await page.getByRole("button", { name: "Não", exact: true }).click();

    // Evidência na primeira pergunta — o input é `hidden`, mas aceita
    // `setInputFiles` do mesmo jeito; é o que o respondente real produz ao
    // clicar "Anexar evidência".
    await page
      .locator('input[type="file"]')
      .nth(0)
      .setInputFiles({
        name: "evidencia-infra.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("evidência de teste — ensaio local do dogfood"),
      });
    await expect(page.getByText("evidencia-infra.txt")).toBeVisible();

    await page.getByRole("button", { name: "Enviar respostas" }).click();
    await expect(page.getByText(/Bateria concluída/)).toBeVisible();
  });
});

test.describe("Meridian dogfood · consultora conduz até promover pro Scaffold @meridian", () => {
  test.use({ storageState: meridianStorageState("consultant") });

  test("fecha coleta, decide o contestado, gera plano, relatório e promove gap (SC-002..004, SC-007, SC-009)", async ({
    page,
  }) => {
    await page.goto("/meridian");
    await page.getByText("Solaris Digital").first().click();
    await page.waitForURL(/\/meridian\/assessment\//, { timeout: 30_000 });

    // Coleta — todos os 5 eixos respondidos (4 pelo seed, 1 pelo teste
    // anterior). Fechar dispara o scoring na mesma transação (FR-013).
    await page
      .getByRole("button", { name: "Fechar coleta e rodar scoring" })
      .click();
    await expect(page.getByText(/scoring executado/)).toBeVisible({
      timeout: 30_000,
    });

    // Scoring & Revisão — Data nasce CONTESTED (Rafael x Bianca divergem).
    await expect(page.getByText(/acima do limiar de \d+/)).toBeVisible();
    await page.getByRole("button", { name: "Revisar e decidir" }).click();

    await page
      .getByPlaceholder(/O que a evidência mostra/)
      .fill(
        "Evidência de campo mostra qualidade de dado abaixo do que o número sugere."
      );
    // Range input não aceita `.fill()` — move o valor e dispara o `input`
    // event que o React escuta, saindo de 50 (computado) para 30.
    await page.getByLabel("Novo score").evaluate((el, value) => {
      (el as HTMLInputElement).value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, "30");
    await page.getByRole("button", { name: "Registrar override" }).click();
    await expect(
      page.getByText(/rationale e revisor na trilha de auditoria/)
    ).toBeVisible();

    // Gap register (aba do assessment) — grafo carrega sem derrubar a aba.
    await page.getByRole("button", { name: /Gap register/ }).click();
    await expect(page.getByText("Grafo de dependências")).toBeVisible();

    // Plano de 12 meses — ainda não gerado neste assessment novo.
    await page.getByRole("button", { name: /Plano 12 meses/ }).click();
    await page.getByRole("button", { name: "Gerar plano de 12 meses" }).click();
    await expect(page.getByText("Plano sequenciado")).toBeVisible({
      timeout: 15_000,
    });

    // Relatório — nasce do scoring, mostra o override marcado, não escondido.
    await page.getByRole("button", { name: /Relatório & Benchmark/ }).click();
    await expect(page.getByText("Shape de prontidão")).toBeVisible();
    await expect(page.getByText(/o que a evidência mostra/i)).toBeVisible();

    // Promover o gap de Infraestrutura (derivado do respondente que o E2E
    // completou) para o Scaffold — SC-009: só o Meridian edita o enunciado.
    await page.goto("/meridian/registry");
    const infraGapRow = page
      .getByRole("button", { name: /Abrir gap/ })
      .filter({ hasText: "Solaris Digital" })
      .filter({ hasText: "Infraestrutura" });
    await infraGapRow.click();

    await page.getByRole("button", { name: "Virar caso de negócio" }).click();
    await expect(page.getByText(/Promovido para o SCAFFOLD/)).toBeVisible();
  });
});
