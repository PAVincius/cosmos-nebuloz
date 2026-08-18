# Corpus de segurança em IA generativa, e o veredito que faltava

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar o checklist de segurança em IA generativa da Nebuloz para dentro do Charter como conjunto de exigências global, e dar ao mapa o veredito "não se aplica" que ele não sabe dizer.

**Architecture:** O enum `CharterCoverageStatus` ganha `NAO_APLICAVEL` por migration própria, e todo lugar que conta ou desenha veredito passa a tratá-lo como resposta, não como ausência de resposta. O corpus entra como quinto membro de `CORPORA`, derivado mecanicamente de um documento-fonte versionado no repo.

**Tech Stack:** Prisma 7 + PostgreSQL · Next.js 16 App Router · TypeScript · Vitest · Biome.

## Global Constraints

- **Idioma:** comentários e strings de UI em **pt-BR**; assunto de commit em **pt-BR**, corpo em **prosa inglesa**. Comentário explica *por quê*, nunca *o quê*.
- **Verificação:** `cd apps/app && NODE_ENV=test pnpm run test`. **`NODE_ENV=test` é obrigatório** — sem ele o plugin React escolhe o runtime JSX errado.
- **Não rode `pnpm run test` da raiz para verificar.** Turbo cacheia e replaya log de execução anterior — indistinguível de execução real no output. Para verificar, rode `vitest` direto dentro de `apps/app`.
- **Nenhuma migration é aplicada a banco.** Escrever o `.sql` apenas.
- Antes de commitar, da raiz: `npx @biomejs/biome check --write` nos arquivos tocados. Depois `cd apps/app && npx tsc --noEmit -p .`.
- Actions do Charter: `requireCharterPermissionContext` → `withTenantDb` → `logCharterAudit` na mesma transação → `Result<T>` via `safeAction`, com `GovernanceError` para violação de regra.
- **Uma `withTenantDb` por action.** Aninhar custa duas conexões do pool por request.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `packages/database/prisma/migrations/20260807000000_coverage_nao_aplicavel/migration.sql` | **Novo.** Só o `ADD VALUE`, sozinho |
| `packages/database/prisma/schema/charter.prisma` | `NAO_APLICAVEL` no enum |
| `apps/app/app/(charter)/actions/compliance.ts` | zod, regra do comentário obrigatório, contagem de `semVeredito` |
| `apps/app/lib/charter/compliance-pdf.tsx` | `cabecalho` não infla com item descartado |
| `apps/app/app/(charter)/actions/compliance-export.ts` | `nomeArquivo` idem |
| `apps/app/components/charter/screens/compliance.tsx` | `STATUS_META`, `STATUS_ORDER` |
| `docs/security/checklist-ia-generativa.md` | **Fonte** do corpus — já existe, não editar neste trabalho |
| `packages/database/scripts/regulacao-corpora.ts` | Quinto corpus, e escopar o comentário sobre `texto` |

---

### Task 1: O enum ganha `NAO_APLICAVEL`

**Files:**
- Create: `packages/database/prisma/migrations/20260807000000_coverage_nao_aplicavel/migration.sql`
- Modify: `packages/database/prisma/schema/charter.prisma`

**Interfaces:**
- Produces: o valor `"NAO_APLICAVEL"` em `CharterCoverageStatus`, consumido por todas as tasks seguintes.

**Duas coisas que não têm precedente neste repositório.** Nenhuma migration existente usa `ALTER TYPE ... ADD VALUE` — esta é a primeira, e não há padrão da casa para copiar.

- **A migration contém apenas este comando.** No Postgres 12+, `ADD VALUE` roda dentro de bloco de transação, mas o valor novo **não pode ser usado** até aquela transação committar. O Prisma envolve cada migration numa transação, então uma migration que adiciona o valor *e* o usa — num `DEFAULT`, `CHECK` ou `UPDATE` — falha.
- **Não é reversível.** Postgres não tem `DROP VALUE`. Desfazer exige recriar o tipo e reescrever toda coluna que o usa. Confira o nome antes de aplicar.

