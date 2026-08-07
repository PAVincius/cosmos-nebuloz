# Charter — Montagem guiada pelo próprio dado

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dizer a um compliance lead que acabou de entrar no Charter o que fazer primeiro, lendo o estado real do tenant — e parar a tela de entrada de afirmar conformidade que ninguém construiu.

**Architecture:** Uma action lê o estado do tenant e devolve cinco passos em ordem de dependência. Nenhuma tabela nova: o progresso já está no dado, porque o provisionamento cria nove seções de política vazias no instante em que o tenant nasce. O painel mora no topo do dashboard e se recolhe quando tudo fecha.

**Tech Stack:** Next.js 16 App Router · TypeScript · Prisma + PostgreSQL · Vitest + Testing Library · Biome.

## Global Constraints

- **Idioma:** comentários e strings de UI em **pt-BR**; assunto de commit em **pt-BR**, corpo em **prosa inglesa**. Comentário explica *por quê*, nunca *o quê*.
- **Verificação:** rode `vitest` **direto dentro de `apps/app`**, com `NODE_ENV=test`. Sem `NODE_ENV=test` o plugin React escolhe o runtime JSX errado e teste de componente morre com "React is not defined".
- **Não verifique com `pnpm run test` da raiz.** Turbo cacheia e replaya log de execução anterior, indistinguível de execução real na saída.
- **Saída grande de Bash não é confiável nesta base.** O hook `rtk`/`omni` no `PreToolUse` comprime com perda — um `git diff` inline devolveu 103 linhas onde o real tinha 546. Redirecione para arquivo e leia o arquivo.
- Actions do Charter: guard primeiro, `withTenantDb` depois, `Result<T>` via `safeAction`, `GovernanceError` para violação de regra.
- **Uma `withTenantDb` por action.** Aninhar custa duas conexões do pool por request.
- Antes de commitar, da raiz: `npx @biomejs/biome check --write` nos arquivos tocados. Depois `cd apps/app && npx tsc --noEmit -p .`.

---

## O que o provisionamento já cria

`packages/provisioning/src/charter.ts` cria, quando um tenant nasce: uma pessoa com papel `COMPLIANCE`, um `CharterSettings`, uma política "Política de Uso de IA", e **nove `CharterPolicySection` em `DRAFT` com `body: ""`**:

> Perfil organizacional e contexto · Classificação de dados · Usos permitidos · Usos restritos · Usos proibidos · IA voltada ao cliente · Requisitos de aprovação · Human-in-the-loop · Escalonamento e exceções

A ordem de montagem já existe, escrita no banco. O produto nunca a mostra.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `apps/app/app/(charter)/actions/setup.ts` | **Novo.** `getSetupProgress()` — lê estado, devolve cinco passos |
| `apps/app/components/charter/setup-panel.tsx` | **Novo.** Desenha. Sem estado próprio, sem fetch |
| `apps/app/components/charter/screens/dashboard.tsx` | Monta o painel; troca o texto dos estados vazios |
| `apps/app/__tests__/charter/setup.test.ts` | **Novo.** Os passos |
| `apps/app/__tests__/charter/setup-panel.test.tsx` | **Novo.** O desenho e a honestidade do vazio |

---

### Task 1: A action que lê o estado

**Files:**
- Create: `apps/app/app/(charter)/actions/setup.ts`
- Test: `apps/app/__tests__/charter/setup.test.ts`

**Interfaces:**
- Consumes: `requireCharterContext()` de `@/lib/charter/guards` (devolve `CharterContext = TenantContext & { charterRole }`); `hasCharterPermission(role, permission)` de `@repo/rbac`; `withTenantDb` de `@repo/database`; `safeAction`/`Result` de `./_shared`.
- Produces: `getSetupProgress(): Promise<Result<SetupProgress>>` e os tipos `SetupStepId`, `SetupStep`, `SetupProgress`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/app/__tests__/charter/setup.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireCtx: vi.fn(),
  sectionFindMany: vi.fn(),
  versionCount: vi.fn(),
  membershipCount: vi.fn(),
  useCaseCount: vi.fn(),
  decisionCount: vi.fn(),
}));

