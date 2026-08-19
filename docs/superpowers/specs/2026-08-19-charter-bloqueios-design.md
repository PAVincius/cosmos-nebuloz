# Charter — os dois bloqueios do mapa de conformidade

## 1. Por que este trabalho existe

O PR #56 entregou o mapa de conformidade sobre evidência viva. Duas peças dele
entraram no `main` **construídas, testadas, revisadas e inertes**: código correto
que nenhuma tela chama.

| peça | onde | callers |
|---|---|---|
| `publishSetVersion` | `apps/app/app/(charter)/actions/compliance.ts:159` | zero — só testes |
| `linkPolicy` / `unlinkPolicy` | `apps/app/app/(charter)/actions/policy.ts:530` e `:583` | zero — só testes |

Isto não é dívida cosmética. A segunda produz um mapa que **mente para o
comprador**: a capacidade `POLICY_LINK` conta linhas de `CharterPolicyLink`,
nada escreve nessa tabela, e o mapa exibe selo verde "Atende" apoiado em zero
evidência. O documento existe para ser lido por quem compra — é o pior lugar
possível para uma afirmação sem lastro.

## 2. O enunciado dos bloqueios, corrigido

A formulação com que este trabalho começou estava imprecisa nos dois casos.
Registrado aqui, e não corrigido em silêncio, porque a imprecisão mudava a
solução.

### 2.1 Não é "o seed esqueceu de chamar `publishSetVersion`"

`upsertCorpus` (`packages/database/scripts/seed-regulacao.mts`) busca por
`(nome, versao, tenantId: null)`. Existem dois caminhos, e **ambos** estão
quebrados, de formas diferentes:

| ação em `CORPORA` | efeito hoje |
|---|---|
| mudar texto **sem** subir `versao` | `update` in-place de `resumo`/`texto` sob veredito já dado, sem aviso |
| mudar texto **subindo** `versao` | cria conjunto **órfão**: sem `supersedesId`, sem transporte de cobertura, sem `REVISAR` |

E `listRequirementSets` (`compliance.ts:579`) não filtra nem devolve
`supersedesId`. No segundo caso o tenant passa a ver **v1 com os vereditos dele
e v2 vazio, lado a lado**, sem nada indicando que um substitui o outro.

`publishSetVersion` faz as três coisas certas — `supersedesId`, transporte de
cobertura, `REVISAR` no que mudou — mas cria o conjunto novo com
`tenantId: ctx.tenantId` (`compliance.ts:203`). Versionar uma regulação global
geraria **uma cópia por tenant**. Isso está documentado no próprio corpus
(`regulacao-corpora.ts:278`): foi decisão consciente, não esquecimento. A função
não serve a conjunto global como está.

### 2.2 "Vincular política a caso de uso" é quase tautologia

`packages/provisioning/src/charter.ts:132` cria **exatamente uma** política por
tenant ("Política de Uso de IA"), com guard que pula se já existe. Todos os
acessos são `findFirst({ where: { tenantId } })` — nunca `findMany`.

Com uma política só, "esta política se aplica ao caso de uso X" é verdade por
definição para todo caso do tenant. Vincular todos e exibir "17 vínculos" não
prova nada: é fazenda de checkbox.

**O que tem valor não é o vínculo existir — é ele estar completo.** Um caso de
uso sem vínculo é lacuna de governança real: sistema de IA rodando fora do
escopo declarado da política.

## 3. A fronteira que decide o desenho

`CharterCoverage` tem `ENABLE` **e** `FORCE ROW LEVEL SECURITY` com policy
`tenant_isolation`
(`packages/database/prisma/migrations/20260806000000_charter_conformidade/migration.sql:111-114`).
O seed conecta com um `PrismaClient` cru pelo `DATABASE_URL`, sem nenhum
`SET LOCAL app.tenant_id`.

**O seed não consegue transportar cobertura entre tenants.** A RLS barra.

Isso divide o bloqueio 1 em duas metades que não se tocam:

| ator | pode | não pode |
|---|---|---|
| seed (sem contexto de tenant) | criar conjunto global com `supersedesId` | tocar em `CharterCoverage` |
| app (`withTenantDb`) | transportar cobertura, marcar `REVISAR` | criar conjunto global (`tenantId: null`) |

Nenhum resolve sozinho — e a divisão coincide com a fronteira de produto certa:
**a Nebuloz publica a norma, o tenant decide quando adotá-la.**

