import { expect, test } from "@playwright/test";
import { meridianStorageState } from "./setup/auth.setup";

/**
 * E2E — Meridian dogfood (Ensaio local, plano
 * docs/qualidade/2026-09-23-plano-dogfood-esteira.md · Produto 1).
 *
 * Cobre o fluxo principal de ponta a ponta que `meridian-diagnose.spec.ts`
 * não cobre: criar assessment pela carteira, convidar respondente por eixo,
 * responder a bateria até o fim, fechar coleta e rodar scoring, fila de
 * revisão com override+rationale, gap register, plano de 12 meses, relatório
 * e promoção de gap para o Scaffold — M1 a M9 do roteiro
 * (docs/qualidade/dogfood/meridian/roteiro.md).
 *
 * O assessment `AS-200 Solaris Digital` (usado por M4-M9) e os quatro
 * primeiros respondentes são plantados por `scripts/seed-meridian.ts`
 * direto no banco; só o quinto (eixo Infraestrutura, token fixo abaixo)
 * fica de fato sem resposta, pra este spec completar pelo navegador. M1/M2
 * criam um assessment separado ("Nebuloz") pela UI real.
 *
 * Pré-requisito: `globalSetup` roda `seed:meridian cosmos-dev` e regenera a
 * sessão da consultora (`AUTH_TEST=1`) — sem isso a sessão pode ficar presa
 * num tenant sem o `AS-200` desta rodada (atrito corrigido em `509071e7`,
 * `pinPersonaToTenant`).
 */

// Mesmo literal de scripts/seed-meridian.ts (DOGFOOD_RESPONDENT_TOKEN) — token
// de teste fixo, não usar em produção.
const DOGFOOD_RESPONDENT_TOKEN =
  "meridian-dogfood-e2e-fixed-token-nao-usar-em-producao";

test.describe("Meridian dogfood · M1/M2, CEO cria assessment e convida respondentes @meridian", () => {
  // P0 (docs/qualidade/dogfood/meridian/atrito.md) corrigido pela Bussola em
  // 4cf68a24: "Novo assessment" na carteira e "Atribuir respondente" por
  // eixo na aba Coleta. M1 e M2 são um teste só porque M2 opera sobre o
  // assessment que M1 acabou de criar (código sequencial — não dá pra travar
  // em "AS-NBZ-002" fixo).
  test.use({ storageState: meridianStorageState("consultant") });

  test("M1 cria o assessment do zero pela carteira, M2 convida os dois respondentes por eixo (SC-001 início)", async ({
    page,
  }) => {
    await test.step("M1 — Novo assessment pela carteira", async () => {
      await page.goto("/meridian");
      await page.getByRole("button", { name: /Novo assessment/ }).click();
      // Organização é texto livre (não seletor de org existente) — o modal
      // real não tem "Versão do template", tem "Template". Field/Input
      // ligados por `useFieldId` (fix 509071e7) — `getByLabel` funciona nos
      // três agora. Campo nativo `type="date"` espera `YYYY-MM-DD` no
      // `.fill()` independente do formato exibido (mm/dd/yyyy).
      await page.getByLabel("Organização").fill("Nebuloz");
      await page.getByLabel("Setor").fill("Tecnologia");
      await page.getByLabel("Porte").fill("50–200");
      await page.getByLabel("Prazo").fill("2026-12-31");
      await page.getByRole("button", { name: "Criar assessment" }).click();
      // Cria e já navega pro detalhe do assessment recém-criado (não fica na
      // carteira) — confirma pelo código + org no cabeçalho do detalhe.
      await page.waitForURL(/\/meridian\/assessment\//, { timeout: 30_000 });
      await expect(page.getByText(/AS-\d+ · template/i)).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Nebuloz" })
      ).toBeVisible();
    });

    await test.step("M2 — dois respondentes por eixo (dez convites)", async () => {
      await page.getByRole("button", { name: /Coleta/ }).click();
      // AssignRespondentModal (tab-coleta.tsx) não tem seletor de
      // "papel"/tipo — é Nome + Papel na organização (texto livre) + E-mail.
      // D2 (papel fundador + auditoria de repositório por eixo,
      // docs/qualidade/2026-09-23-plano-dogfood-esteira.md) vira só valores
      // de texto, não um campo dedicado. Um botão "Atribuir respondente" por
      // eixo, na ordem canônica de AXIS_IDS (lib/meridian/axes.ts) — não há
      // `role="row"`, então miro por índice em vez de por linha.
      const axisLabels = [
        "Data",
        "Process",
        "People",
        "Governance",
        "Infrastructure",
      ];
      for (let i = 0; i < axisLabels.length; i++) {
        const axisLabel = axisLabels[i];
        const axisSlug = axisLabel.toLowerCase();
        for (const owner of [
          { base: "Vinicius Prates Araújo", role: "Fundador", tag: "founder" },
          {
            base: "Auditoria de Repositório",
            role: "Auditoria de repositório",
            tag: "audit",
          },
        ] as const) {
          // Nome sufixado com o eixo — o mesmo nome se repete 5x (uma
          // atribuição por eixo) e `getByText(..., { exact: true })`
          // precisa de um alvo único por eixo, não só por dono.
          const name = `${owner.base} · ${axisLabel}`;
          await page
            .getByRole("button", { name: "Atribuir respondente" })
            .nth(i)
            .click();
          await page.getByPlaceholder("Marina Costa").fill(name);
          await page.getByPlaceholder("Gerente de Dados").fill(owner.role);
          await page
            .getByPlaceholder("marina@empresa.com")
            .fill(`${owner.tag}-${axisSlug}@nebuloz.exemplo`);
          await page
            .getByRole("button", { name: "Atribuir e gerar link" })
            .click();
          // P0 corrigido em 509071e7: `onAssigned` (reload do detalhe) só
          // dispara quando o consultor fecha o modal de propósito — antes
          // disso a tela "Link de coleta gerado" fica de pé. ModalShell é
          // `role="dialog"` com `aria-label={title}` (components/charter/
          // modal.tsx:281), não um heading semântico.
          const linkDialog = page.getByRole("dialog", {
            name: "Link de coleta gerado",
          });
          await expect(linkDialog).toBeVisible();
          await expect(linkDialog.getByRole("textbox")).toHaveValue(
            /\/meridian-responder\//
          );
          await linkDialog.getByRole("button", { name: "Concluir" }).click();
          await expect(page.getByText(name, { exact: true })).toBeVisible({
            timeout: 15_000,
          });
        }
      }
      await expect(page.getByText("sem dono")).toHaveCount(0);
    });
  });
});

