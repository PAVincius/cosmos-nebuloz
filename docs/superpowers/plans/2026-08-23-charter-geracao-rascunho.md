# Geração de rascunho de política (NEB-156) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a geração fake (`setTimeout` no `GenerateDraftModal`) por `generatePolicyDraft` real: IA grounded no inventário do tenant, por seção, com cota mensal, prévia inline aceitar/descartar e auditoria.

**Architecture:** Função pura de contexto+prompt em `lib/charter/policy-generation.ts` (testável por contrato); server action `generatePolicyDraft` em `(charter)/actions/policy.ts` no padrão canônico da casa (guard → zod → `withTenantDb` → audit → `Result`); prévia inline na seção DRAFT de `policy.tsx`, extraída para componente próprio para não estourar o file-size-guard. Gerar ≠ salvar: quem persiste é o `saveGeneratedDraft` existente, no clique de "Aceitar".

**Tech Stack:** Next.js App Router server actions, `generateText` do pacote `ai` + `getAIModel()` de `@repo/ai/lib/models`, `@repo/rate-limit` (Postgres, `fixedWindow`), Vitest + Testing Library (jsdom), zod.

**Spec:** `docs/superpowers/specs/2026-08-22-charter-geracao-politica-design.md` (já no main). Este plano SOBRESCREVE o spec nos pontos em que o spec erra contra o código real (lista abaixo).

## Global Constraints

- Branch de trabalho: `feat/neb-156-geracao-rascunho` a partir de `origin/main`, em worktree própria (`git worktree add ../cosmos-neb156 -b feat/neb-156-geracao-rascunho origin/main` a partir de `/Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz`).
- Verificação SEMPRE de dentro de `apps/app` com binários diretos: `./node_modules/.bin/vitest run` e `./node_modules/.bin/tsc --noEmit`. Saída longa → redirecionar para arquivo e ler o fim (o hook de shell comprime stdout com perdas).
- Commits em português, conventional commits. PROIBIDA qualquer atribuição do Claude (sem `Co-Authored-By`, sem `🤖 Generated with...`).
- Textos de UI e mensagens de erro em português.
- File-size-guard: nenhum arquivo pode crescer além do baseline (`pnpm size:guard` na raiz; `--update` proibido).
- Sem streaming, sem auto-publicação, sem entidade de perfil nova, sem migration de schema.

### Correções ao spec (o código real manda)

1. O enum de status é `PUBLISHED | REVIEW | DRAFT` — **não existe `IN_REVIEW`**.
2. `saveGeneratedDraft` já existe e aceita **um** `groundedRequirementId: string` obrigatório (escalar no schema). A action nova devolve a lista `grounded` completa; a tela passa `grounded[0].id` (fonte principal, maior peso) ao salvar. Não mudar o schema.
3. Só o corpus "Segurança em IA generativa — checklist Nebuloz" tem `categoria` (59 reqs; valores: backend, modelos, monitoramento, governança, runtime, frontend, dados, arquitetura). AI Act/LGPD/NIST/ISO (27 reqs) não têm categoria nenhuma. Regra de relevância da §4.1(3) do spec vira: **entra requisito cuja `categoria` está no mapa da seção OU requisito de conjunto sem categoria alguma** (corpus regulatório inteiro é relevante), cap de 30 por geração ordenando por `peso desc nulls last`.
4. A label de auditoria `"Gerou rascunho de seção"` já pertence ao `saveGeneratedDraft`. A geração usa `"Gerou rascunho por IA"`.
5. `safeAction` não propaga `code` — erro chega como string em `res.error`. Mensagens carregam a informação (ex.: dias até renovar).
6. `Button` do kit não tem `disabled`/`loading` — gate com o idioma da casa: `<span style={{opacity: X ? 1 : 0.45, pointerEvents: X ? "auto" : "none"}}>`.
7. Timeout de IA: não existe padrão de abort no repo; `try/catch` + resposta `< 200` chars tratada como falha.

---

### Task 1: Contexto e prompt puros (`policy-generation.ts`)

**Files:**
- Create: `apps/app/lib/charter/policy-generation.ts`
- Test: `apps/app/__tests__/charter/policy-generation.test.ts`

**Interfaces:**
- Consumes: nada do repo além de tipos primitivos (função pura; sem imports de db/ai).
- Produces (Task 2 depende):

