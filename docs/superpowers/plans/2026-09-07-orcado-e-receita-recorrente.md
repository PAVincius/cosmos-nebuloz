# Orçado × realizado e receita recorrente (D-b) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Duas abas novas em `/empresa/financeiro`: orçado contra realizado por conta e mês, com o realizado saindo do livro-razão; e receita recorrente com MRR, ARR, movimento do mês, uso de franquia de IA e a receita de serviço ao lado, nunca dentro.

**Architecture:** Quatro modelos novos em `empresa.prisma`, todos aditivos e sem tocar no livro-razão do D-a. Um módulo puro `recorrente.ts` que reconstrói o valor de cada assinatura na competência a partir do histórico append-only, de modo que o MRR de um mês passado não muda quando alguém edita um contrato hoje. Actions no padrão `safeAction`. O realizado nunca é coluna: sai sempre da soma dos lançamentos.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (schema multi-arquivo), zod 4, Vitest 4 + jsdom, Biome, tokens do design system do back-office.

**Spec:** [`docs/superpowers/specs/2026-09-06-base-financeira-design.md`](../specs/2026-09-06-base-financeira-design.md) — §1.3, §1.4, a parte de `recorrente.ts` do §2, a parte de `recorrente.ts` do §3, as duas últimas abas do §4, e o §5. Livro-razão e títulos são o plano D-a, já entregue.

## Global Constraints

- Worktree `/Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/.claude/worktrees/mapa-pendencias-criticas-803c5f`, branch `claude/telas-empresa-modelo`. Nunca `cd` para o checkout principal. Nunca `git stash`.
- Stage só dos próprios arquivos. NUNCA `pnpm fix` nem `pnpm check` na raiz. Lint só nos arquivos tocados: `../../node_modules/.bin/biome check --write <arquivos>`.
- Teste escopado: `cd apps/backoffice && npx vitest run __tests__/<arquivo>`.
- `/usr/bin/grep` e `/usr/bin/git`. Nenhum implementer despacha subagentes.
- Commits em português, `tipo(escopo): descrição`, sem trailer `Co-Authored-By`.
- Tenant `system` (`SYSTEM_TENANT_ID` de `@/lib/guard`) em toda consulta.
- **Módulo `"use server"` só exporta função `async` guardada ou tipo.** Todo export de um módulo desses é uma server action alcançável por POST, e o guard do layout não roda antes dela. Helper que toca o banco vai para `lib/empresa/consultas.ts`, que não tem a diretiva. O teste `__tests__/no-cross-tenant-leak.test.ts` já exige `requirePlatformStaff` dentro de cada `export async function` de `app/actions/empresa/` e lista os arquivos por nome: arquivo novo entra na lista.
- Toda action: `safeAction` + `requirePlatformStaff`; escrita adiciona `assertCanWrite`, `logPlatformAudit`, `revalidatePath("/empresa/financeiro")`. Escrita que toca duas tabelas vai em `$transaction`, com `updateMany` guardado pelo estado lido e `count === 0` tratado como erro.
- `lib/` é puro: `import type` apenas.
- Datas atravessam a fronteira do servidor como string ISO. Nada cruza como `Date` nem como função — foi assim que a tela do Financeiro caiu em produção.
- Só tokens CSS. Biome: sem ternário aninhado, `noLeakedRender` pré-calculado, sem componente dentro de componente, complexidade cognitiva em helpers, `useTopLevelRegex`. `Celula` não aceita `className`.
- Dinheiro é `Int` em centavos. Campo editável de dinheiro usa `centavosParaCampo`/`paraCentavos` de `lib/comercial/formato.ts` — não criar uma quarta formatação.
- Verificação de cada task: testes próprios verdes, `npx tsc --noEmit --emitDeclarationOnly false` zero erros em `apps/backoffice`, Biome limpo nos arquivos tocados.

## Decisões tomadas ao planejar