test.describe("Meridian dogfood · respondente completa a bateria @meridian", () => {
  // Sem sessão de propósito: o respondente não tem conta na plataforma.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("responde Infraestrutura, anexa evidência e envia (SC-006)", async ({
    page,
  }) => {
    await page.goto(`/meridian-responder/${DOGFOOD_RESPONDENT_TOKEN}`);

    // AXES["infrastructure"].label (apps/app/lib/meridian/axes.ts) é
    // "Infrastructure" em inglês — a UI não traduz o rótulo do eixo.
    await expect(
      page.getByText("Bateria de prontidão — Infrastructure")
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
    // `attachEvidence` sobe pro bucket `meridian-evidence` via
    // `packages/storage/src/index.ts` (Supabase). Storage local provido
    // pelo Pilar (107c8aa2, docs/runbooks/supabase-local.md) — NÃO é o
    // projeto de produção aosdvvluokrbgpyqwoor, é um Supabase local
    // (`supabase start`, portas 54320-54322/54321, isolado do Postgres do
    // projeto). Exige sucesso de verdade agora.
    await expect(page.getByText("Anexando evidência…")).toBeVisible();
    await expect(page.getByText("evidencia-infra.txt anexado.")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByText("evidencia-infra.txt", { exact: true })
    ).toBeVisible();

    await page.getByRole("button", { name: "Enviar respostas" }).click();
    await expect(page.getByText(/Bateria concluída/)).toBeVisible();
  });
});

test.describe("Meridian dogfood · consultora conduz até promover pro Scaffold @meridian", () => {
  test.use({ storageState: meridianStorageState("consultant") });

  // Mismatch de tenant (atrito P2) corrigido em 509071e7:
  // `pinPersonaToTenant` no seed apaga membership da persona em outro
  // tenant, então a sessão da consultora (regenerada pelo `globalSetup`
  // com `AUTH_TEST`) fica presa no tenant certo (`cosmos-dev`, onde
  // `AS-200 Solaris Digital` mora).
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
    // event que o React escuta, saindo de 50 (computado) para 30. Setar
    // `.value` direto passa pelo setter que o React já sobrescreveu pra
    // rastrear mudança — o `valueTracker` acha que nada mudou e o
    // `onChange` não dispara (botão fica desabilitado). Bypass: usa o
    // setter nativo do protótipo antes de disparar o evento.
    await page.getByLabel("Novo score").evaluate((el, value) => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      nativeSetter?.call(el, value);
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

    // Relatório — nasce do scoring, mostra o override marcado, não
    // escondido (tab-relatorio.tsx:347, badge "override" no eixo Data).
    await page.getByRole("button", { name: /Relatório & Benchmark/ }).click();
    await expect(page.getByText("Shape de prontidão")).toBeVisible();
    await expect(
      page.getByText(/passaram por override do consultor/)
    ).toBeVisible();
    await expect(page.getByText("override", { exact: true })).toBeVisible();

    // Promover o gap de Infraestrutura (derivado do respondente que o E2E
    // completou) para o Scaffold — SC-009: só o Meridian edita o enunciado.
    await page.goto("/meridian/registry");
    const infraGapRow = page
      .getByRole("button", { name: /Abrir gap/ })
      .filter({ hasText: "Solaris Digital" })
      .filter({ hasText: "Infrastructure" });
    await infraGapRow.click();

    await page.getByRole("button", { name: "Virar caso de negócio" }).click();
    await expect(page.getByText(/Promovido para o SCAFFOLD/)).toBeVisible();
  });
});
