import { expect, test } from "@playwright/test";
import dotenv from "dotenv";
import { meridianStorageState } from "./setup/auth.setup";

dotenv.config({ path: ".env.local" });

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

/**
 * Anexa uma evidência à resposta de Rafael Tomé (eixo Data, o único
 * contestado — Rafael × Bianca divergem) pro botão "Ver evidência" do
 * DivergencePanel (tab-scoring.tsx) ter o que abrir. `seed-meridian.ts` não
 * anexa evidência a nenhum dos quatro respondentes pré-plantados — só a
 * bateria do M3 (Infraestrutura, via navegador) tem uma, e Infraestrutura
 * tem um único respondente, então nunca diverge, então o DivergencePanel
 * nunca mostra nada pra esse eixo (`getDivergence` só devolve linha com
 * `answers.length > 1`, actions/scoring.ts:418). Sem escrever fixture nova
 * em `seed-meridian.ts` (não é meu arquivo), escrevo direto no Postgres +
 * Supabase locais aqui, do jeito que um script de seed faria.
 */
const MERIDIAN_EVIDENCE_BUCKET = "meridian-evidence";

/** Upload via REST do Supabase Storage, sem passar por `@repo/storage` — o
 *  pacote é TS cru (não compilado), e o `import()` dinâmico do processo do
 *  Playwright (esbuild, não pula `node_modules`/pacotes de workspace do
 *  jeito que o `tsx` dos scripts de seed pula) não sabe parsear `export`
 *  daquele arquivo em runtime. A API HTTP do Storage é estável e simples
 *  o bastante pra não valer a pena depender do client aqui. */
async function uploadToSupabaseStorage(
  path: string,
  body: string,
  contentType: string
): Promise<void> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!(base && key)) {
    throw new Error(
      "uploadToSupabaseStorage: NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes em .env.local."
    );
  }
  await fetch(`${base}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: MERIDIAN_EVIDENCE_BUCKET, public: false }),
  }).catch(() => {
    // já existe — mesma tolerância do `ensureBucket` real.
  });
  const res = await fetch(
    `${base}/storage/v1/object/${MERIDIAN_EVIDENCE_BUCKET}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body,
    }
  );
  if (!res.ok) {
    throw new Error(
      `uploadToSupabaseStorage: falha no upload (${res.status}) — ${await res.text()}`
    );
  }
}

async function attachEvidenceToContestedAxis(): Promise<void> {
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { Pool } = await import("pg");
  const { PrismaClient } = await import(
    "../../../packages/database/generated/index.js"
  );

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  const assessment = await db.meridianAssessment.findFirst({
    where: { code: "AS-200" },
    select: { id: true, tenantId: true },
  });
  if (!assessment) {
    throw new Error(
      "attachEvidenceToContestedAxis: AS-200 não encontrado — rode o seed primeiro."
    );
  }
  const response = await db.meridianResponse.findFirst({
    where: {
      tenantId: assessment.tenantId,
      respondent: { assessmentId: assessment.id, name: "Rafael Tomé" },
      question: { axis: "DATA" },
    },
    select: { id: true, respondentId: true },
  });
  if (!response) {
    throw new Error(
      "attachEvidenceToContestedAxis: resposta de Rafael Tomé (eixo Data) não encontrada."
    );
  }

  const evidenceId = "e2eevidenceseed00000000001";
  const storagePath = `${assessment.tenantId}/${assessment.id}/${evidenceId}`;
  await uploadToSupabaseStorage(
    storagePath,
    "print de auditoria de dado — ensaio local",
    "text/plain"
  );

  await db.meridianEvidence.deleteMany({ where: { responseId: response.id } });
  await db.meridianEvidence.create({
    data: {
      tenantId: assessment.tenantId,
      assessmentId: assessment.id,
      responseId: response.id,
      storagePath,
      fileName: "auditoria-fonte-de-dado.txt",
      mimeType: "text/plain",
      sizeBytes: 42,
      uploadedByRespondentId: response.respondentId,
    },
  });

  await db.$disconnect();
}