- **O MRR de um mês passado não pode mudar.** A spec assina `mrr(assinaturas, competencia)`, o que usaria o valor atual do contrato e faria o histórico se reescrever a cada reajuste. A assinatura passa a ser `mrr(assinaturas, mudancas, competencia)`: o valor de uma assinatura numa competência é o `paraCentavos` da última `MudancaDeAssinatura` com `competencia <= alvo`. É o mesmo princípio que fez o DRE somar linhas em vez de ler um número solto.
- **Ativa numa competência** = `iniciouEm <= último dia do mês` e (`encerradaEm` nula ou `encerradaEm > último dia do mês`). MRR é foto do fim do mês, que é a convenção que o movimento do mês fecha contra.
- **Serviço sai do plano de contas, não de heurística.** 1.1–1.4 são assinatura, 1.5–1.8 são serviço, pelos próprios nomes das contas semeadas. Vira constante no módulo puro, com um teste que falha se uma conta nova do grupo 1 não for classificada.
- **`criarAssinatura` grava a linha NOVO do histórico na mesma transação.** Sem isso o MRR do mês de entrada fica zero, porque o valor da competência vem do histórico.
- **Orçamento não guarda realizado.** `OrcamentoDaConta` tem só o orçado; o realizado é sempre `agregarPorMes` sobre os lançamentos. Dois números para a mesma pergunta é como um deles fica errado.
- **`sinalDoGrupo` e `dreDeLancamentos` da spec §2 continuam fora.** O DRE usa estrutura, não sinal por grupo, e `agregarPorMes` + `calcularDre` já resolvem. A spec descreve uma API que o código não precisou.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `packages/database/prisma/schema/empresa.prisma` | os quatro modelos novos |
| `packages/database/prisma/migrations/20260911000000_orcamento_e_recorrente/migration.sql` | DDL + RLS |
| `apps/backoffice/lib/empresa/recorrente.ts` | MRR, ARR, movimento, churn, franquia, excedente, receita de serviço |
| `apps/backoffice/app/actions/empresa/orcamento.ts` | ler e salvar orçado |
| `apps/backoffice/app/actions/empresa/recorrente.ts` | assinaturas, mudanças, crédito do mês |
| `apps/backoffice/app/(staff)/empresa/financeiro/orcado.tsx` | aba Orçado × realizado |
| `apps/backoffice/app/(staff)/empresa/financeiro/recorrente.tsx` + `recorrente-dialogs.tsx` | aba Receita recorrente |
| `apps/backoffice/app/(staff)/empresa/financeiro/page.tsx` | mais duas abas |

---

## Task 1: Schema e migration

**Files:**
- Modify: `packages/database/prisma/schema/empresa.prisma`, `packages/database/prisma/schema/tenant.prisma`
- Create: `packages/database/prisma/migrations/20260911000000_orcamento_e_recorrente/migration.sql`

**Interfaces:**
- Produces: `database.orcamentoDaConta`, `database.assinaturaDoTenant`, `database.mudancaDeAssinatura`, `database.creditoDoMes`.

- [ ] **Step 1: Acrescentar os modelos**

Em `empresa.prisma`, depois de `model Titulo`, os quatro modelos exatamente como a spec §1.3 e §1.4 os define. Copiar de lá verbatim, incluindo os comentários `///`, e acrescentar a cada um a relação com `Tenant` no padrão dos vizinhos:

```prisma
  tenant Tenant @relation("OrcamentoDaContaSystemTenant", fields: [tenantId], references: [id], onDelete: Cascade)
```

com os nomes `OrcamentoDaContaSystemTenant`, `AssinaturaDoTenantSystemTenant`, `MudancaDeAssinaturaSystemTenant`, `CreditoDoMesSystemTenant`. Em `tenant.prisma`, no `model Tenant`, as quatro retro-relações:

```prisma
  orcamentos           OrcamentoDaConta[]     @relation("OrcamentoDaContaSystemTenant")
  assinaturas          AssinaturaDoTenant[]   @relation("AssinaturaDoTenantSystemTenant")
  mudancasDeAssinatura MudancaDeAssinatura[]  @relation("MudancaDeAssinaturaSystemTenant")
  creditosDoMes        CreditoDoMes[]         @relation("CreditoDoMesSystemTenant")
```

Atenção a três coisas que a spec fixa e que é fácil errar ao copiar: `precoCreditoExtraCentavos` é `Int` obrigatório; `tetoExcedenteCentavos` é `Int?` e nulo significa não cobrar; `CreditoDoMes` tem `@@unique([tenantId, clienteSlug, competencia])`.

- [ ] **Step 2: Validar**

Run: `cd packages/database && npx prisma validate`
Expected: `The schema at prisma/schema is valid 🚀`

- [ ] **Step 3: Gerar o DDL e acrescentar o RLS**

```bash
cd packages/database
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --script > /tmp/db.sql
```

Criar a migration com esse conteúdo, conferindo que só há DDL das quatro tabelas novas, seus índices e as FKs. Ao fim, o bloco RLS byte a byte no padrão de `20260910000000_livro_razao_e_titulos`, com as quatro tabelas no `ARRAY`.

Esta migration não copia dado nenhum, então não precisa da verificação de contagem que a do livro-razão tem.

- [ ] **Step 4: Aplicar no local e gerar o client**