```ts
export type CasoParaGeracao = {
  code: string; title: string; department: string | null;
  categoriasAltas: string[]; // rótulos pt-BR das categorias com risco>=4
};
export type FornecedorParaGeracao = { name: string; tier: "APPROVED" | "RESTRICTED" | "REVIEW" | "BLOCKED" };
export type ExigenciaParaGeracao = {
  id: string; codigo: string; citacao: string; resumo: string;
  categoria: string | null; peso: number | null; conjunto: string;
};
export type ContextoGeracao = {
  system: string;
  prompt: string;
  grounded: { id: string; codigo: string; citacao: string }[]; // já filtradas+ordenadas, mesmas do prompt
  fontes: { casos: number; fornecedores: number; exigencias: number };
};
export const SECAO_CATEGORIAS: Record<string, string[]>; // nome da seção → categorias do checklist
export function montarContextoGeracao(input: {
  secaoNome: string;
  casos: CasoParaGeracao[];
  fornecedores: FornecedorParaGeracao[];
  exigencias: ExigenciaParaGeracao[]; // TODAS as candidatas; a função filtra
}): ContextoGeracao;
```

**Conteúdo do mapa** (as 9 seções do bootstrap estão em `packages/provisioning/src/charter.ts:6-16`; as 8 categorias existentes no corpora são backend, modelos, monitoramento, governança, runtime, frontend, dados, arquitetura — todas precisam aparecer em ao menos uma seção):

```ts
export const SECAO_CATEGORIAS: Record<string, string[]> = {
  "Perfil organizacional e contexto": ["governança"],
  "Classificação de dados": ["dados"],
  "Usos permitidos": ["modelos", "runtime"],
  "Usos restritos": ["runtime", "monitoramento"],
  "Usos proibidos": ["governança", "modelos"],
  "IA voltada ao cliente": ["frontend", "runtime"],
  "Requisitos de aprovação": ["governança", "arquitetura"],
  "Human-in-the-loop": ["monitoramento", "frontend"],
  "Escalonamento e exceções": ["monitoramento", "backend"],
};
```

**Regras de `montarContextoGeracao`:**
- Filtro: exigência entra se `categoria === null` (corpus regulatório inteiro) OU `categoria ∈ SECAO_CATEGORIAS[secaoNome] ?? []`.
- Ordenação: `peso` desc, `null` por último; empate por `codigo` asc. Cap: 30.
- Sanitização: todo texto vindo do inventário passa por `sanitizar(s)` local — remove control chars (`/[ -]/g`) e corta em 200 chars (mesma ideia de `sanitizeForPrompt` de `lib/cost/anomaly-narrative.ts`; copiar localmente, não importar de lá).
- `system`: instruções fixas — português; tom declarativo de política ("A empresa..."/"É vedado..."), não explicativo; citar caso de uso e fornecedor pelo nome quando pertinente; **nunca inventar exigência — referenciar apenas as listadas, pelo código**; extensão alvo 250–400 palavras; sem markdown de título.
- `prompt`: nome da seção + blocos "Casos de uso:" (code — title — depto — categorias de risco altas), "Fornecedores:" (name — tier), "Exigências aplicáveis:" (codigo — citacao — resumo, uma por linha). Bloco vazio escreve "(nenhum cadastrado)" — a IA sabe que o inventário está vazio, não finge.
- `grounded` = exatamente as exigências que entraram no prompt, na mesma ordem.
- `fontes` = contagens pós-filtro.

- [ ] **Step 1: Escrever os testes de contrato (falhando)** em `apps/app/__tests__/charter/policy-generation.test.ts`. Idioma da casa: descrições em português, sem snapshot. Casos obrigatórios:

