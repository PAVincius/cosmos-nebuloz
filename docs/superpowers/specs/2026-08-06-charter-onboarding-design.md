# Charter — Montagem guiada pelo próprio dado

## 1. Por que este trabalho existe

Um compliance lead entra pela primeira vez no Charter e não sabe por onde começar.

Isso não é impressão. O provisionamento (`packages/provisioning/src/charter.ts:88-150`) cria, no instante em que o tenant nasce: uma pessoa com papel `COMPLIANCE`, um `CharterSettings` com defaults, uma política chamada "Política de Uso de IA", e **nove seções em `DRAFT` com `body: ""`**.

A ordem de montagem, portanto, já existe — está escrita no banco. São nove seções vazias esperando redação, numa sequência que não é arbitrária: ninguém escreve "usos permitidos" antes de "classificação de dados".

> Perfil organizacional e contexto · Classificação de dados · Usos permitidos · Usos restritos · Usos proibidos · IA voltada ao cliente · Requisitos de aprovação · Human-in-the-loop · Escalonamento e exceções

O produto nunca conta isso a ninguém.

### O que a tela de entrada diz hoje

Pior que o silêncio. Com o tenant zerado, o dashboard não fica vazio — ele **afirma**:

| Seção | Texto atual | O que é verdade |
|---|---|---|
| Fila de revisão | "Nada aguardando decisão — toda submissão foi revisada dentro do SLA" | Nenhuma submissão existiu |
| Alertas | "Nenhum SLA vencido, nenhuma mitigação atrasada e nenhuma seção de política fora de publicação" | Nada foi monitorado |
| Saúde da política | "Nenhuma política foi criada nesta organização ainda" | Correto |

Duas de três dizem a quem nunca usou o produto que ele está em dia. Um produto de governança cuja primeira tela afirma conformidade que ninguém construiu tem um problema maior que usabilidade.

---

## 2. Escopo

**Dentro.** Um painel de montagem no topo do dashboard, lido do estado real do tenant, com cinco passos em ordem de dependência; e a correção dos estados vazios que hoje afirmam.

**Fora, deliberadamente:**

- **Motor genérico de tour** (coach marks, overlays, "próximo"). Ensina onde ficam os botões; o problema aqui é não saber *o que escrever*. Some depois de dispensado uma vez, e o compliance lead vai precisar de muitas sessões.
- **Tabela nova de progresso.** O progresso já está no dado. Uma tabela paralela é uma segunda fonte de verdade que diverge no primeiro `deleteMany`.
- **Ajuda de vocabulário** (ROAM, tier, cobertura, capacidade). Problema real, mas é ajuda inline por campo — outro trabalho.
- **Passos além do quinto.** Fornecedores, trilhas de aceite e mapa de conformidade são trabalho contínuo, não montagem. Painel com oito itens no primeiro acesso reconstrói o problema que ele veio resolver.

---

## 3. Os cinco passos

| # | Passo | Conclui quando | Bloqueado por | Quem pode agir |
|---|---|---|---|---|
| 1 | Escrever as nove seções | toda seção com `body.trim() !== ""` | — | permissão `policy.edit` |
| 2 | Publicar a primeira versão | existe `CharterPolicyVersion` | 1 | permissão `policy.publish` |
| 3 | Atribuir papéis a outras pessoas | > 1 `CharterMembership` | — | **papel `COMPLIANCE`** (ver abaixo) |
| 4 | Registrar o primeiro caso de uso | existe `CharterUseCase` | 2 | permissão `case.submit` |
| 5 | Decidir o primeiro caso | existe `CharterDecision` | 4 | permissão `case.decide` |

**O passo 3 é a exceção da coluna, e não por acaso.** `setMemberCharterRole` (`actions/settings.ts:301-311`) não consulta a matriz de permissões: compara `ctx.charterRole !== "COMPLIANCE"` diretamente, com o comentário "é a permissão que distribui todas as outras". Faz sentido — uma permissão que concede permissões não pode ser concedida pela mesma matriz sem circularidade. O painel precisa replicar esse teste em vez de procurar uma permissão inexistente.