O desenho segue essa fronteira em vez de lutar contra ela. Em particular, não
depende de descobrir se o papel do banco tem `rolbypassrls` — pergunta que
continua em aberto neste repositório e que um desenho com loop de
`SET LOCAL` por tenant no seed tornaria bloqueante.

## 4. Escopo

**Dentro.** As três metades do bloqueio 1 (seed recusa reescrita, seed cria com
`supersedesId`, app adota); UI para `publishSetVersion`; `POLICY_LINK` com
denominador; tela de alcance da política; teste para `unlinkPolicy`.

**Fora, deliberadamente:**

- **`setCoverage` recusar `ATENDE` com capacidade de evidência zero.** Ver §5.4.
- **Vínculo por seção da política** (`sectionId` em vez de `policyId`). É o
  desenho mais fiel ao que auditoria pede, e o que eu escolheria do zero — mas é
  migração sobre tabela já em produção, para um ganho que o denominador captura
  em boa parte.
- **Preencher os vínculos.** Quem declara que um caso está sob a política é uma
  pessoa. O seed não vincula nada.
- **Adoção automática de versão nova.** Ver §5.1.

## 5. Arquitetura

### 5.1 Seed: três caminhos em vez de dois

`upsertCorpus` passa a distinguir:

| situação | comportamento |
|---|---|
| `(nome, versao)` existe, conteúdo idêntico | no-op, sem escrita |
| `(nome, versao)` existe, conteúdo **diferente** | **erro**, nomeando o código divergente |
| `versao` nova, existe versão anterior do mesmo `nome` | cria com `supersedesId` apontando para a anterior |
| `nome` novo | cria como hoje |

A comparação é sobre `resumo` e `texto` — os campos que mudam a obrigação.
`citacao` e `categoria` ficam de fora: mudar o formato da referência ou
reclassificar a área não altera o que a exigência exige, e forçar versão nova
para isso transformaria a regra em burocracia que alguém contornaria.

A mensagem de erro precisa dizer o que fazer, não só que falhou:

```
SEC-03-01 mudou de texto na versão "1" de "Segurança em IA generativa —
checklist Nebuloz", que já está publicada. Exigência publicada não se
reescreve: suba `versao` em CORPORA e rode o seed de novo.
```

O caso do meio é o coração do bloqueio. Hoje ele reescreve exigência sob
veredito já dado e ninguém fica sabendo. Virar erro custa quase nada — o seed é
operado por quem edita o `CORPORA`.

**Por que adoção explícita, e não automática.** O mapa é artefato que vai para
comprador e para auditoria. Ele mudar sozinho entre duas visitas é exatamente o
que um time de compliance não tolera. Além disso, a RLS já obriga o transporte a
rodar sob contexto de tenant — adoção automática exigiria inventar um gatilho no
caminho de leitura, que é onde menos se quer escrita.

### 5.2 App: `adoptSetVersion`

Nova action em `compliance.ts`, exigindo `compliance.edit`:

```ts
adoptSetVersion({ setId }: { setId: string }): Promise<Result<{
  transportadas: number;
  emRevisao: number;
  novas: number;
}>>
```

`setId` é o conjunto **sucessor** que o tenant quer passar a usar. A action:

1. carrega o sucessor e confirma que ele é do tenant ou global — mesmo filtro
   `OR: [{ tenantId: ctx.tenantId }, { tenantId: null }]` de `getComplianceMap`;
2. carrega o antecessor por `supersedesId`; sem antecessor, erro `set.noPredecessor`;
3. transporta cobertura por `codigo`, do antecessor para o sucessor;
4. marca `REVISAR` onde `resumo` ou `texto` diferem;
5. deixa `SEM_VEREDITO` nas exigências que não existiam;
6. grava auditoria com o diff (`transportadas`, `emRevisao`, `novas`).

O transporte é o mesmo algoritmo que `publishSetVersion` já executa
(`compliance.ts:267-300`). **Sai para um helper compartilhado**
(`lib/charter/coverage-transfer.ts`), consumido pelas duas actions. Duplicá-lo
seria garantir que as duas cópias divergissem na primeira correção.

Quem não adotar continua no conjunto anterior indefinidamente, com os vereditos
intactos.

### 5.3 `listRequirementSets` passa a saber de sucessão

`SetRow` ganha dois campos:

```ts
type SetRow = {
  id: string; nome: string; origem: string; versao: string; total: number;
  supersedesId: string | null;   // conjunto que este substitui
  supersededById: string | null; // conjunto que substitui este
};
```