- [ ] **Step 1: Escrever a migration**

Criar `packages/database/prisma/migrations/20260807000000_coverage_nao_aplicavel/migration.sql`:

```sql
-- "Não se aplica" — o terceiro veredito que o checklist de segurança pede
-- (Pass / Fail / N/A) e que o enum não sabia dizer.
--
-- Sem ele, um controle sobre componente que o produto não tem — RAG, base
-- vetorial, fine-tuning — só podia ser marcado NAO_ATENDE, e o mapa afirmaria
-- a um comprador que a Nebuloz falha em controles que sequer se aplicam.
--
-- Esta migration contém APENAS o ADD VALUE. No Postgres 12+ o comando roda
-- dentro de transação, mas o valor novo não pode ser USADO até ela committar,
-- e o Prisma envolve cada migration numa transação. Qualquer passo que precise
-- usar o valor vai em migration seguinte.
ALTER TYPE "CharterCoverageStatus" ADD VALUE IF NOT EXISTS 'NAO_APLICAVEL';
```

- [ ] **Step 2: Adicionar ao schema**

Em `packages/database/prisma/schema/charter.prisma`, no `enum CharterCoverageStatus`, após `REVISAR`:

```prisma
  NAO_APLICAVEL
```

- [ ] **Step 3: Validar e gerar**

Run: `cd packages/database && npx prisma format && npx prisma validate && npx prisma generate --no-hints`
Expected: `The schemas at prisma/schema are valid 🚀`

- [ ] **Step 4: Confirmar que o typecheck agora falha, e onde**

Run: `cd apps/app && npx tsc --noEmit -p .`
Expected: FAIL em `components/charter/screens/compliance.tsx`, no `STATUS_META` — `Record<MapRow["status"], …>` ficou incompleto. **Essa falha é o objetivo deste passo**: ela prova que a exaustividade do `Record` é real e que a Task 2 tem um alvo. Anote o erro no relatório.

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema/charter.prisma \
        packages/database/prisma/migrations/20260807000000_coverage_nao_aplicavel
git commit -m "feat(charter): veredito 'não se aplica' na cobertura

The security checklist asks for Pass / Fail / N/A and the enum had no N/A. That
is not hypothetical: with no Python backend, no RAG, no vector store and no
fine-tuning, a large share of its controls describe components this product does
not have. Marking them NAO_ATENDE would tell a buyer we fail security controls
that do not apply — a self-inflicted lie in a commercial document.

The migration carries only the ADD VALUE. On Postgres 12+ that runs inside a
transaction but the new value cannot be used until it commits, and Prisma wraps
each migration in one, so anything that uses the value goes in a later
migration. There is no DROP VALUE, so the name is not cheap to change later."
```

---

### Task 2: O veredito novo é resposta, não ausência dela

**Files:**
- Modify: `apps/app/app/(charter)/actions/compliance.ts:336-346` (zod), `:365-370` (regra), `:504-511` (contagem)
- Modify: `apps/app/lib/charter/compliance-pdf.tsx:25-31`
- Modify: `apps/app/app/(charter)/actions/compliance-export.ts:41-49`
- Modify: `apps/app/components/charter/screens/compliance.tsx:61-67`, `:75-81`
- Test: `apps/app/__tests__/charter/compliance.test.ts`, `apps/app/__tests__/charter/compliance-export.test.ts`

**Interfaces:**
- Consumes: `"NAO_APLICAVEL"` em `CharterCoverageStatus` (Task 1).
- Produces: `setCoverage` aceita `status: "NAO_APLICAVEL"` **exigindo** `comentario`; `getComplianceMap` devolve `semVeredito` que **não** conta `NAO_APLICAVEL`.

**A propriedade que amarra esta task:** `NAO_APLICAVEL` é um veredito. Se ele contasse como sem-veredito, um mapa inteiramente respondido apareceria como rascunho para sempre — no cabeçalho do PDF e no nome do arquivo exportado.

**Comece por alargar `MapRow["status"]`, e saiba por quê.** Em `compliance.ts`, `MapRow.status` é uma união literal escrita à mão com os cinco valores antigos — **não** é derivada do enum do Prisma. Por isso a Task 1 quebrou o `tsc` em `compliance.ts:303` e `:546`, onde resultado de query tipado pelo Prisma (agora com seis membros) entra nessa união mais estreita, e **não** no `STATUS_META` como este plano previa. Acrescente `"NAO_APLICAVEL"` à união primeiro: os dois erros somem, e só então o `STATUS_META` passa a exigir a chave nova. A ordem importa, senão você persegue erro que ainda não apareceu.

- [ ] **Step 1: Escrever os testes que falham**

Anexar a `apps/app/__tests__/charter/compliance.test.ts`, dentro do `describe("setCoverage")` existente:

```ts
  it("recusa NAO_APLICAVEL sem justificativa", async () => {
    // "Não se aplica" sem motivo é indistinguível de "não quis responder", e é
    // o veredito mais fácil de abusar num documento que sai da empresa.
    const res = await setCoverage({
      requirementId: "r-1",
      status: "NAO_APLICAVEL",
    });

    expect(res.ok).toBe(false);
    expect(h.covUpsert).not.toHaveBeenCalled();
  });

  it("aceita NAO_APLICAVEL com justificativa, sem exigir capacidade", async () => {
    // Simétrico invertido de ATENDE: lá a capacidade é obrigatória porque
    // alegação precisa de prova; aqui não há o que provar, só o que explicar.
    const res = await setCoverage({
      requirementId: "r-1",
      status: "NAO_APLICAVEL",
      comentario: "Não fazemos canary release de modelo.",
    });

    expect(res.ok).toBe(true);
  });