**Por que para no cinco.** O passo 5 é onde o Charter deixa de ser documento e vira registro — a primeira coisa que ele consegue *provar*. Antes disso não há evidência, só texto.

**Por que o passo 3 não bloqueia nada.** Tecnicamente dá para operar sozinho. Mas um Charter com uma pessoa só tem quem submete e quem decide sendo a mesma pessoa, o que um auditor rejeita na primeira pergunta. Fica visível e sem bloquear: a montagem não pode travar esperando alguém aceitar convite.

**Por que só o passo 1 mostra progresso parcial.** É o único longo o bastante para alguém abandonar no meio. `3 de 9` é a diferença entre "falta muito" e "falta pouco"; os outros quatro são binários e um contador ali seria enfeite.

---

## 4. Arquitetura

### 4.1 A action

`apps/app/app/(charter)/actions/setup.ts`, exportando `getSetupProgress()`.

Guarda: `requireCharterContext()`, sem permissão específica — quem enxerga o dashboard enxerga o painel. A coluna "quem pode agir" da tabela acima decide se o passo é **acionável**, não se é **visível**.

`requireCharterContext` devolve `charterRole`, então a action tem o que precisa para os dois tipos de teste: `hasCharterPermission(ctx.charterRole, "policy.publish")` para quatro dos passos, e a comparação direta com `"COMPLIANCE"` para o passo 3.

```ts
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
  /** Só no passo 1. */
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
```

### 4.2 Custo

Uma única `withTenantDb`, **só contagens**. Isso roda em todo load do dashboard: `count` e `groupBy`, nunca `findMany`.

Uma transação só. Aninhar `withTenantDb` custa duas conexões do pool por request e é deadlock em pool pequeno — o defeito que `getComplianceMap` teve de ser reestruturado para remover.

### 4.3 Visibilidade e permissão

`podeAgir` e `quemPode` não são enfeite: `policy.publish` pertence só a COMPLIANCE, então **seis dos sete papéis não conseguem executar o passo 2**.

Painel que oferece botão clicável a um LEGAL reconstrói o defeito que a review final apontou em `CoverageEditor` — controle que aceita entrada e recusa depois do round-trip. Esconder o passo é pior: a pessoa conclui que o produto está quebrado, em vez de que a permissão é de outro papel.

Mostra, desabilita, e nomeia quem pode. Mesmo padrão de `policy.tsx` e `case-detail.tsx`, que já devolvem um campo `can` e gateiam o controle com a razão visível.

### 4.4 O componente

`apps/app/components/charter/setup-panel.tsx`. Sem estado próprio e sem `useEffect` de carregamento — o dashboard é dono do fetch e passa os dados por prop. Um componente de painel que busca os próprios dados duplica a request numa tela que já faz uma.

Recolhe quando `completo`. Não some: um resumo de uma linha permanece, porque a mesma leitura serve de "o que está incompleto" para sempre, e é ali que o mapa de conformidade aparece naturalmente quando houver exigência importada.

### 4.5 A correção dos estados vazios

Sai de graça. O dashboard já terá `SetupProgress` em mãos:

| Hoje | Com montagem incompleta |
|---|---|
| "Nada aguardando decisão — toda submissão foi revisada dentro do SLA" | "Nenhum caso foi submetido ainda" |
| "Nenhum SLA vencido, nenhuma mitigação atrasada" | "Ainda não há o que monitorar" |

Nenhum componente novo: `SmartEmptyState` já aceita `title` e `subtitle`, e a escolha do texto passa a ser condicional. A diferença entre "zero porque está tudo em dia" e "zero porque nada aconteceu" é dado que sempre existiu e nunca foi perguntado.

---

## 5. Fluxo