`supersededById` é derivado na leitura — o schema guarda só a aresta para trás.
Com ele a tela consegue dizer, no conjunto que o tenant usa hoje: *"a Nebuloz
publicou a versão 2 — 7 alteradas, 2 novas, 1 removida"*, com botão de adotar.

A contagem do diff vem de uma leitura das duas listas de exigência por `codigo`,
na própria action, para a tela não precisar de um segundo round-trip só para
saber se vale mostrar o aviso.

### 5.4 `Evidencia` ganha denominador

```ts
export type Evidencia = {
  total: number;
  amostra: string[];
  de?: number;        // denominador — quando `total` só faz sentido como fração
  lacunas?: string[]; // o que está de fora
  href?: string;
};
```

Os dois campos são opcionais: as outras seis capacidades não mudam uma linha.

**`amostra` continua significando "exemplos do que existe" em todas as
capacidades.** Fazer o `amostra` do `POLICY_LINK` listar o que falta seria o
mesmo campo com significado invertido em um único lugar do catálogo — rasteira
garantida para quem ler depois. `lacunas` é campo novo com nome que diz o que é.

`POLICY_LINK` passa a devolver:

```
total: 12   de: 14
amostra: ["USE_CASE · Triagem de currículos", "VENDOR · OpenAI", …]
lacunas: ["USE_CASE · Sumarizador de reunião", "USE_CASE · Chat interno"]
```

e o rótulo deixa de prometer o que não entrega:

> "Política vinculada a caso de uso e fornecedor"
> → **"Todo caso de uso e fornecedor sob a política publicada"**

Mesmo movimento já feito no `RISK_SCORING` (`capabilities.ts:141-150`), onde o
rótulo prometia "× probabilidade" que nenhuma tela capturava.

**Por que não travar `setCoverage`.** Recusar `ATENDE` quando a capacidade tem
`total: 0` obrigaria a action a rodar `evidencia()` — que abre as próprias
queries — a cada escrita, e transformaria julgamento de compliance em regra de
código. "Atende parcialmente enquanto migramos os dois últimos casos" é posição
legítima que a trava proibiria. O desenho aposta em tornar a lacuna **visível**
na mesma linha do selo, não em impedir a alegação. Se a prática mostrar que gente
marca verde com evidência zero, aí a trava se justifica — com o dado na mão.

### 5.5 Tela de alcance da política

Arquivo próprio, `components/charter/screens/policy-scope.tsx`, importado por
`policy.tsx` — que já tem 33 KB e não vai crescer. É o padrão que `settings.tsx`
usa com `settings-members-tab.tsx` e `settings-audit-tab.tsx`.

Uma `SectionCard` "Alcance da política" listando todo caso de uso e todo
fornecedor do tenant, com vincular/desvincular por linha e os **não vinculados
destacados no topo**.

Action de leitura nova, `getPolicyScope()`, com `requireCharterContext()` —
sem permissão específica, igual ao `getPolicy` (`policy.ts:71`). Ler quem está
sob a política tem a mesma sensibilidade que ler a política, e quem escreve
segue precisando de `policy.edit`. Um rascunho anterior deste spec dizia
`policy.map`: **essa permissão não existe** na união `CharterPermission`
(`packages/rbac/src/charter-matrix.ts`), e teria virado erro de compilação na
implementação. Devolve:

```ts
{
  policyId: string;
  casos:   { id: string; rotulo: string; vinculado: boolean }[];
  vendors: { id: string; rotulo: string; vinculado: boolean }[];
}
```

Uma consulta por lado, com os vínculos carregados em `Set` na action. Sem ela a
tela faria N+1 ou o cliente cruzaria duas listas.

**Por que em lote, na política, e não em `case-detail`.** Três razões:

O trabalho que o denominador cria é **fechar lacunas**, e fechar catorze
visitando catorze telas é tedioso o bastante para não ser feito — a feature
nasceria com a mesma doença que este spec conserta.

`linkPolicy` exige `policy.edit`, que só COMPLIANCE e LEGAL têm
(`packages/rbac/src/charter-matrix.ts`). SECURITY decide caso de uso mas não
edita política: um controle em `case-detail` apareceria desabilitado para uma das
personas que mais vive naquela tela.

E o `href` de `POLICY_LINK` já aponta para `/charter/policy`. Quem clicar na
evidência do mapa cai exatamente onde fecha a lacuna.