```bash
cd packages/database
set -a; . ../../apps/app/.env.local; set +a
npx prisma migrate deploy
npx prisma generate --no-hints
```
Expected: `Applying migration 20260911000000_orcamento_e_recorrente` e `Generated Prisma Client`. Depois, `cd apps/backoffice && npx tsc --noEmit --emitDeclarationOnly false` continua em zero.

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema/empresa.prisma packages/database/prisma/schema/tenant.prisma packages/database/prisma/migrations/20260911000000_orcamento_e_recorrente
git commit -m "feat(database): orçamento por conta, assinatura do tenant, histórico de mudança e crédito do mês"
```

---

## Task 2: Regras puras da receita recorrente

**Files:**
- Create: `apps/backoffice/lib/empresa/recorrente.ts`
- Test: `apps/backoffice/__tests__/empresa-recorrente.test.ts`

**Interfaces:**
- Consumes: `Conta` de `lib/empresa/plano-de-contas.ts`; `LancamentosDoMes` de `lib/empresa/financeiro.ts`.
- Produces: tipos `AssinaturaRow`, `MudancaRow`, `CreditoRow`, `TipoDeMudanca`, `Movimento`, `UsoDaFranquia`, `Excedente`; constantes `CONTAS_DE_ASSINATURA`, `CONTAS_DE_SERVICO`, `ROTULO_TIPO_MUDANCA`, `TOM_TIPO_MUDANCA`; funções `valorNaCompetencia`, `ativaNaCompetencia`, `mrr`, `arr`, `movimento`, `churnDeReceita`, `churnDeClientes`, `receitaDeServico`, `usoDaFranquia`, `excedenteDoMes`.

- [ ] **Step 1: Escrever o teste (RED)**

Criar `apps/backoffice/__tests__/empresa-recorrente.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  arr,
  type AssinaturaRow,
  ativaNaCompetencia,
  CONTAS_DE_ASSINATURA,
  CONTAS_DE_SERVICO,
  churnDeClientes,
  churnDeReceita,
  type CreditoRow,
  excedenteDoMes,
  movimento,
  mrr,
  type MudancaRow,
  receitaDeServico,
  usoDaFranquia,
  valorNaCompetencia,
} from "@/lib/empresa/recorrente";
import type { Conta } from "@/lib/empresa/plano-de-contas";

function a(over: Partial<AssinaturaRow> & { id: string }): AssinaturaRow {
  return {
    id: over.id,
    clienteSlug: over.clienteSlug ?? `c-${over.id}`,
    clienteNome: over.clienteNome ?? "Cliente",
    planoSlug: over.planoSlug ?? "scale",
    valorMensalCentavos: over.valorMensalCentavos ?? 100_000,
    creditosMesIncluidos: over.creditosMesIncluidos ?? 1000,
    precoCreditoExtraCentavos: over.precoCreditoExtraCentavos ?? 10,
    tetoExcedenteCentavos: over.tetoExcedenteCentavos ?? null,
    iniciouEm: over.iniciouEm ?? "2026-01-15",
    encerradaEm: over.encerradaEm ?? null,
    motivoEncerramento: over.motivoEncerramento ?? null,
    propostaId: over.propostaId ?? null,
  };
}

function m(
  assinaturaId: string,
  competencia: string,
  tipo: MudancaRow["tipo"],
  de: number,
  para: number
): MudancaRow {
  return {
    id: `${assinaturaId}-${competencia}-${tipo}`,
    assinaturaId,
    competencia,
    tipo,
    deCentavos: de,
    paraCentavos: para,
    motivo: "motivo suficiente",
    autorNome: null,
    criadoEm: `${competencia}-01T00:00:00.000Z`,
  };
}

describe("valorNaCompetencia", () => {
  const muds = [
    m("a1", "2026-01", "NOVO", 0, 100_000),
    m("a1", "2026-03", "EXPANSAO", 100_000, 150_000),
    m("a1", "2026-06", "CONTRACAO", 150_000, 120_000),
  ];

  it("usa a última mudança até a competência, não o valor atual", () => {
    expect(valorNaCompetencia("a1", muds, "2026-01")).toBe(100_000);
    expect(valorNaCompetencia("a1", muds, "2026-02")).toBe(100_000);
    expect(valorNaCompetencia("a1", muds, "2026-03")).toBe(150_000);
    expect(valorNaCompetencia("a1", muds, "2026-05")).toBe(150_000);
    expect(valorNaCompetencia("a1", muds, "2026-09")).toBe(120_000);
  });

  it("antes da primeira mudança vale zero — o contrato ainda não existia", () => {
    expect(valorNaCompetencia("a1", muds, "2025-12")).toBe(0);
  });

  it("ignora mudança de outra assinatura", () => {
    expect(valorNaCompetencia("a2", muds, "2026-09")).toBe(0);
  });
});

describe("ativaNaCompetencia", () => {
  it("entra no mês em que começa, mesmo no último dia", () => {
    expect(ativaNaCompetencia(a({ id: "x", iniciouEm: "2026-03-31" }), "2026-03")).toBe(true);
    expect(ativaNaCompetencia(a({ id: "x", iniciouEm: "2026-04-01" }), "2026-03")).toBe(false);
  });

  it("sai no mês seguinte ao encerramento — a foto é do fim do mês", () => {
    const enc = a({ id: "x", iniciouEm: "2026-01-01", encerradaEm: "2026-03-20" });
    expect(ativaNaCompetencia(enc, "2026-02")).toBe(true);
    expect(ativaNaCompetencia(enc, "2026-03")).toBe(false);
  });

  it("encerrada no último dia do mês já não conta nesse mês", () => {
    const enc = a({ id: "x", iniciouEm: "2026-01-01", encerradaEm: "2026-03-31" });
    expect(ativaNaCompetencia(enc, "2026-03")).toBe(false);
  });
});