vi.mock("@/lib/charter/guards", () => ({
  requireCharterContext: h.requireCtx,
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      charterPolicySection: { findMany: h.sectionFindMany },
      charterPolicyVersion: { count: h.versionCount },
      charterMembership: { count: h.membershipCount },
      charterUseCase: { count: h.useCaseCount },
      charterDecision: { count: h.decisionCount },
    }),
}));

import { getSetupProgress } from "../../app/(charter)/actions/setup";

/** Tenant recém-provisionado: 9 seções vazias, 1 pessoa, nada mais. */
function tenantNovo() {
  h.sectionFindMany.mockResolvedValue(
    Array.from({ length: 9 }, () => ({ body: "" }))
  );
  h.versionCount.mockResolvedValue(0);
  h.membershipCount.mockResolvedValue(1);
  h.useCaseCount.mockResolvedValue(0);
  h.decisionCount.mockResolvedValue(0);
}

function passo(res: Awaited<ReturnType<typeof getSetupProgress>>, id: string) {
  if (!res.ok) {
    throw new Error("esperava ok");
  }
  const p = res.data.passos.find((s) => s.id === id);
  if (!p) {
    throw new Error(`passo ${id} ausente`);
  }
  return p;
}

const compliance = {
  tenantId: "t-1",
  userId: "u-1",
  charterRole: "COMPLIANCE",
  user: { name: "Bia", email: "bia@x.com" },
};