```ts
import { describe, expect, it } from "vitest";
import { CORPORA } from "../../../../packages/database/scripts/regulacao-corpora";
import {
  montarContextoGeracao,
  SECAO_CATEGORIAS,
} from "../../lib/charter/policy-generation";

// Mesmo idioma de import direto do corpora usado por licenca-copyright.test.ts.
describe("SECAO_CATEGORIAS", () => {
  it("cobre toda categoria existente nos corpora — categoria órfã acusa aqui", () => {
    const noMapa = new Set(Object.values(SECAO_CATEGORIAS).flat());
    const nosCorpora = new Set(
      CORPORA.flatMap((c) => c.requisitos.map((r) => r.categoria)).filter(
        (x): x is string => Boolean(x)
      )
    );
    for (const cat of nosCorpora) {
      expect(noMapa, `categoria "${cat}" sem seção`).toContain(cat);
    }
  });
  it("só usa as 9 seções do bootstrap", () => { /* comparar chaves com a lista literal das 9 */ });
});

describe("montarContextoGeracao", () => {
  it("inclui exigência sem categoria e exclui categoria de outra seção", ...);
  it("ordena por peso desc com null por último e corta em 30", ...);
  it("grounded espelha exatamente o que entrou no prompt, na ordem", ...);
  it("prompt cita caso e fornecedor pelo nome e marca bloco vazio com (nenhum cadastrado)", ...);
  it("system exige não inventar exigência", () => {
    const ctx = montarContextoGeracao({ secaoNome: "Classificação de dados", casos: [], fornecedores: [], exigencias: [] });
    expect(ctx.system).toMatch(/nunca invente|apenas as listadas/i);
  });
  it("sanitiza control chars e corta campos em 200", ...);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `./node_modules/.bin/vitest run __tests__/charter/policy-generation.test.ts` → falha com módulo inexistente.
- [ ] **Step 3: Implementar `policy-generation.ts`** conforme regras acima (arquivo ~150 linhas, função pura, zero I/O).
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `feat(charter): contexto puro da geração de rascunho por seção`

### Task 2: Action `generatePolicyDraft`

**Files:**
- Modify: `apps/app/app/(charter)/actions/policy.ts` (adicionar action ao fim; imports no topo)
- Test: `apps/app/__tests__/charter/generate-policy-draft.test.ts`

**Interfaces:**
- Consumes: `montarContextoGeracao`, tipos e `SECAO_CATEGORIAS` da Task 1; `requireCharterPermissionContext`, `withTenantDb`, `GovernanceError`, `logCharterAudit`, `safeAction`/`Result` já existentes no arquivo; `getActiveProvider`/`getAIModel` de `@repo/ai/lib/models`; `generateText` de `ai`; `createRateLimiter`/`fixedWindow` de `@repo/rate-limit` via **import dinâmico** (idioma do `analyze-invest`).
- Produces (Task 3 depende):

```ts
export async function generatePolicyDraft(input: { sectionId: string }): Promise<
  Result<{
    body: string;
    grounded: { id: string; codigo: string; citacao: string }[];
    fontes: { casos: number; fornecedores: number; exigencias: number };
  }>
