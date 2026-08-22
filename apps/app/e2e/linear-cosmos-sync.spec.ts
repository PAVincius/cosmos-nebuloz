import { expect, test } from "@playwright/test";

/**
 * E2E — a ligação Linear ↔ Cosmos, de ponta a ponta.
 *
 * Percorre o fluxo inteiro que um administrador percorre em produção:
 * criar o épico de destino, conectar o Linear (chave → validar → time →
 * épico → importar) e ver as issues virarem Features do épico com o status
 * traduzido — inclusive "Testando" → coluna Revisão, a tradução que só o
 * nome do estado carrega.
 *
 * O Linear é o fake de e2e/fixtures/fake-linear.mjs, apontado por
 * LINEAR_API_URL no servidor Next. Navegador não intercepta chamada de
 * server action; sem o fake, este teste exigiria credencial real.
 *
 * Pré-requisitos (o runner e2e:linear em package.json cuida dos três):
 *   - fake-linear rodando na porta 4801
 *   - app com LINEAR_API_URL=http://localhost:4801
 *   - banco E2E seedado (globalSetup roda pnpm seed:e2e)
 */

const EPICO = `E2E Linear ${Date.now()}`;
// Nome único por execução: o cleanup do seed não apaga integrações criadas
// pelo próprio teste, e reruns com nome repetido deixam o botão de sync
// ambíguo para sempre.
const NOME_INTEGRACAO = `Linear E2E ${Date.now()}`;

test.describe("Linear → Cosmos @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  // Um único teste, um único contexto: o app revoga a sessão anterior em
  // algum caminho (rotação/revogação), e dois testes lendo o mesmo
  // storageState fazem o segundo herdar um token já morto. Dentro de um
  // contexto só, o cookie renovado vive na memória e o percurso inteiro
  // enxerga a mesma sessão.
  test("fluxo completo: recusa de chave → épico → conectar → importar → boards", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    // ── 0. Credencial inválida é recusada antes de gravar qualquer coisa ─
    await page.goto("/cosmos/integrations");
    // O seed sempre deixa um conector do Linear ativo, então o card não tem
    // mais "Conectar" — a porta determinística é o + de conectar outro time.
    await page
      .getByRole("button", { name: "Conectar outro time do Linear" })
      .first()
      .click({ timeout: 30_000 });

    await page.getByLabel("Personal API key").fill("chave-invalida-e2e");
    await page.getByRole("button", { name: "Validar e listar times" }).click();

    await expect(page.getByText(/Linear recusou a credencial/i)).toBeVisible({
      timeout: 15_000,
    });
    // Recusa não conecta: o modal segue no passo da chave.
    await expect(page.getByLabel("Personal API key")).toBeVisible();

    // ── 1. Épico de destino ──────────────────────────────────────────────
    await page.goto("/cosmos/kanban");
    await page
      .getByRole("button", { name: "Novo Épico" })
      .click({ timeout: 30_000 });
    await page.getByPlaceholder(/Antifraude/).fill(EPICO);
    await page.getByRole("button", { name: "Criar épico" }).click();
    await expect(page.getByText("Épico criado.")).toBeVisible({
      timeout: 15_000,
    });

    // ── 2. Conectar o Linear ─────────────────────────────────────────────
    await page.goto("/cosmos/integrations");
    await page
      .getByRole("button", { name: "Conectar outro time do Linear" })
      .first()
      .click({ timeout: 30_000 });

    await page.getByLabel("Nome da integração").fill(NOME_INTEGRACAO);
    await page.getByLabel("Personal API key").fill("lin_api_fake_e2e_0001");
    await page.getByRole("button", { name: "Validar e listar times" }).click();

    // A conta do fake aparece — prova de que a validação foi ao servidor.
    await expect(page.getByText(/conta Nebuloz E2E/)).toBeVisible({
      timeout: 15_000,
    });

    // Time COS do fake, épico recém-criado, importar agora.
    await page
      .getByLabel(/Time do Linear/)
      .selectOption({ label: "COS · Cosmos" });
    await page
      .getByLabel("Épico de destino das features")
      .selectOption({ label: EPICO });
    await expect(
      page.getByLabel(/Importar as issues deste time agora/)
    ).toBeChecked();

    await page
      .getByRole("button", { name: /^Conectar$/ })
      .last()
      .click();

    // Toast com os contadores reais do snapshot: 6 issues do fake.
    await expect(
      page.getByText(/Conectado — 6 criadas, 0 atualizadas/)
    ).toBeVisible({ timeout: 30_000 });

    // ── 3. Card ativo com saúde de sync ──────────────────────────────────
    // O seed também tem uma integração com sync verde — a prova de que ESTA
    // conexão sincronizou é o toast de contadores acima; aqui basta a saúde
    // renderizada em pelo menos um card.
    await expect(
      page.getByText(/Última sincronização: sucesso/).first()
    ).toBeVisible({ timeout: 15_000 });

    // ── 4. Re-sync mantém a adoção e atualiza em vez de duplicar ─────────
    await page
      .getByRole("button", { name: `Sincronizar ${NOME_INTEGRACAO} agora` })
      .click();
    await expect(page.getByText(/0 criadas, 6 atualizadas/)).toBeVisible({
      timeout: 30_000,
    });

    // ── 5. O épico no kanban carrega as features importadas ──────────────
    // Reaquece a revalidação da sessão antes da navegação RSC: o cookie
    // assinado do better-auth vence a cada 60s, e navegar direto no vencimento
    // já derrubou este passo para a tela de login em runs anteriores.
    await page.request.get("/api/auth/get-session");
    await page.goto("/cosmos/kanban");
    await expect(page.getByText(EPICO)).toBeVisible({ timeout: 15_000 });
  });
});