describe("mrr e arr", () => {
  const ass = [
    a({ id: "a1", iniciouEm: "2026-01-10" }),
    a({ id: "a2", iniciouEm: "2026-02-01", encerradaEm: "2026-04-10" }),
  ];
  const muds = [
    m("a1", "2026-01", "NOVO", 0, 100_000),
    m("a2", "2026-02", "NOVO", 0, 50_000),
    m("a1", "2026-03", "EXPANSAO", 100_000, 150_000),
    m("a2", "2026-04", "CHURN", 50_000, 0),
  ];

  it("soma o valor da competência, não o atual", () => {
    expect(mrr(ass, muds, "2026-02")).toBe(150_000);
    expect(mrr(ass, muds, "2026-03")).toBe(200_000);
  });

  it("assinatura encerrada sai do mês do encerramento", () => {
    expect(mrr(ass, muds, "2026-04")).toBe(150_000);
  });

  it("ARR é doze vezes o MRR", () => {
    expect(arr(150_000)).toBe(1_800_000);
  });
});

describe("movimento", () => {
  const muds = [
    m("a1", "2026-05", "NOVO", 0, 100_000),
    m("a2", "2026-05", "EXPANSAO", 50_000, 80_000),
    m("a3", "2026-05", "CONTRACAO", 90_000, 60_000),
    m("a4", "2026-05", "CHURN", 40_000, 0),
    m("a5", "2026-05", "REATIVACAO", 0, 20_000),
    m("a6", "2026-06", "NOVO", 0, 999),
  ];

  it("separa os cinco tipos e fecha o líquido", () => {
    expect(movimento(muds, "2026-05")).toEqual({
      novo: 100_000,
      expansao: 30_000,
      contracao: 30_000,
      churn: 40_000,
      reativacao: 20_000,
      liquido: 100_000 + 30_000 + 20_000 - 30_000 - 40_000,
    });
  });

  it("mês sem mudança devolve tudo zerado", () => {
    expect(movimento(muds, "2026-07")).toEqual({
      novo: 0,
      expansao: 0,
      contracao: 0,
      churn: 0,
      reativacao: 0,
      liquido: 0,
    });
  });
});

describe("churn", () => {
  const muds = [m("a4", "2026-05", "CHURN", 40_000, 0)];

  it("churn de receita é o perdido sobre o MRR de entrada", () => {
    expect(churnDeReceita(muds, "2026-05", 400_000)).toBe(10);
  });

  it("sem MRR de entrada não há percentual", () => {
    expect(churnDeReceita(muds, "2026-05", 0)).toBeNull();
  });

  it("churn de clientes conta quem encerrou na competência", () => {
    const ass = [
      a({ id: "a1", iniciouEm: "2026-01-01" }),
      a({ id: "a2", iniciouEm: "2026-01-01", encerradaEm: "2026-05-10" }),
    ];
    expect(churnDeClientes(ass, "2026-05")).toEqual({ sairam: 1, base: 2, percent: 50 });
  });
});

describe("receitaDeServico", () => {
  const CONTAS: Conta[] = [
    { conta: "1.3", nome: "Assinatura Cosmos", grupo: 1, centroDeCusto: null, ativa: true },
    { conta: "1.5", nome: "Serviço diagnóstico", grupo: 1, centroDeCusto: null, ativa: true },
    { conta: "1.8", nome: "Outros serviços", grupo: 1, centroDeCusto: null, ativa: true },
  ];

  it("soma só as contas de serviço, nunca as de assinatura", () => {
    const l: Record<string, number> = { "1.3": 500_000, "1.5": 80_000, "1.8": 20_000 };
    expect(receitaDeServico(CONTAS, l)).toBe(100_000);
  });

  it("mês sem serviço é zero, não nulo — ausência aqui é zero de venda", () => {
    expect(receitaDeServico(CONTAS, { "1.3": 500_000 })).toBe(0);
  });

  it("as duas listas cobrem o grupo 1 inteiro e não se sobrepõem", () => {
    const todas = [...CONTAS_DE_ASSINATURA, ...CONTAS_DE_SERVICO];
    expect(new Set(todas).size).toBe(todas.length);
    expect(CONTAS_DE_ASSINATURA).toEqual(["1.1", "1.2", "1.3", "1.4"]);
    expect(CONTAS_DE_SERVICO).toEqual(["1.5", "1.6", "1.7", "1.8"]);
  });
});

describe("usoDaFranquia", () => {
  const c = (franquia: number, consumidos: number): CreditoRow => ({
    id: "c1",
    clienteSlug: "acme",
    competencia: "2026-05",
    franquia,
    consumidos,
    precoCreditoExtraCentavos: 10,
    excedenteCentavos: 0,
    excedenteReprimidoCentavos: 0,
  });

  it("devolve o percentual e a leitura", () => {
    expect(usoDaFranquia(c(1000, 200))).toEqual({ percent: 20, leitura: "OCIOSO" });
    expect(usoDaFranquia(c(1000, 600))).toEqual({ percent: 60, leitura: "SAUDAVEL" });
    expect(usoDaFranquia(c(1000, 1300))).toEqual({ percent: 130, leitura: "UPGRADE" });
  });

  it("exatamente no teto ainda é saudável; exatamente em 30% também", () => {
    expect(usoDaFranquia(c(1000, 1000)).leitura).toBe("SAUDAVEL");
    expect(usoDaFranquia(c(1000, 300)).leitura).toBe("SAUDAVEL");
  });

  it("franquia zero não divide por zero", () => {
    expect(usoDaFranquia(c(0, 50))).toEqual({ percent: null, leitura: "SEM_FRANQUIA" });
  });
});