1. Compliance lead entra. Dashboard carrega `getDashboard` e `getSetupProgress`.
2. Painel no topo: `0 de 5`, passo 1 disponível com `0 de 9`, passo 2 bloqueado por 1, passo 3 disponível, passos 4 e 5 bloqueados.
3. Clica no passo 1 → `/charter/policy`. Escreve seções.
4. Volta ao dashboard. O `[[...seg]]` troca o componente do registry, o componente remonta, o `useEffect` de `useCharterData` roda e a leitura é nova. **Não depende de `revalidatePath`** — o dashboard é client-fetched, e revalidação de RSC não alcança um `useEffect`.

---

## 6. Erro

O modo de falha que importa é o painel não saber e o produto tranquilizar mesmo assim.

| Situação | Resposta |
|---|---|
| `getSetupProgress` falha | Dashboard renderiza sem o painel — ele é aditivo e não pode derrubar a tela |
| `getSetupProgress` falha **e** a fila está vazia | Texto **neutro** ("Nada aqui"), nunca "toda submissão foi revisada" |
| Passo `feito` que estaria `bloqueado` | Vence `feito` — passo bloqueado que já aconteceu é o painel discutindo com o banco |
| Seção só com espaço em branco | Não conta como escrita (`body.trim()`), senão um Enter acidental fecha o passo 1 |
| Papel sem permissão para o passo | Visível, desabilitado, com o nome de quem pode |

A segunda linha é a regra que sustenta as outras: **na dúvida, não afirmar**. "Toda submissão foi revisada" só aparece quando existe submissão revisada para sustentar a frase.

---

## 7. Teste

Todos sem tocar banco, com o padrão `vi.hoisted` + `vi.mock` que o resto do Charter usa.

- cada passo conclui pelo dado certo, e **só** por ele
- `3 de 9` com três seções escritas, uma delas só de espaços — a de espaço não conta
- passo 2 bloqueado com seções incompletas; disponível depois
- passo feito que estaria bloqueado aparece feito
- LEGAL vê o passo 2 com `podeAgir: false` e `quemPode` preenchido; COMPLIANCE vê `true`
- **falha de `getSetupProgress` não deixa o dashboard afirmar** que tudo foi revisado — é o teste que sustenta a decisão de §6
- painel recolhe quando os cinco fecham

O teste de render precisa de `/** @vitest-environment jsdom */` na primeira linha, e da suíte rodada com `NODE_ENV=test`. Asserções sobre conteúdo, nunca snapshot.

**Verificação:** `cd apps/app && NODE_ENV=test pnpm run test`, contra o resultado mergeado com a `main` — não contra a branch isolada.

---

## 8. Dependência de outro trabalho

Este trabalho toca `apps/app/components/charter/screens/dashboard.tsx` e adiciona um arquivo em `apps/app/app/(charter)/actions/`.

A branch `feat/charter-conformidade` está aberta e não empurrada, com 26 commits, e toca o mesmo diretório de actions sem tocar o dashboard. Não há conflito textual previsto, mas as duas precisam ser rebaseadas na mesma `main` e verificadas **contra o resultado do merge** — foi exatamente assim que um import quebrado passou despercebido nesta base.

---

## 9. Lacunas conhecidas

Registradas para não serem redescobertas como surpresa:

- **Vocabulário continua sem ajuda.** ROAM, tier, cobertura e capacidade seguem sem explicação no ponto de uso. É a segunda causa de dificuldade e não está neste escopo.
- **O painel não ensina a escrever política.** Ele diz *que* as nove seções precisam de texto e *por que* importam; o conteúdo é do cliente. Um gerador de rascunho existe (`saveGeneratedDraft`), e conectá-lo ao passo 1 é trabalho seguinte, não este.
- **Cinco passos é uma aposta.** Se um cliente real travar no passo 3 por outro motivo — convite, SSO, papel — o painel mostra o passo e não resolve a causa. Só uso real diz se a fronteira está no lugar certo.