>;
```

**Fluxo (na ordem — a ordem é testada):**
1. `requireCharterPermissionContext("policy.edit")`; `z.object({ sectionId: z.string().cuid() }).parse`.
2. `withTenantDb`: seção por `{ id, tenantId }`; ausente → `GovernanceError("section.unknown", "Seção não encontrada.")`; `status !== "DRAFT"` → `GovernanceError("section.notDraft", "Seção publicada ou em revisão não recebe rascunho gerado — edite uma revisão.")`.
3. Cota ANTES da IA: `const { createRateLimiter, fixedWindow } = await import("@repo/rate-limit");` → `createRateLimiter({ limiter: fixedWindow(30, "30 d"), prefix: "charter:policy-gen" })` → `limiter.limit(ctx.tenantId)`; `!success` → `GovernanceError("draft.quota", \`30 gerações de rascunho este mês; renova em ${dias} dia(s).\`)` com `dias = Math.max(1, Math.ceil((reset - Date.now()) / 86_400_000))`.
4. Inventário (3 queries, sempre com `tenantId: ctx.tenantId`):
   - casos: `db.charterUseCase.findMany({ where: { tenantId: ctx.tenantId }, select: { code, title, department, riskPrivacy, riskRegulatory, riskSecurity, riskBias, riskIp, riskOperational, riskReputational } })` → `categoriasAltas` = rótulos de `RISK_CATEGORY_LABEL` (importar de `@/lib/charter/rules`) cujo `risk* >= 4`.
   - fornecedores: `db.charterVendor.findMany({ where: { tenantId: ctx.tenantId }, select: { name, tier } })`.
   - exigências candidatas: conjuntos visíveis com cobertura do tenant — mesmo desenho de `compliance.ts:911-925`: buscar `charterCoverage.findMany({ where: { tenantId }, select: { requirementId } })`, resolver os `setId`s cobertos, e então `charterRequirement.findMany({ where: { setId: { in: setsCobertos }, set: { OR: [{ tenantId: ctx.tenantId }, { tenantId: null }] } }, select: { id, codigo, citacao, resumo, categoria, peso, set: { select: { nome } } } })`. Sem cobertura nenhuma → lista vazia (a função pura lida).
5. `montarContextoGeracao(...)`.
6. `getActiveProvider()`; `"none"` → `GovernanceError("ia.indisponivel", "Nenhum provedor de IA configurado.")`. `generateText({ model: getAIModel(provider), system, prompt })` em try/catch; catch → `GovernanceError("ia.falhou", "A geração falhou — tente de novo.")`. `text.trim().length < 200` → mesmo erro com "resposta curta demais".
7. `logCharterAudit(db, ctx, { action: "Gerou rascunho por IA", entityType: "charter.section", entityId: section.id, target: \`S${ordinal 2 dígitos} · ${section.name}\`, note: \`modelo ${provider} · ${fontes.exigencias} exigência(s), ${fontes.casos} caso(s), ${fontes.fornecedores} fornecedor(es)\` })` — **sem diff** (nada persistido além da trilha).
8. Retornar `{ body: text.trim(), grounded, fontes }`. **Sem `revalidatePath`** — nada mudou no banco além do audit.

- [ ] **Step 1: Escrever testes (falhando)** em `generate-policy-draft.test.ts`, molde de mocks de `grounded-draft.test.ts` (hoisted + `vi.mock` de `@/lib/charter/guards` parcial, `next/cache`, `@repo/database` com `withTenantDb` fake) SOMADO aos mocks de IA e cota:

```ts
const ia = vi.hoisted(() => ({
  generateText: vi.fn(),
  getAIModel: vi.fn().mockReturnValue({}),
  getActiveProvider: vi.fn().mockReturnValue("anthropic"),
}));
vi.mock("ai", () => ({ generateText: ia.generateText }));
vi.mock("@repo/ai/lib/models", () => ({ getAIModel: ia.getAIModel, getActiveProvider: ia.getActiveProvider }));
const cota = vi.hoisted(() => ({ limit: vi.fn(), createRateLimiter: vi.fn(), fixedWindow: vi.fn() }));
vi.mock("@repo/rate-limit", () => ({ createRateLimiter: cota.createRateLimiter, fixedWindow: cota.fixedWindow }));
// beforeEach: cota.createRateLimiter.mockReturnValue({ limit: cota.limit });
//             cota.limit.mockResolvedValue({ success: true, reset: Date.now() + 86_400_000 });
//             ia.generateText.mockResolvedValue({ text: "x".repeat(300) });
```

Casos obrigatórios: (a) seção `REVIEW` e `PUBLISHED` recusam com "não recebe rascunho gerado" e `generateText` NÃO foi chamado; (b) cota negada → mensagem contém "renova em" e dias ≥ 1, `generateText` NÃO chamado; (c) resposta `< 200` chars → `ok:false` e nada auditado além de nada persistido (`sectionUpdate` nunca chamado em NENHUM caso desta action); (d) sucesso → `ok:true`, `grounded` não-vazio quando havia exigência relevante, audit criado com `action: "Gerou rascunho por IA"` e note contendo "exigência"; (e) todos os `findMany` chamados com `tenantId` do ctx (asserção nos argumentos — prova de isolamento); (f) provider "none" → erro "Nenhum provedor".

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar a action** (fluxo acima).
- [ ] **Step 4: Rodar o arquivo de teste e ver passar; rodar `./node_modules/.bin/tsc --noEmit`.**
- [ ] **Step 5: Commit** — `feat(charter): action generatePolicyDraft com cota, grounding e auditoria`

### Task 3: Prévia inline na tela + morte do modal fake

**Files:**
- Create: `apps/app/components/charter/screens/policy-draft-preview.tsx`
- Modify: `apps/app/components/charter/screens/policy.tsx` (remover botão global "Gerar rascunho" do PageHeader ~linha 275, remover `openGenerate` ~190-233 e o import de `GenerateDraftModal`; inserir `<PolicyDraftPreview>` no `SectionCard` da seção selecionada, entre o `Callout` (~488-498) e o bloco de botões (~500); botão por seção só quando `sel.status === "DRAFT"`)
- Modify: `apps/app/components/charter/modals.tsx` (DELETAR `GenerateDraftModal` inteiro, ~1155-1290 — o fake de `setTimeout` morre; `grep -rn "GenerateDraftModal" apps/` antes para atualizar qualquer teste que o cite)
- Test: `apps/app/__tests__/charter/policy-draft-preview.test.tsx`

**Interfaces:**
- Consumes: `generatePolicyDraft` (Task 2), `saveGeneratedDraft` existente, `useActionToast`, kit (`Button`, `Callout`, `Textarea`).
- Produces: componente

```ts
export function PolicyDraftPreview(props: {
  sectionId: string;
  sectionName: string;
  bodyAtual: string; // corpo existente da seção — decide a confirmação de sobrescrita
  onAccepted: () => void; // tela chama reload()
}): JSX.Element;
```

**Comportamento:**
- Estados locais: `idle | gerando | pronto | erro` + `{ body, grounded, fontes }` + flag `confirmandoSobrescrita`.
- "Gerar rascunho" (variant secondary, icon sparkles): se `bodyAtual.trim() !== ""` e primeira vez → vira "Gerar por cima do texto atual?" (2º clique confirma — confirmação em dois cliques no MESMO botão, sem `window.confirm`); dispara `generatePolicyDraft({ sectionId })` via `startTransition` + `runWithToast` (loading "Gerando rascunho… ~10s").
- Durante `gerando`: botão gated com o idioma span (opacity/pointerEvents) — `Button` não tem `disabled`.
- `pronto`: prévia em `Textarea` readonly-visual (ou bloco `<pre>` com o corpo), linha de proveniência "N exigência(s), M caso(s), K fornecedor(es)"; quando `fontes.casos + fontes.fornecedores === 0`, `Callout` âmbar: "Rascunho genérico: nenhum caso de uso ou fornecedor no inventário. Cadastre-os para um rascunho ancorado na realidade da empresa." Botões: "Aceitar rascunho" → `saveGeneratedDraft({ sectionId, body, groundedRequirementId: grounded[0].id })` (grounded vazio → botão gated com title "Sem exigência para fundamentar — cadastre cobertura"); "Descartar" → volta a `idle` limpando tudo.
- `erro`: mensagem do `res.error` + botão "Tentar de novo".
- Nada persiste até "Aceitar" — descartar não toca o banco.

- [ ] **Step 1: Escrever testes (falhando)** — molde `policy-scope.test.tsx` (jsdom, mock de `sonner`, mocks hoisted das duas actions):

```ts
const gerarMock = vi.hoisted(() => vi.fn());
const salvarMock = vi.hoisted(() => vi.fn());
vi.mock("@/app/(charter)/actions/policy", () => ({
  generatePolicyDraft: (...a: unknown[]) => gerarMock(...a),
  saveGeneratedDraft: (...a: unknown[]) => salvarMock(...a),
}));
```

Casos obrigatórios: (a) mock atrasado `gerarMock.mockReturnValue(new Promise(() => {}))` → botão gated e texto de gerando visível; (b) sucesso → corpo na tela e "Aceitar" chama `salvarMock` com `{ sectionId, body, groundedRequirementId: "req-1" }` EXATOS (primeira da lista); (c) "Descartar" limpa a prévia e `salvarMock` nunca chamado; (d) `ok:false` → `res.error` visível e "Tentar de novo" re-dispara `gerarMock` (2 chamadas); (e) `bodyAtual` não-vazio → 1º clique NÃO chama `gerarMock`, 2º clique chama (prova da confirmação); (f) inventário zero (`fontes` zerado) → aviso "Rascunho genérico" visível.

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar componente + integração em `policy.tsx` + deletar o modal fake.**
- [ ] **Step 4: Rodar arquivo de teste; depois grep de `GenerateDraftModal` para confirmar zero referências; `tsc --noEmit`.**
- [ ] **Step 5: Commit** — `feat(charter): prévia inline de rascunho gerado substitui o modal fake`

### Task 4: Verificação integral

- [ ] Suíte inteira de `apps/app`: `./node_modules/.bin/vitest run` → 0 falhas.
- [ ] `./node_modules/.bin/tsc --noEmit` → limpo.
- [ ] `pnpm size:guard` na raiz → verde (policy.tsx encolheu ou estável; modals.tsx encolheu; arquivos novos < 800).
- [ ] `pnpm check` (biome) nos arquivos tocados → limpo (ou `pnpm fix` antes).
- [ ] Copiar o plano para `docs/superpowers/plans/2026-08-23-charter-geracao-rascunho.md` e commitar junto: `docs: plano da geração de rascunho de política (NEB-156)`.
- [ ] Push `git push -u origin feat/neb-156-geracao-rascunho`. NÃO criar PR (o orquestrador cria depois da revisão).

## Self-review (feito na escrita)

- Cobertura do spec: §4.1 fluxo 1-6 → Tasks 1-2; §4.2 grounding → Task 2 (retorno) + Task 3 (repasse ao save, adaptado a escalar); §4.3 tela → Task 3; §5 erros → Tasks 2-3 (linha a linha da tabela); §6 testes → todos os casos mapeados; §2 aviso de inventário → Task 3(f) adaptado para pós-geração (sem action nova de contagem — YAGNI).
- Divergências spec↔código: resolvidas nas "Correções ao spec".
- Consistência de tipos: `ContextoGeracao.grounded` = retorno da action = props da prévia (`{id, codigo, citacao}[]`); `fontes` idem.