O custo, honesto: o vínculo deixa de ser gesto no fluxo natural do caso e vira
manutenção periódica de quem cuida da política. Para uma organização com dezenas
de casos isso é o certo; para uma com três, é uma tela a mais.

### 5.6 UI para `publishSetVersion`

O formulário de importação que já existe na tela de conformidade ganha um
seletor opcional: **"isto substitui um conjunto existente?"**. Preenchido, a tela
chama `publishSetVersion` com `supersedesId`; vazio, chama
`importRequirementSet` como hoje.

Mesmo gesto, um campo a mais. Cobre o caso real de uma RFP importada que o
cliente atualizou.

## 6. Erro

| situação | resposta |
|---|---|
| seed: texto mudou em versão publicada | erro nomeando o código divergente e mandando subir `versao` |
| seed: conteúdo idêntico | no-op silencioso |
| `adoptSetVersion` em conjunto sem `supersedesId` | `set.noPredecessor` — "Este conjunto não substitui nenhum outro." |
| `adoptSetVersion` em conjunto de outro tenant | `set.unknown` — indistinguível de inexistente, como no resto do módulo |
| `adoptSetVersion` rodado duas vezes | idempotente: o segundo transporte encontra a cobertura já no sucessor e não sobrescreve veredito posterior à adoção |
| `unlinkPolicy` em vínculo inexistente | `link.unknown` (já implementado, faltava teste) |
| `linkPolicy` duplicado | `@@unique([policyId, alvoTipo, alvoId])` recusa no banco; a tela não oferece vincular o que já está |

## 7. Teste

**Seed:**
- conteúdo idêntico não escreve nada
- `resumo` alterado sem subir `versao` lança erro nomeando o código
- `citacao` alterada sem subir `versao` **não** lança — não muda a obrigação
- `versao` nova cria conjunto com `supersedesId` correto

**`adoptSetVersion`:**
- transporta veredito não alterado sem virar `REVISAR`
- marca `REVISAR` só onde `resumo`/`texto` mudaram
- exigência nova nasce `SEM_VEREDITO`
- conjunto sem antecessor devolve `set.noPredecessor`
- rodar duas vezes não desfaz veredito dado após a primeira adoção

**`POLICY_LINK`:**
- o stub de `capabilities.test.ts` precisa ter **caso vinculado e caso solto**, e
  o teste precisa afirmar sobre a fração. Com stub devolvendo lista vazia, `de` e
  `lacunas` nunca são exercitados e o teste passa sem provar nada — foi
  exatamente esse o defeito que uma review pegou neste arquivo antes.

**`unlinkPolicy`** (hoje sem teste nenhum):
- desvincula o que existe
- devolve `link.unknown` no que não existe, em vez de sucesso silencioso

**Tela:**
- alcance mostra não vinculados no topo
- vincular remove a linha da lista de lacunas sem recarregar a tela inteira

**Verificação:** de dentro de `apps/app`, com os binários locais —
`./node_modules/.bin/tsc --noEmit` e `NODE_ENV=test ./node_modules/.bin/vitest run`.
O `pnpm run test` da raiz passa pelo cache do Turbo e pode replicar log antigo.

## 8. Lacunas conhecidas

- **Um `NAO_APLICAVEL` ou um `ATENDE` pode deixar de ser verdade sem nada
  avisar.** O denominador do `POLICY_LINK` cobre o caso de um caso de uso novo
  entrar sem vínculo. Não cobre a arquitetura mudar por baixo de um veredito que
  já foi dado — o mesmo ponto cego que o spec do corpus OWASP já registrou.
- **A adoção de versão é por conjunto, não por exigência.** Quem quiser adotar a
  redação nova de três exigências e ficar na antiga nas outras não consegue. Não
  vejo caso real para isso hoje, e o custo de suportá-lo é alto.
- **`publishSetVersion` continua criando cópia por tenant.** Correto para
  conjunto do tenant, que é o caso que a UI nova cobre. Se algum dia a Nebuloz
  quiser versionar um conjunto global pela aplicação em vez do seed, esta função
  não serve — e o desenho certo aí é outro, com escrita cross-tenant e a
  pergunta do `rolbypassrls` respondida antes.
- **O vínculo em lote é manutenção, não fluxo.** Ver §5.5. Se o número de casos
  sem vínculo crescer entre auditorias, o desenho certo passa a ser um lembrete
  no dashboard, não mais uma tela.