describe("getSetupProgress", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireCtx.mockResolvedValue(compliance);
    tenantNovo();
  });

  it("num tenant novo: nada concluído, e o passo 1 disponível", async () => {
    const res = await getSetupProgress();

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.concluidos).toBe(0);
    expect(res.data.total).toBe(5);
    expect(res.data.completo).toBe(false);
    expect(passo(res, "policy.write").estado).toBe("disponivel");
  });

  it("mostra 3 de 9, e seção só com espaço não conta como escrita", async () => {
    // Um Enter acidental não pode fechar o passo mais longo da montagem.
    h.sectionFindMany.mockResolvedValue([
      { body: "texto" },
      { body: "texto" },
      { body: "texto" },
      { body: "   " },
      { body: "" },
      { body: "" },
      { body: "" },
      { body: "" },
      { body: "" },
    ]);

    const res = await getSetupProgress();

    expect(passo(res, "policy.write").progresso).toEqual({ feito: 3, total: 9 });
  });

  it("publicar fica bloqueado enquanto houver seção vazia", async () => {
    const res = await getSetupProgress();
    const p = passo(res, "policy.publish");

    expect(p.estado).toBe("bloqueado");
    expect(p.bloqueadoPor).toBeTruthy();
  });

  it("publicar libera quando as nove estão escritas", async () => {
    h.sectionFindMany.mockResolvedValue(
      Array.from({ length: 9 }, () => ({ body: "texto" }))
    );

    const res = await getSetupProgress();

    expect(passo(res, "policy.publish").estado).toBe("disponivel");
  });

  it("passo feito ganha de passo bloqueado", async () => {
    // Dado semeado torto, ou provisionamento antigo: existe decisão sem
    // política publicada. Passo bloqueado que já aconteceu é o painel
    // discutindo com o banco.
    h.decisionCount.mockResolvedValue(1);

    const res = await getSetupProgress();

    expect(passo(res, "decision.first").estado).toBe("feito");
  });

  it("atribuir papéis não bloqueia nada, e fecha com mais de uma pessoa", async () => {
    // Montagem não pode travar esperando alguém aceitar convite.
    expect(passo(await getSetupProgress(), "roles.assign").estado).toBe(
      "disponivel"
    );

    h.membershipCount.mockResolvedValue(2);
    expect(passo(await getSetupProgress(), "roles.assign").estado).toBe("feito");
  });

  it("LEGAL vê publicar sem poder agir, e o painel diz quem pode", async () => {
    // policy.publish é só de COMPLIANCE. Seis dos sete papéis não conseguem.
    // Esconder o passo faz a pessoa achar que o produto está quebrado.
    h.requireCtx.mockResolvedValue({ ...compliance, charterRole: "LEGAL" });

    const p = passo(await getSetupProgress(), "policy.publish");

    expect(p.podeAgir).toBe(false);
    expect(p.quemPode).toBeTruthy();
  });

  it("COMPLIANCE pode agir no passo 3; LEGAL não", async () => {
    // setMemberCharterRole não usa a matriz de permissões: compara o papel
    // com "COMPLIANCE" direto, porque permissão que concede permissões não
    // pode ser concedida pela mesma matriz sem circularidade.
    expect(passo(await getSetupProgress(), "roles.assign").podeAgir).toBe(true);

    h.requireCtx.mockResolvedValue({ ...compliance, charterRole: "LEGAL" });
    expect(passo(await getSetupProgress(), "roles.assign").podeAgir).toBe(false);
  });

  it("com tudo feito, completo é true", async () => {
    h.sectionFindMany.mockResolvedValue(
      Array.from({ length: 9 }, () => ({ body: "texto" }))
    );
    h.versionCount.mockResolvedValue(1);
    h.membershipCount.mockResolvedValue(3);
    h.useCaseCount.mockResolvedValue(2);
    h.decisionCount.mockResolvedValue(1);

    const res = await getSetupProgress();

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.concluidos).toBe(5);
    expect(res.data.completo).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/setup.test.ts`
Expected: FAIL — módulo `actions/setup` não existe.

- [ ] **Step 3: Implementar**

Criar `apps/app/app/(charter)/actions/setup.ts`. Estrutura obrigatória:

```ts
"use server";

import { withTenantDb } from "@repo/database";
import { hasCharterPermission } from "@repo/rbac";
import { requireCharterContext } from "@/lib/charter/guards";
import { type Result, safeAction } from "./_shared";

export type SetupStepId =
  | "policy.write"
  | "policy.publish"
  | "roles.assign"
  | "usecase.first"
  | "decision.first";

export type SetupStep = {
  id: SetupStepId;
  titulo: string;
  /** Por que o passo importa. Nunca onde clicar — isso o href resolve. */
  porque: string;
  estado: "feito" | "disponivel" | "bloqueado";
  /** Só no passo 1: é o único longo o bastante para alguém desistir no meio. */
  progresso?: { feito: number; total: number };
  href: string;
  /** Legível, não código: "Escreva as nove seções primeiro." */
  bloqueadoPor?: string;
  /** O papel de quem está olhando permite executar este passo? */
  podeAgir: boolean;
  /** Quando não permite: "Compliance Lead". */
  quemPode?: string;
};

export type SetupProgress = {
  passos: SetupStep[];
  concluidos: number;
  total: number;
  /** Todos os cinco fechados — o painel se recolhe. */
  completo: boolean;
};

const TOTAL_SECOES = 9;
```

Regras que a implementação deve cumprir, cada uma coberta por um teste do Step 1:

1. Guard: `requireCharterContext()`, **sem permissão específica** — quem enxerga o dashboard enxerga o painel. A coluna "quem pode agir" decide se o passo é acionável, não se é visível.
2. Uma única `withTenantDb`, **só contagem** — quatro `count` mais **um** `findMany` em `charterPolicySection` selecionando apenas `body`. O `findMany` é necessário porque a regra é `body.trim() !== ""` e `count` com `{ not: "" }` deixaria passar seção só de espaço; são nove linhas, custo desprezível. Isso roda em todo load do dashboard: nada de `findMany` fora desse.
3. Passo 1 conclui com todas as nove `body.trim() !== ""`; `progresso` traz `{ feito, total: 9 }`.
4. Passo 2 conclui com `charterPolicyVersion.count > 0`; bloqueado por 1 enquanto houver seção vazia, com `bloqueadoPor` em pt-BR legível.
5. Passo 3 conclui com `charterMembership.count > 1`; **nunca bloqueia**.
6. Passo 4 conclui com `charterUseCase.count > 0`; bloqueado por 2.
7. Passo 5 conclui com `charterDecision.count > 0`; bloqueado por 4.
8. **`feito` vence `bloqueado`.** Calcule o estado nessa ordem: se o dado diz que aconteceu, é `feito`, mesmo que o pré-requisito não esteja fechado.
9. `podeAgir`: `hasCharterPermission(ctx.charterRole, "policy.edit" | "policy.publish" | "case.submit" | "case.decide")` para os passos 1, 2, 4 e 5; para o passo 3, **`ctx.charterRole === "COMPLIANCE"`** — `setMemberCharterRole` não consulta a matriz, compara o papel direto. `quemPode` preenchido só quando `podeAgir` é falso.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/setup.test.ts`
Expected: PASS, 9 testes.

- [ ] **Step 5: Commit**

```bash
git add "apps/app/app/(charter)/actions/setup.ts" apps/app/__tests__/charter/setup.test.ts
git commit -m "feat(charter): ler o estado da montagem do próprio dado

A compliance lead opening the Charter for the first time does not know where to
start, and the assembly order already exists: provisioning writes nine empty
policy sections into the database the moment a tenant is created, in an order
that is not arbitrary. Nobody writes 'permitted uses' before 'data
classification'. The product simply never said so.

Progress is read rather than stored. A table tracking it would be a second
source of truth that drifts from the first; reading the data means the panel
cannot claim a step is done when it is not.

Assigning roles never blocks. Operating alone is technically possible, but a
Charter with one person has the same person submitting and deciding, which an
auditor rejects on the first question — so it is visible without holding the
assembly hostage to someone accepting an invitation."
```

---

### Task 2: O painel no topo do dashboard

**Files:**
- Create: `apps/app/components/charter/setup-panel.tsx`
- Modify: `apps/app/components/charter/screens/dashboard.tsx:68-72` (carregamento) e o `return` (montagem)
- Test: `apps/app/__tests__/charter/setup-panel.test.tsx`

**Interfaces:**
- Consumes: `getSetupProgress`, `SetupProgress`, `SetupStep` da Task 1.
- Produces: `SetupPanel({ progresso }: { progresso: SetupProgress })`.

**O painel não busca os próprios dados.** O dashboard já faz uma request; um componente que faz a sua duplica a chamada numa tela que carrega uma vez. O dashboard passa por prop.

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/app/__tests__/charter/setup-panel.test.tsx`, com `/** @vitest-environment jsdom */` na **primeira linha**, cobrindo:

1. Tenant novo (`0 de 5`, passo 1 `disponivel` com `progresso: { feito: 0, total: 9 }`): o painel mostra os cinco títulos, o `porque` do passo 1, e "0 de 9".
2. Passo bloqueado mostra o texto de `bloqueadoPor` — asserção no conteúdo, não em classe CSS.
3. Passo com `podeAgir: false` mostra `quemPode` e **não** oferece controle habilitado. Asserção: o elemento existe e está desabilitado, ou o link não é clicável — verifique como `GatedButton` em `base.tsx` faz isso e siga.
4. `completo: true` recolhe o painel para um resumo de uma linha, e os cinco títulos deixam de aparecer.
5. `progresso` ausente nos passos 2 a 5: não renderiza "0 de 0" nem "NaN".
6. **O dashboard renderiza quando `getSetupProgress` falha.** Monte a tela com a action de montagem devolvendo erro e a de dashboard devolvendo dado, e assere que o conteúdo do dashboard aparece e o painel não. O painel é aditivo: uma leitura de estado que falhou não pode derrubar a tela de entrada. Sem este teste, "aditivo" é intenção, não propriedade.

Cada asserção sobre conteúdo. **Sem snapshot** — um ajuste de Tailwind quebraria o arquivo inteiro e a correção viraria "atualizar tudo", que é quando o teste deixa de proteger.

**Antes de escrever qualquer um deles, leia `apps/app/__tests__/screens/dashboard.test.tsx`** e siga a forma de mock que já existe lá. Ela é a referência de como esta base monta o dashboard em teste; inventar uma segunda forma cria dois jeitos de fazer a mesma coisa no mesmo diretório.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/setup-panel.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Implementar o painel**

Criar `setup-panel.tsx` seguindo o kit do Charter (`SectionCard`, `Badge`, `GatedButton` de `../base`; `Icon` de `@repo/design-system/cosmos/icons`). Sem `useState` de carregamento, sem `useEffect`.

- [ ] **Step 4: Montar no dashboard**

Em `dashboard.tsx`, carregar as duas actions. O hook atual é:

```tsx
const { data, loading, error, reload } = useCharterData(
  useCallback(() => getDashboard(), [])
);
```

Adicionar um segundo `useCharterData` para `getSetupProgress`. **Não** aninhe as chamadas nem transforme em `Promise.all` dentro de um `useCallback` só: se a montagem falhar, o dashboard tem de renderizar mesmo assim — o painel é aditivo e não pode derrubar a tela.

Renderizar `<SetupPanel>` logo abaixo do `PageHeader`, e só quando houver dado.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/setup-panel.test.tsx __tests__/screens/dashboard.test.tsx`
Expected: PASS. O teste de dashboard existente continua verde — se quebrar, é porque o painel virou obrigatório para renderizar, e não é.

- [ ] **Step 6: Commit**

```bash
git add apps/app/components/charter/setup-panel.tsx \
        apps/app/components/charter/screens/dashboard.tsx \
        apps/app/__tests__/charter/setup-panel.test.tsx
git commit -m "feat(charter): painel de montagem no topo do dashboard

The panel shows steps a role cannot perform, disabled, naming who can. Six of
the seven Charter roles cannot publish a policy version. Offering a live button
to a LEGAL user rebuilds a defect this codebase has already fixed once — a
control that accepts input and refuses it after a round trip — and hiding the
step is worse, because the person concludes the product is broken rather than
that the permission belongs to someone else.

It loads separately from the dashboard rather than alongside it. The panel is
additive: if reading the assembly state fails, the screen still has to render."
```

---

### Task 3: A tela de entrada para de afirmar

**Files:**
- Modify: `apps/app/components/charter/screens/dashboard.tsx:222-223`, `:505-506`
- Test: `apps/app/__tests__/charter/setup-panel.test.tsx` (adiciona ao arquivo da Task 2)

**Interfaces:**
- Consumes: `SetupProgress` já carregado no dashboard pela Task 2.

**O modo de falha que importa.** Com o tenant zerado, o dashboard hoje não fica vazio — ele afirma:

| Linha | Texto atual | Verdade num tenant novo |
|---|---|---|
| 222-223 | "Nada aguardando decisão — Toda submissão foi revisada dentro do SLA." | nenhuma submissão existiu |
| 505-506 | "Nada exige ação agora — Nenhum SLA vencido, nenhuma mitigação atrasada…" | nada foi monitorado |
| 438 | "Nenhuma política foi criada nesta organização ainda." | **honesto, não mexa** |

Duas de três dizem a quem nunca usou o produto que ele está em dia.

- [ ] **Step 1: Escrever os testes que falham**

Três testes, no mesmo arquivo e com a mesma forma de mock que você já usou na Task 2. Cada um monta o dashboard variando **só** o que `getSetupProgress` devolve; o mock de `getDashboard` fica igual nos três, com a fila e os alertas vazios.

| Teste | `getSetupProgress` devolve | Asserções |
|---|---|---|
| montagem incompleta não afirma | `ok: true` com `concluidos: 0, completo: false` | `queryByText(/revisada dentro do SLA/i)` é `null`; `findByText(/nenhum caso foi submetido/i)` existe |
| montagem completa volta a tranquilizar | `ok: true` com `concluidos: 5, completo: true` | `findByText(/revisada dentro do SLA/i)` existe |
| falha não deixa afirmar | `ok: false` com uma mensagem de erro | `queryByText(/revisada dentro do SLA/i)` é `null` |

O terceiro é o que sustenta os outros dois: sem saber se a montagem está incompleta, o produto não pode escolher a frase que afirma. Ele deve falhar hoje pelo motivo certo — o texto tranquilizador é fixo — e continuar falhando se alguém trocar o fallback pelo otimista.

Comentário obrigatório no primeiro teste, porque a razão não é óbvia lendo a asserção: *o produto afirmando conformidade que ninguém construiu é o defeito que este trabalho existe para tirar da primeira tela que o cliente vê.*

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/setup-panel.test.tsx`
Expected: FAIL — o texto ainda é o tranquilizador em todos os casos.

- [ ] **Step 3: Implementar**

Nas duas `SmartEmptyState` (linhas ~222 e ~505), escolher `title` e `subtitle` conforme o estado da montagem. `SmartEmptyState` já aceita `title` e `subtitle` — nenhum componente novo.

| Situação | Texto |
|---|---|
| Montagem incompleta | "Nenhum caso foi submetido ainda" / "Ainda não há o que monitorar" |
| Montagem completa | o texto atual, que passa a ser verdade |
| `getSetupProgress` **falhou** | **neutro**: "Nada aqui." — nunca o tranquilizador |

A terceira linha é a regra: sem saber se a montagem está incompleta, o fallback não pode ser a versão que afirma. Errar para o lado de não afirmar.

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/setup-panel.test.tsx __tests__/screens/dashboard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Suíte inteira e typecheck**

```bash
cd apps/app && NODE_ENV=test npx vitest run
cd apps/app && npx tsc --noEmit -p .
```
Expected: verde e limpo.

- [ ] **Step 6: Commit**

```bash
git add apps/app/components/charter/screens/dashboard.tsx \
        apps/app/__tests__/charter/setup-panel.test.tsx
git commit -m "fix(charter): a tela de entrada para de afirmar o que não aconteceu

On an empty tenant the dashboard did not render blank, it asserted: 'every
submission was reviewed within SLA' and 'no SLA breached, no mitigation late'
were shown to someone who had never used the product. Only the policy card was
honest. A governance product whose first screen claims a conformity nobody built
has a problem larger than usability.

The difference between zero-because-handled and zero-because-nothing-happened is
data that always existed and was never asked for. When the assembly state cannot
be read at all, the copy falls back to neutral rather than reassuring — erring
toward not asserting is the rule the other two cases rest on."
```

---

## Verificação final

```bash
cd apps/app && NODE_ENV=test npx vitest run
cd apps/app && npx tsc --noEmit -p .
cd ../.. && npx @biomejs/biome check apps/app
```

Depois de mergear com a `main`, **rode a suíte de novo contra o resultado do merge**. Conflito semântico não aparece de outro jeito, e já derrubou o deploy desta base uma vez.

## O que este plano não faz

- **Não ensina vocabulário.** ROAM, tier, cobertura e capacidade seguem sem explicação no ponto de uso. É a segunda causa de dificuldade e é ajuda inline por campo — outro trabalho.
- **Não escreve política por ninguém.** O painel diz *que* as nove seções precisam de texto e *por que* importam; o conteúdo é do cliente. Conectar o gerador de rascunho (`saveGeneratedDraft`) ao passo 1 é trabalho seguinte.
- **Cinco passos é uma aposta.** Se um cliente travar no passo 3 por convite, SSO ou papel, o painel mostra o passo e não resolve a causa. Só uso real diz se a fronteira está no lugar.
- **Não cobre fornecedores, trilhas de aceite nem o mapa de conformidade.** São trabalho contínuo, não montagem. O painel continua vivo depois do quinto passo mostrando o que está incompleto, e é ali que o mapa aparece quando houver exigência importada.