test.describe("Meridian dogfood · M1/M2, CEO cria assessment e convida respondentes @meridian", () => {
  // P0 (docs/qualidade/dogfood/meridian/atrito.md) corrigido pela Bussola em
  // 4cf68a24: "Novo assessment" na carteira e "Atribuir respondente" por
  // eixo na aba Coleta. M1 e M2 são um teste só porque M2 opera sobre o
  // assessment que M1 acabou de criar (código sequencial — não dá pra travar
  // em "AS-NBZ-002" fixo).
  test.use({ storageState: meridianStorageState("consultant") });

  test("M1 cria o assessment do zero pela carteira, M2 convida os dois respondentes por eixo (SC-001 início)", async ({
    page,
    context,
  }) => {
    // "Concluir" só habilita depois de copiar o link (guarda AS-112,
    // tab-coleta.tsx): o botão Copiar usa a Clipboard API.
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
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
            /\/meridian-responder#t=/
          );
          await linkDialog.getByRole("button", { name: "Copiar" }).click();
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
    await page.goto(`/meridian-responder#t=${DOGFOOD_RESPONDENT_TOKEN}`);

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
  test.beforeAll(async () => {
    await attachEvidenceToContestedAxis();
  });

  test("fecha coleta, decide o contestado, gera plano, relatório e promove gap (SC-002..004, SC-007, SC-009)", async ({
    page,
  }) => {
    await page.goto("/meridian");
    await page
      .getByRole("button", { name: /Solaris Digital/ })
      .first()
      .click();
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

    // M8/SC-008 — "Ver evidência" (EvidenceButton, tab-scoring.tsx:53-83).
    // `window.open` roda DEPOIS de um `await` (o `requestEvidenceUrl`) —
    // fora da pilha síncrona do clique, é exatamente o padrão que
    // bloqueadores de pop-up pegam. Confere se a aba abre de fato antes de
    // assumir sucesso.
    //
    // `DivergencePanel` é montado duas vezes (tab-scoring.tsx:423 no card
    // do eixo e :664 dentro do modal "Override — Data") — sem escopar pelo
    // `role="dialog"`, o locator resolve pro botão de trás do modal (some
    // visualmente, mas ainda existe no DOM) tanto quanto pro de dentro,
    // ambíguo dependendo da corrida. Escopar no diálogo resolve os dois
    // problemas de uma vez: ambiguidade e a sobreposição de
    // cabeçalho/rodapé fixos que um `force`/scroll manual não resolvia.
    const overrideDialog = page.getByRole("dialog", { name: /Override/ });
    const evidenceButton = overrideDialog.getByRole("button", {
      name: "auditoria-fonte-de-dado.txt",
    });
    await evidenceButton.scrollIntoViewIfNeeded();
    const popupPromise = page
      .context()
      .waitForEvent("page", { timeout: 8000 })
      .catch(() => null);
    await evidenceButton.click();
    await expect(
      page.getByText("Evidência aberta — acesso registrado na trilha.")
    ).toBeVisible();
    const popup = await popupPromise;
    if (popup) {
      // Chega na URL assinada de verdade — não só "alguma aba abriu", tem
      // que navegar pro storage local (Supabase, storage/v1/object/sign/…).
      await popup.waitForLoadState("domcontentloaded", { timeout: 10_000 });
      await expect(popup).toHaveURL(
        /storage\/v1\/object\/sign\/meridian-evidence/
      );
      await popup.close();
    } else {
      throw new Error(
        "P1: window.open (EvidenceButton, tab-scoring.tsx) não abriu nenhuma aba nova em 8s — bloqueado como pop-up (async gap entre o clique e o window.open, sem gesto de usuário direto). Ver atrito.md."
      );
    }
    // A entrada meridian.evidence.read na trilha é conferida em M8
    // (describe dedicado, mais abaixo) — não navego pra /settings/audit
    // aqui no meio do fluxo pra não perder o estado do DivergencePanel
    // expandido, que os próximos passos (override) precisam.

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
    // A promoção só grava depois da confirmação (atrito A2 do dogfood).
    await page.getByRole("button", { name: "Confirmar promoção" }).click();
    await expect(page.getByText(/Promovido para o SCAFFOLD/)).toBeVisible();
  });
});

test.describe("Meridian dogfood · M8, amostragem da trilha de auditoria @meridian", () => {
  test.use({ storageState: meridianStorageState("consultant") });

  // Roteiro (M8) pede filtrar por prefixo "meridian." — `listAuditLogs`
  // (actions/audit/index.ts) ganhou suporte a `entityType` terminado em "."
  // como prefixo em `ea0454dd` (pill "Meridian" no dropdown). Continuo
  // navegando com `entityType` exato por ação, um valor por vez — mais
  // preciso pra amostrar cada evento específico do que o prefixo genérico.
  // Roda depois de M1-M9 no mesmo arquivo (`fullyParallel: false`), então a
  // trilha já tem as entradas reais dessa rodada.
  test("amostra criação de assessment, atribuição, fechamento de coleta, override e promoção de gap (SC-008)", async ({
    page,
  }) => {
    // Reruns acumulam entradas na mesma janela de 7 dias — `.first()` em
    // todas, não é "a única entrada", é "existe pelo menos uma". Não dá pra
    // filtrar por org ("Solaris Digital"/"AS-200") como o roteiro assume: a
    // tabela (audit-log-table.tsx:157-207) não tem coluna de `target` —
    // grava o rótulo legível (`metadata.target`, "AS-200 · Solaris
    // Digital") mas só renderiza `entityId` (cuid ilegível). Atrito
    // registrado — amostro por tipo de ação, não por qual assessment.
    await page.goto("/settings/audit?entityType=meridian.assessment&period=7");
    await expect(
      page.getByRole("row", { name: /meridian\.assessment\.create/ }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("row", { name: /meridian\.collection\.close/ }).first()
    ).toBeVisible();

    await page.goto("/settings/audit?entityType=meridian.respondent&period=7");
    await expect(
      page.getByRole("row", { name: /meridian\.respondent\.assign/ }).first()
    ).toBeVisible();

    await page.goto("/settings/audit?entityType=meridian.override&period=7");
    const overrideRow = page
      .getByRole("row", { name: /meridian\.override\.register/ })
      .first();
    await expect(overrideRow).toBeVisible();

    // gap.promote grava com entityType "meridian.promotion" (o registro
    // criado), não "meridian.gap" (gaps.ts:436) — cada action escolhe a
    // entidade que fez mais sentido gravar, não um valor fixo por tela.
    await page.goto("/settings/audit?entityType=meridian.promotion&period=7");
    await expect(
      page.getByRole("row", { name: /meridian\.gap\.promote/ }).first()
    ).toBeVisible();
  });

  // FR-038: "a entrada de override mostra o valor antes e depois". Corrigido
  // em ea0454dd — `formatDiff` (audit-log-table.tsx:48) agora reconhece o
  // array de triplas do Meridian (`_shared.ts:14`, `AuditDiff =
  // [string,string,string][]`) separado do `Record<string,unknown>` do
  // Cosmos, e renderiza "campo: antes → depois".
  test("override mostra score antes e depois na trilha, não só o índice (FR-038)", async ({
    page,
  }) => {
    await page.goto("/settings/audit?entityType=meridian.override&period=7");
    const overrideRow = page
      .getByRole("row", { name: /meridian\.override\.register/ })
      .first();
    await expect(overrideRow.getByText(/Score final/)).toBeVisible();
    await expect(overrideRow.getByText(/→|->/)).toBeVisible();
  });

  // `requestEvidenceUrl` (actions/report.ts:264) fechado em c08657af —
  // botão "Ver evidência" no DivergencePanel (tab-scoring.tsx). O teste
  // "fecha coleta..." (describe acima, roda antes deste no mesmo arquivo)
  // já clicou nele — aqui só confere que a leitura ficou registrada na
  // trilha, não repete o clique.
  test("cada pedido de URL de evidência gera entrada meridian.evidence.read (SC-008)", async ({
    page,
  }) => {
    await page.goto("/settings/audit?entityType=meridian.evidence&period=1");
    await expect(
      page.getByRole("row", { name: /meridian\.evidence\.read/ }).first()
    ).toBeVisible();
  });
});