describe("excedenteDoMes", () => {
  it("dentro da franquia não cobra nada", () => {
    expect(excedenteDoMes(1000, 800, 10, 100_000)).toEqual({ cobrado: 0, reprimido: 0 });
  });

  it("acima da franquia cobra proporcional à taxa", () => {
    expect(excedenteDoMes(1000, 1500, 10, 100_000)).toEqual({ cobrado: 5000, reprimido: 0 });
  });

  it("o teto corta e o resto vira reprimido", () => {
    expect(excedenteDoMes(1000, 1500, 10, 3000)).toEqual({ cobrado: 3000, reprimido: 2000 });
  });

  it("sem teto não cobra nada e tudo fica reprimido — é o padrão do contrato", () => {
    expect(excedenteDoMes(1000, 1500, 10, null)).toEqual({ cobrado: 0, reprimido: 5000 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/backoffice && npx vitest run __tests__/empresa-recorrente.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/empresa/recorrente"`.

- [ ] **Step 3: Escrever o módulo**

Criar `apps/backoffice/lib/empresa/recorrente.ts`, puro. Pontos que o teste fixa e que a implementação tem que respeitar:

- `CONTAS_DE_ASSINATURA = ["1.1","1.2","1.3","1.4"] as const` e
  `CONTAS_DE_SERVICO = ["1.5","1.6","1.7","1.8"] as const`, com um comentário
  dizendo que o plano de contas é a autoridade e que conta nova do grupo 1
  precisa entrar numa das duas listas.
- `valorNaCompetencia(assinaturaId, mudancas, competencia)`: filtra pela
  assinatura, descarta mudança com `competencia > alvo`, ordena por
  `competencia` e devolve o `paraCentavos` da última; sem nenhuma, zero.
  Comparação de competência é comparação de string `"AAAA-MM"`, que é
  lexicográfica e cronológica ao mesmo tempo.
- `ativaNaCompetencia(assinatura, competencia)`: `iniciouEm.slice(0,7) <= competencia`
  e (`encerradaEm === null` ou `encerradaEm.slice(0,7) > competencia`).
- `mrr(assinaturas, mudancas, competencia)`: soma de `valorNaCompetencia` das
  ativas.
- `arr(mrr)`: `mrr * 12`.
- `movimento(mudancas, competencia)`: `novo` e `reativacao` somam `paraCentavos`;
  `expansao` soma `para - de`; `contracao` soma `de - para`; `churn` soma `de`;
  `liquido = novo + expansao + reativacao - contracao - churn`.
- `churnDeReceita(mudancas, competencia, mrrInicial)`: `null` quando
  `mrrInicial` é zero; senão o churn do mês sobre ele, arredondado.
- `churnDeClientes(assinaturas, competencia)`: `sairam` são as com
  `encerradaEm` naquela competência; `base` são as ativas na competência
  anterior mais as que saíram; `percent` arredondado, `null` se base zero.
- `receitaDeServico(contas, lancamentosDoMes)`: soma das contas de serviço
  presentes; ausência conta zero, e isso é deliberado — diferente do DRE, onde
  ausência é nulo, aqui a pergunta é "quanto de serviço vendemos", e não vender
  é zero.
- `usoDaFranquia(credito)`: `SEM_FRANQUIA` com percentual nulo quando a
  franquia é zero; abaixo de 30% `OCIOSO`; acima de 100% `UPGRADE`; entre os
  dois, inclusive nos limites, `SAUDAVEL`.
- `excedenteDoMes(franquia, consumidos, taxa, teto)`: `bruto = max(0, consumidos - franquia) * taxa`;
  `cobrado = teto === null ? 0 : min(bruto, teto)`; `reprimido = bruto - cobrado`.

- [ ] **Step 4: Ver passar, tipos, lint, commit**

```bash
cd apps/backoffice
npx vitest run __tests__/empresa-recorrente.test.ts
npx tsc --noEmit --emitDeclarationOnly false
../../node_modules/.bin/biome check --write lib/empresa/recorrente.ts __tests__/empresa-recorrente.test.ts
cd ../..
git add apps/backoffice/lib/empresa/recorrente.ts apps/backoffice/__tests__/empresa-recorrente.test.ts
git commit -m "feat(backoffice): receita recorrente — MRR pela competência, movimento do mês, franquia e excedente"
```

---

## Task 3: Actions de orçamento e de receita recorrente

**Files:**
- Create: `apps/backoffice/app/actions/empresa/orcamento.ts`, `apps/backoffice/app/actions/empresa/recorrente.ts`
- Modify: `apps/backoffice/__tests__/no-cross-tenant-leak.test.ts` (lista de arquivos vai a oito)
- Test: `apps/backoffice/__tests__/empresa-orcamento-action.test.ts`, `apps/backoffice/__tests__/empresa-recorrente-action.test.ts`

**Interfaces:**
- Consumes: os quatro modelos (T1); os tipos e funções puras (T2); `contasDoPlano`/`assertContaAtiva` de `lib/empresa/consultas.ts`; `agregarPorMes` de `lib/empresa/livro.ts`; `competenciasNoIntervalo`, `IntervaloSchema`, `CAMPOS_INTERVALO`, `REFINE_INTERVALO` de `lib/empresa/periodo.ts`.
- Produces: `lerOrcado({de, ate})` → `Result<OrcadoView>`; `salvarOrcamento({competencia, conta, valorCentavos})`; `listarRecorrente({competencia})` → `Result<RecorrenteView>`; `criarAssinatura(input)`; `alterarValor({id, valorCentavos, motivo, competencia})`; `encerrarAssinatura({id, data, motivo})`; `salvarCreditoDoMes(input)`.

- [ ] **Step 1: Escrever os testes (RED)**

Em `no-cross-tenant-leak.test.ts` a lista esperada passa a ter oito arquivos: `cac.ts`, `consentimento.ts`, `financeiro.ts`, `fornecedores.ts`, `livro.ts`, `orcamento.ts`, `recorrente.ts`, `titulos.ts`, e o `it` passa a dizer "os oito arquivos existem".

`empresa-orcamento-action.test.ts`, no formato de `empresa-livro-action.test.ts`:
1. `lerOrcado` consulta `orcamentoDaConta` e `lancamento` com `tenantId` e `competencia in` as competências do intervalo.
2. `lerOrcado` devolve, por conta e competência, orçado, realizado e desvio; conta sem orçamento tem orçado nulo e realizado somado.
3. `salvarOrcamento` recusa conta desativada ou fora do plano (usa `assertContaAtiva`), sem `upsert`.
4. `salvarOrcamento` com `valorCentavos` nulo apaga a linha; com valor faz `upsert`; nos dois casos grava auditoria e revalida.
5. `salvarOrcamento` recusa `valorCentavos` negativo — orçado é magnitude, como no caixa.
6. MEMBER é recusado e nada chega ao banco.

`empresa-recorrente-action.test.ts`:
1. `listarRecorrente` lê assinaturas, mudanças, créditos e lançamentos, todos com `tenantId`.
2. `criarAssinatura` grava a assinatura E a linha `NOVO` do histórico na mesma `$transaction`; o teste confere os dois payloads.
3. `criarAssinatura` recusa `clienteSlug` vazio, `valorMensalCentavos <= 0`, `precoCreditoExtraCentavos < 0` e `iniciouEm` inválida.
4. `alterarValor` classifica sozinha: valor maior grava `EXPANSAO`, menor grava `CONTRACAO`, igual devolve `ok:false` sem escrever.
5. `alterarValor` usa `updateMany` guardado por `{id, tenantId, valorMensalCentavos: <o lido>}` e trata `count === 0` como erro.
6. `alterarValor` exige `motivo` com 10+ caracteres.
7. `encerrarAssinatura` grava `encerradaEm`, `motivoEncerramento` e a linha `CHURN` com `paraCentavos: 0`, na mesma transação; assinatura já encerrada é recusada.
8. `salvarCreditoDoMes` calcula `excedenteCentavos` e `excedenteReprimidoCentavos` com `excedenteDoMes`, congelando `franquia` e `precoCreditoExtraCentavos` da assinatura — o teste confere que o valor gravado é o calculado, não o enviado.
9. MEMBER recusado nas quatro escritas.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/backoffice && npx vitest run __tests__/empresa-orcamento-action.test.ts __tests__/empresa-recorrente-action.test.ts __tests__/no-cross-tenant-leak.test.ts`

- [ ] **Step 3: Escrever as actions**

Os dois arquivos com `"use server"` na primeira linha, exportando só função async guardada e tipo; a rota fica em constante local.

`orcamento.ts` — `OrcadoView` traz `competencias`, e por conta: `nome`, `grupo`, `centroDeCusto`, e por competência `{orcado: number | null, realizado: number | null, desvio: number | null}`. O realizado sai de `agregarPorMes` sobre os lançamentos do intervalo; desvio é `realizado - orcado` quando os dois existem, senão nulo.

`recorrente.ts` — `RecorrenteView` traz `competencia`, `assinaturas`, `mudancas`, `creditos`, e `lancamentosDaCompetencia` (só as contas do grupo 1, para a receita de serviço). `criarAssinatura`:

```ts
await database.$transaction(async (tx) => {
  const criada = await tx.assinaturaDoTenant.create({ data: { tenantId: SYSTEM_TENANT_ID, ...dados } });
  await tx.mudancaDeAssinatura.create({
    data: {
      tenantId: SYSTEM_TENANT_ID,
      assinaturaId: criada.id,
      competencia: dados.iniciouEm.slice(0, 7),
      tipo: "NOVO",
      deCentavos: 0,
      paraCentavos: dados.valorMensalCentavos,
      motivo: dados.motivo,
      autorId: staff.userId,
      autorNome: staff.name,
    },
  });
  return criada;
});
```

`alterarValor` lê a assinatura, compara, decide `EXPANSAO` ou `CONTRACAO`, e numa transação faz o `updateMany` guardado pelo valor lido mais o `create` do histórico. `encerrarAssinatura` idem, com `CHURN` e `paraCentavos: 0`. `salvarCreditoDoMes` lê a assinatura do cliente para congelar franquia e taxa, chama `excedenteDoMes` e faz `upsert` na chave única.

- [ ] **Step 4: Ver passar, tipos, lint, commit**

```bash
cd apps/backoffice
npx vitest run __tests__/empresa-orcamento-action.test.ts __tests__/empresa-recorrente-action.test.ts __tests__/no-cross-tenant-leak.test.ts
npx tsc --noEmit --emitDeclarationOnly false
../../node_modules/.bin/biome check --write app/actions/empresa/orcamento.ts app/actions/empresa/recorrente.ts __tests__/empresa-orcamento-action.test.ts __tests__/empresa-recorrente-action.test.ts __tests__/no-cross-tenant-leak.test.ts
cd ../..
git add apps/backoffice/app/actions/empresa/orcamento.ts apps/backoffice/app/actions/empresa/recorrente.ts apps/backoffice/__tests__/empresa-orcamento-action.test.ts apps/backoffice/__tests__/empresa-recorrente-action.test.ts apps/backoffice/__tests__/no-cross-tenant-leak.test.ts
git commit -m "feat(backoffice): actions de orçamento e de assinatura, com histórico gravado na mesma transação"
```

---

## Task 4: Aba Orçado × realizado

**Files:**
- Create: `apps/backoffice/app/(staff)/empresa/financeiro/orcado.tsx`
- Modify: `apps/backoffice/app/(staff)/empresa/financeiro/page.tsx`
- Test: `apps/backoffice/__tests__/empresa-orcado.test.tsx`

**Interfaces:**
- Consumes: `lerOrcado`, `salvarOrcamento` (T3).
- Produces: `Orcado` (client).

- [ ] **Step 1: Escrever o teste (RED)**

`__tests__/empresa-orcado.test.tsx`, jsdom, com `vi.mock("@/app/actions/empresa/orcamento")`. Casos:
1. Uma linha por conta, com orçado, realizado e desvio por competência.
2. Desvio que estoura o orçado aparece com o tom vermelho; desvio dentro do orçado, não.
3. Conta sem orçamento mostra o campo vazio e o realizado somado.
4. Editar o orçado chama `salvarOrcamento` com `{competencia, conta, valorCentavos}` em centavos.
5. Esvaziar o campo chama `salvarOrcamento` com `valorCentavos: null`.
6. O rodapé soma por centro de custo.
7. `podeEscrever={false}` deixa os campos só de leitura.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/backoffice && npx vitest run __tests__/empresa-orcado.test.tsx`

- [ ] **Step 3: Escrever a aba**

`page.tsx`: `Aba` ganha `"orcado"`; `abaValida` aceita; `Abas` ganha o link depois de Títulos; `carregarDados` e `PainelDaAba` ganham o ramo, com o padrão de intervalo de competência e `lerOrcado({de, ate})`.

`orcado.tsx` (`"use client"`): payload em `useState`, `recarregar()` após cada escrita. Tabela com uma linha por conta, agrupada por centro de custo, e por competência três colunas: orçado editável, realizado só leitura, desvio. Desvio em vermelho quando o realizado passa do orçado numa conta de custo ou despesa, e quando fica abaixo numa conta de receita — a direção do "ruim" depende do grupo, e isso é regra, não estética. Rodapé com o total por centro e o total geral. O campo de orçado usa `centavosParaCampo`/`paraCentavos` e salva no `onBlur`, como o DRE fazia antes.

- [ ] **Step 4: Ver passar, tipos, lint, commit**

```bash
cd apps/backoffice
npx vitest run __tests__/empresa-orcado.test.tsx
npx tsc --noEmit --emitDeclarationOnly false
../../node_modules/.bin/biome check --write "app/(staff)/empresa/financeiro/orcado.tsx" "app/(staff)/empresa/financeiro/page.tsx" __tests__/empresa-orcado.test.tsx
cd ../..
git add "apps/backoffice/app/(staff)/empresa/financeiro" apps/backoffice/__tests__/empresa-orcado.test.tsx
git commit -m "feat(backoffice): aba Orçado × realizado — desvio por conta e por centro de custo"
```

---

## Task 5: Aba Receita recorrente

**Files:**
- Create: `apps/backoffice/app/(staff)/empresa/financeiro/recorrente.tsx`, `recorrente-dialogs.tsx`
- Modify: `apps/backoffice/app/(staff)/empresa/financeiro/page.tsx`
- Test: `apps/backoffice/__tests__/empresa-recorrente-tela.test.tsx`

**Interfaces:**
- Consumes: `listarRecorrente`, `criarAssinatura`, `alterarValor`, `encerrarAssinatura`, `salvarCreditoDoMes` (T3); todo o módulo puro (T2); `listClients` de `app/actions/clients.ts`, para o seletor de cliente.
- Produces: `Recorrente` (client), `NovaAssinaturaDialog`, `AlterarValorDialog`, `EncerrarDialog`, `CreditoDialog`.

- [ ] **Step 1: Escrever o teste (RED)**

`__tests__/empresa-recorrente-tela.test.tsx`, jsdom, mocks das actions. Casos:
1. Os quatro cartões: MRR, ARR, líquido do mês e churn de receita, com os números do payload.
2. A cascata do mês mostra novo, expansão, contração, churn e reativação.
3. A tabela de assinaturas mostra valor da competência, degrau, franquia, uso e excedente; assinatura encerrada aparece marcada e fora do MRR.
4. A receita de serviço aparece em faixa própria, com o rótulo dizendo que não é recorrente e não entra no ARR.
5. Cliente com uso acima de 100% da franquia mostra o sinal de upgrade; abaixo de 30%, o de ocioso.
6. "Alterar valor" exige motivo com 10+ caracteres e chama `alterarValor` com a competência escolhida.
7. "Encerrar" confirma em duas etapas e chama `encerrarAssinatura` com data e motivo.
8. `podeEscrever={false}` esconde as quatro escritas.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/backoffice && npx vitest run __tests__/empresa-recorrente-tela.test.tsx`

- [ ] **Step 3: Escrever a aba**

`page.tsx`: `Aba` ganha `"recorrente"`, com um seletor de competência simples (`<input type="month">` que navega, não o `SeletorDaAba`, porque aqui o recorte é um mês e não um intervalo).

`recorrente.tsx`: quatro `KpiCard`; a cascata como barras horizontais com o tom por tipo (`TOM_TIPO_MUDANCA`); a tabela de assinaturas com as ações por linha; a faixa de receita de serviço abaixo, visualmente separada, com o texto explicando por que está fora do ARR. `recorrente-dialogs.tsx`: os quatro diálogos, corpo desmontado ao fechar, erro via `Erro` sem fechar. O seletor de cliente em "Nova assinatura" vem de `listClients`, mostrando nome e slug.

- [ ] **Step 4: Ver passar, tipos, lint, commit**

```bash
cd apps/backoffice
npx vitest run __tests__/empresa-recorrente-tela.test.tsx __tests__/empresa-orcado.test.tsx
npx tsc --noEmit --emitDeclarationOnly false
../../node_modules/.bin/biome check --write "app/(staff)/empresa/financeiro/recorrente.tsx" "app/(staff)/empresa/financeiro/recorrente-dialogs.tsx" "app/(staff)/empresa/financeiro/page.tsx" __tests__/empresa-recorrente-tela.test.tsx
cd ../..
git add "apps/backoffice/app/(staff)/empresa/financeiro" apps/backoffice/__tests__/empresa-recorrente-tela.test.tsx
git commit -m "feat(backoffice): aba Receita recorrente — MRR, movimento do mês, franquia de IA e serviço ao lado"
```

---

## Task 6: Verificação e registro

**Files:**
- Create: `.claude/completions/2026-09-07-orcado-e-receita-recorrente.md`
- Modify: `docs/runbooks/livro-razao-em-producao.md` (a nota do D-b)

- [ ] **Step 1: Todas as suítes que a branch encosta**

```bash
cd apps/backoffice && npx vitest run
cd ../app && NODE_ENV=test npx vitest run
cd ../../packages/database && npx vitest run
cd ../provisioning && npx vitest run
```

A suíte do `apps/app` é obrigatória: é lá que vive o guard de chave única por tenant, e `CreditoDoMes` tem `@@unique([tenantId, clienteSlug, competencia])` — com `tenantId` dentro, então passa; `OrcamentoDaConta` idem. Confirmar, não supor. Relatar os números reais.

- [ ] **Step 2: Tipos nos quatro pacotes**

`npx tsc --noEmit --emitDeclarationOnly false` em `apps/backoffice`, `apps/app`, `packages/database`, `packages/provisioning`.

- [ ] **Step 3: Migration no local**

```bash
cd packages/database
set -a; . ../../apps/app/.env.local; set +a
npx prisma migrate status
```
Expected: `Database schema is up to date!`, com 112 migrations.

- [ ] **Step 4: Registro**

`.claude/completions/2026-09-07-orcado-e-receita-recorrente.md` no formato de `2026-09-06-livro-razao-e-titulos.md`: o que entrou por task com os commits, as decisões desta seção e as do ledger, os números da verificação, o que falta em produção e o ponytail. No runbook do livro-razão, uma nota curta dizendo que o D-b acrescenta quatro tabelas sem cópia de dado, então a verificação dele é só conferir a linha `Applying migration` e abrir as duas abas.

- [ ] **Step 5: Commit**

```bash
git add .claude/completions/2026-09-07-orcado-e-receita-recorrente.md docs/runbooks/livro-razao-em-producao.md
git commit -m "docs: registro do plano D-b — orçado × realizado e receita recorrente"
```

---

## Produção

1. Push. A Vercel aplica `20260911000000_orcamento_e_recorrente`, que só cria tabelas.
2. Conferir `Applying migration` no log de build.
3. Semear nada: orçamento e assinatura são dado que a Nebuloz digita. A primeira assinatura cadastrada já produz MRR no mês do `iniciouEm`, porque a linha `NOVO` do histórico nasce junto.