```

E um `describe` novo no mesmo arquivo:

```ts
describe("getComplianceMap — NAO_APLICAVEL é veredito", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireCtx.mockResolvedValue(ctx);
    h.setFindFirst.mockResolvedValue({ id: "s-1", nome: "RFP", licenca: "LIVRE" });
    h.reqFindMany.mockResolvedValue([
      { id: "r-1", codigo: "1", citacao: "§1", resumo: "a", peso: null },
      { id: "r-2", codigo: "2", citacao: "§2", resumo: "b", peso: null },
    ]);
    h.covFindMany.mockResolvedValue([
      {
        requirementId: "r-1",
        status: "NAO_APLICAVEL",
        comentario: "Não fazemos canary release de modelo (§10.2).",
        capabilityId: null,
      },
    ]);
  });

  it("não conta NAO_APLICAVEL como sem veredito", async () => {
    // r-1 foi respondido (não se aplica); só r-2 segue sem resposta.
    const res = await getComplianceMap("s-1");

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.semVeredito).toBe(1);
  });
});
```

E em `apps/app/__tests__/charter/compliance-export.test.ts`:

```ts
describe("cabecalho e nome de arquivo com NAO_APLICAVEL", () => {
  it("mapa todo respondido, mesmo com descartes, não é rascunho", () => {
    // Se NAO_APLICAVEL contasse como sem veredito, este mapa apareceria como
    // rascunho para sempre — e o arquivo sairia com o sufixo, para o comprador.
    const completo = {
      ...base,
      semVeredito: 0,
      linhas: base.linhas.map((l) => ({
        ...l,
        status: "NAO_APLICAVEL" as const,
      })),
    };

    expect(cabecalho(completo)).not.toContain("sem veredito");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/compliance.test.ts __tests__/charter/compliance-export.test.ts`
Expected: FAIL — o zod ainda não aceita `"NAO_APLICAVEL"`, então os dois primeiros testes falham na validação, e a contagem ainda inclui o status novo.

- [ ] **Step 3: Aceitar o valor e exigir a justificativa**

Em `compliance.ts`, no `SetCoverageSchema` (linha ~336), acrescentar `"NAO_APLICAVEL"` ao `z.enum`, após `"REVISAR"`.

Logo depois da regra que exige capacidade (linha ~365-370), acrescentar:

```ts
    // Simétrico invertido da regra acima. Lá, alegar conformidade exige
    // apontar a prova; aqui, descartar exige dizer por quê. "Não se aplica"
    // sem motivo é indistinguível de "não quis responder", e é o veredito
    // mais fácil de abusar num documento que vai para um comprador.
    if (data.status === "NAO_APLICAVEL" && !data.comentario) {
      throw new GovernanceError(
        "coverage.needs.reason",
        "Marcar como não aplicável exige dizer por quê."
      );
    }
```

- [ ] **Step 4: Tirar o status novo da contagem de sem-veredito**

Em `compliance.ts`, na linha ~508, a contagem já é `if (status === "SEM_VEREDITO")` — ou seja, **já está correta** e não conta `NAO_APLICAVEL`. Confirme lendo o código; se estiver assim, não mude nada e registre no relatório que a contagem não precisou de alteração. Se estiver contando qualquer coisa diferente de `SEM_VEREDITO`, corrija para contar só ele.

`cabecalho` (`compliance-pdf.tsx:25-31`) e `nomeArquivo` (`compliance-export.ts:41-49`) derivam de `map.semVeredito` — se a contagem está certa, os dois já estão certos por consequência. Confirme lendo, e registre.

- [ ] **Step 5: Desenhar o status novo**

Em `apps/app/components/charter/screens/compliance.tsx`, no `STATUS_META` (linha ~61):

```ts
  NAO_APLICAVEL: { label: "Não se aplica", tone: "neutral" },
```

E no `STATUS_ORDER` (linha ~75), entre `"NAO_ATENDE"` e `"REVISAR"`:

```ts
  "NAO_APLICAVEL",
```

- [ ] **Step 6: Rodar e confirmar que passam**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/compliance.test.ts __tests__/charter/compliance-export.test.ts`
Expected: PASS.

Depois: `cd apps/app && npx tsc --noEmit -p .` — Expected: limpo. O erro de exaustividade da Task 1 Step 4 desapareceu.

- [ ] **Step 7: Suíte inteira**

Run: `cd apps/app && NODE_ENV=test pnpm run test`
Expected: verde. Um valor novo em enum consumido por `Record` exaustivo pode ter alcançado outro arquivo — se alcançou, corrija agora.

- [ ] **Step 8: Commit**

```bash
git add "apps/app/app/(charter)/actions/compliance.ts" \
        "apps/app/app/(charter)/actions/compliance-export.ts" \
        apps/app/lib/charter/compliance-pdf.tsx \
        apps/app/components/charter/screens/compliance.tsx \
        apps/app/__tests__/charter/compliance.test.ts \
        apps/app/__tests__/charter/compliance-export.test.ts
git commit -m "feat(charter): 'não se aplica' conta como resposta, não como silêncio

Marking a control not applicable requires saying why. It is the inverse of the
rule already in place for ATENDE: there, claiming conformity requires pointing
at the proof; here, dismissing it requires giving a reason. 'Does not apply'
with no reason is indistinguishable from 'declined to answer', and it is the
easiest verdict to abuse in a document that leaves the building.

It also counts as a verdict, not as the absence of one. Had it counted as
unanswered, a fully answered map would have shown as a draft forever — in the
PDF header and in the exported filename the buyer receives."
```

---

### Task 3: O corpus

**Files:**
- Modify: `packages/database/scripts/regulacao-corpora.ts`
- Test: `apps/app/__tests__/charter/licenca-copyright.test.ts` (asserção nova, arquivo existente)
- Read-only: `docs/security/checklist-ia-generativa.md` — **a fonte**

**Interfaces:**
- Consumes: `CorpusSeed` e `RequirementSeed` de `regulacao-corpora.ts`.
- Produces: o quinto membro de `CORPORA`.

**A derivação é mecânica, e a fonte é o documento.** `docs/security/checklist-ia-generativa.md` tem seções numeradas e itens numerados dentro de cada uma. Regra, sem exceção:

- **uma exigência por item numerado** — 59 no total
- `codigo` = `SEC-<seção>-<item>`, com a seção sem o `§` e o ponto virando hífen: `§4.1` item 2 → `SEC-4-1-2`; `§6` item 3 → `SEC-6-3`
- `citacao` = a seção com `§`: `"§4.1"`, `"§6"`
- `texto` = o texto do item, **verbatim do documento**
- `resumo` = formulação curta do controle, citando o código OWASP quando o documento o nomeia (`LLM01`…`LLM10`)
- `categoria` = a área da tabela de §Áreas do documento

Contagem por seção, para conferir: §1 = 4 · §2 = 5 · §3.1 = 3 · §3.2 = 4 · §3.3 = 2 · §4.1 = 4 · §4.2 = 4 · §5 = 5 · §6 = 5 · §7 = 4 · §8 = 4 · §9 = 4 · §10.1 = 3 · §10.2 = 2 · §10.3 = 3 · §11 = 3. **Total 59.**

- [ ] **Step 1: Escrever o teste que falha**

Anexar a `apps/app/__tests__/charter/licenca-copyright.test.ts`:

```ts
describe("corpus de segurança em IA", () => {
  const corpus = CORPORA.find((c) => c.nome.includes("checklist Nebuloz"));

  it("existe e é LIVRE — é texto próprio da Nebuloz, não norma de terceiro", () => {
    expect(corpus).toBeDefined();
    expect(corpus?.licenca).toBe("LIVRE");
  });

  it("tem as 59 exigências do documento-fonte", () => {
    // Se este número divergir, o corpus e docs/security/checklist-ia-generativa.md
    // saíram de sincronia — e o mapa passa a perguntar coisa que o documento
    // não pede, ou a calar coisa que ele pede.
    expect(corpus?.requisitos).toHaveLength(59);
  });

  it("carrega texto verbatim, diferente dos quatro corpora regulatórios", () => {
    // Aqui a fonte é nossa, então reproduzir é legítimo e útil: o comprador lê
    // a exigência inteira no export, não só um resumo.
    for (const req of corpus?.requisitos ?? []) {
      expect(req.texto, `${req.codigo} sem texto`).toBeTruthy();
    }
  });

  it("tem código único e no formato SEC-<seção>-<item>", () => {
    const codigos = (corpus?.requisitos ?? []).map((r) => r.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
    for (const c of codigos) {
      expect(c).toMatch(/^SEC-\d+(-\d+){1,2}$/);
    }
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/licenca-copyright.test.ts`
Expected: FAIL — o corpus não existe em `CORPORA`.

- [ ] **Step 3: Escopar o comentário sobre `texto`**

`regulacao-corpora.ts` documenta, no tipo `RequirementSeed`, que `texto` fica ausente em **todo** requisito do arquivo. Isso deixa de ser verdade com este corpus, e um comentário que afirma o que o arquivo não faz é pior que comentário nenhum.

Reescrever aquele bloco para escopar a regra aos quatro corpora regulatórios e explicar a diferença: neles a citação não foi conferida palavra por palavra contra a fonte oficial, então `texto` ausente é honestidade; aqui a fonte é `docs/security/checklist-ia-generativa.md`, escrita pela própria Nebuloz, então `texto` é de fato verbatim e reproduzir é legítimo.

- [ ] **Step 4: Escrever o corpus**

Acrescentar a `CORPORA`:

```ts
{
  nome: "Segurança em IA generativa — checklist Nebuloz",
  origem: "REGULACAO",
  editor: "NEBULOZ",
  jurisdicao: "INT",
  licenca: "LIVRE",
  versao: "1",
  notas:
    "Síntese sobre OWASP LLM Top 10 2025, checklist OWASP de governança de IA " +
    "e Secure AI Model Ops. Fonte: docs/security/checklist-ia-generativa.md — " +
    "mudou lá, versione aqui com publishSetVersion em vez de editar no lugar.",
  requisitos: [
    {
      codigo: "SEC-1-1",
      citacao: "§1",
      categoria: "arquitetura",
      resumo:
        "Mapear todo componente de IA e definir trust boundaries entre frontend, backend, provedor e dados corporativos.",
      texto:
        "Mapear todos os componentes de IA (API de LLM, RAG, agentes, orquestradores, workers assíncronos, filas, vetores, storage de contexto) e definir trust boundaries entre frontend, backend, provedor de modelo e dados corporativos.",
    },
    // … os 58 restantes, derivados do documento pela regra acima
  ],
},
```

Derive os 58 restantes de `docs/security/checklist-ia-generativa.md` seguindo a regra. **Não invente item que não está no documento, e não omita item que está** — o teste de contagem pega os dois erros, mas ele só conta; conferir item a item contra a fonte é seu.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/licenca-copyright.test.ts`
Expected: PASS. Os testes antigos do arquivo — a guarda de copyright dos corpora `REFERENCIA` — continuam verdes sem alteração, porque este corpus é `LIVRE`.

- [ ] **Step 6: Suíte inteira e typecheck**

```bash
cd apps/app && NODE_ENV=test pnpm run test
cd apps/app && npx tsc --noEmit -p .
```
Expected: verde e limpo.

- [ ] **Step 7: Commit**

```bash
git add packages/database/scripts/regulacao-corpora.ts \
        apps/app/__tests__/charter/licenca-copyright.test.ts
git commit -m "feat(charter): corpus de segurança em IA generativa

The checklist is structurally a requirement set — numbered sections, a citable
item, a verdict per item, and an explicit instruction to re-run the review on
every relevant change. This is the compliance map's first real use, and unlike
the four regulatory corpora it is a commercial asset: a buyer asking how we
secure our own AI gets a map with evidence rather than a PDF of promises.

Unlike those four, this corpus carries verbatim texto. There the citations were
never checked word-for-word against the official publication, so an absent texto
was honesty; here the source is our own document in the repository, so
reproducing it is both legitimate and useful — the buyer reads the whole
requirement in the export, not a summary of it.

The corpus ships with no verdicts. Who decides whether Nebuloz meets a control
is a person, not a seed — that is the product's rule, and it applies to the
product itself."
```

---

## Verificação final

```bash
cd apps/app && NODE_ENV=test pnpm run test
cd apps/app && npx tsc --noEmit -p .
cd ../.. && npx @biomejs/biome check apps/app packages/database
```

Depois de mergear com a `main`, **rode a suíte de novo contra o resultado do merge**. Conflito semântico — um `Record` exaustivo em arquivo que chegou de outra branch e que agora precisa do valor novo — não aparece de nenhum outro jeito, e já derrubou o deploy desta base uma vez.

## O que este plano não faz

- **Não preenche veredito nenhum.** O corpus entra com 59 exigências e zero respostas. Quem decide se a Nebuloz atende um controle é uma pessoa; o seed não tem opinião. Este trabalho entrega a pergunta.
- **Não audita o código contra o checklist** — mas boa parte dessa auditoria já foi feita. `docs/compliance/2026-08-06-owasp-llm-top10-cosmos.md` registra os achados do OWASP LLM Top 10 sobre o Cosmos, com sete de oito corrigidos, e os commits `791f5d5d` e `27127462` trazem `fenceUntrusted`, o gate de rate limit do copilot, mascaramento e tetos de consumo. **Quem for preencher os vereditos começa por ali, não do zero** — vários itens de §4.1, §6 e §7 já têm evidência real no código.
- **Não avisa quando um `NAO_APLICAVEL` deixa de ser verdade.** O corpus não sabe o que a arquitetura virou. `publishSetVersion` cobre mudança de *texto* da exigência, não mudança de *contexto* do produto.

  Vale a pena saber como este risco já se materializou: a primeira versão do spec afirmava que a stack não tinha RAG, base vetorial, fine-tuning nem Python, e dispensava ~25 itens por isso. Todos os quatro existem — `packages/ai/lib/rag/`, `packages/database/vector-search.ts`, `experiments/slm-pipeline/scripts/*.py` — e `searchKnowledge` roda em produção no tool use do copilot. Tivesse virado corpus, ele nasceria dispensando §3.2 e §3.3, que são justamente as seções que cobrem esse código. **Nenhum item é `NAO_APLICAVEL` por suposição sobre a arquitetura; só por ausência que alguém conferiu e citou.**
