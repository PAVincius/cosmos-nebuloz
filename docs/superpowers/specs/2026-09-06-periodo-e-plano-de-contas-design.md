# Período por intervalo e plano de contas editável — subprojeto A

**Data**: 2026-09-06
**Status**: aprovado em conversa (itens 1 e 2 de 6 set), spec para o plano
**Telas**: CAC, Financeiro (DRE, Caixa, Plano de contas)
**Depende de**: [`2026-09-05-telas-empresa-modelo-design.md`](2026-09-05-telas-empresa-modelo-design.md) (em produção desde `334eefe5`)
**Referência externa**: [date-range-picker-for-shadcn](https://github.com/johnpolacek/date-range-picker-for-shadcn) (`src/date-range-picker.tsx`, `src/date-input.tsx`) — portado, não instalado

---

## 0. O que muda

1. **Um seletor de período** para CAC e Financeiro, portado do componente do
   johnpolacek para a paleta do back-office: intervalo de/até, presets em
   português, entrada digitada, calendário de dois meses. Substitui os
   `<input type="month">` das duas telas.
2. **DRE e CAC por intervalo.** O intervalo se arredonda para meses inteiros;
   o DRE mostra uma coluna por mês (teto de 12) mais o total; o CAC agrega os
   meses; o caixa mostra as semanas contidas no intervalo (teto de 26).
3. **Plano de contas editável.** O plano deixa de ser constante e vira tabela
   `ContaDoPlano`, semeada com as 27 contas, com aba própria para criar,
   renomear e desativar conta. O DRE se recompõe a partir das contas ativas.

Fora: modo "comparar" do componente original; FinOps (lançamentos, títulos,
orçado × realizado, MRR) — subprojeto D; funil (B); mapa de processos (C).

## 1. Princípios (herdados da spec anterior, mais três)

- Tudo no tenant `system`; centavos `Int`; entrada `Int?`; nada calculado
  persistido; texto em código, dado em tabela; um número, uma fonte.
- **O intervalo é estado de URL.** `?de=AAAA-MM-DD&ate=AAAA-MM-DD` nas duas
  páginas. Sem parâmetros, o padrão da aba. Recarregar a página reproduz o que
  se via; um link compartilha o período.
- **Meses inteiros.** O que o usuário escolhe são dias; o que a leitura usa
  são as competências que esses dias tocam. `01/07–15/09` lê jul, ago, set.
- **Tetos explícitos.** 12 meses no DRE e no CAC, 26 semanas no caixa. Acima
  disso a action recusa com mensagem, não trunca em silêncio.

## 2. Componente `SeletorDePeriodo`

`apps/backoffice/components/seletor-de-periodo.tsx` (cliente) e
`apps/backoffice/components/entrada-de-data.tsx` (o `DateInput` portado).

Porte do `DateRangePicker` sem `showCompare`, sem `Select` de preset (a lista
de presets é uma coluna de botões, como no original), com estas trocas:

| Original | Aqui |
|---|---|
| `Button`, `Popover*`, `Calendar`, `Switch`, `Select` do shadcn local | `Popover`, `PopoverTrigger`, `PopoverContent` e `Calendar` de `@repo/design-system/components/ui/*`; botões com a classe `.btn` e os tokens do back-office (`--surface`, `--surface-2`, `--hairline`, `--ink`, `--accent`); sem `Switch`/`Select` |
| `locale` string, `en-US` | `ptBR` de `date-fns/locale` no `Calendar`, rótulos e formato `dd/mm/aaaa` fixos em PT-BR |
| Presets fixos em inglês | prop `presets: Preset[]`; `type Preset = { id: string; rotulo: string; intervalo: (hoje: Date) => Intervalo }` |
| `onUpdate({ range, rangeCompare })` | `onAplicar(intervalo: Intervalo)` só quando mudou |
| `initialDateFrom/To` | `valor: Intervalo` (controlado pela página) |
| `DateInput` mês/dia/ano | `EntradaDeData` dia/mês/ano, mesma validação de dígitos, Tab entre campos |

`type Intervalo = { de: string; ate: string }` — ISO `AAAA-MM-DD`, sem hora,
sem fuso (mesma convenção de `semanaInicio`). O gatilho mostra o rótulo do
preset quando o intervalo bate com um, senão `dd/mm/aaaa – dd/mm/aaaa`.
`numberOfMonths={2}`; em tela estreita (`useNarrow` do kit, se existir; senão
`matchMedia` local) cai para 1. `align` como no original.

Presets, em `apps/backoffice/lib/empresa/periodo.ts`:

- `PRESETS_COMPETENCIA`: este mês, mês passado, últimos 3 meses (padrão do
  DRE e do CAC), trimestre atual, este ano.
- `PRESETS_CAIXA`: próximas 13 semanas (padrão do caixa), próximas 26
  semanas, este trimestre.

## 3. Lib de período — `apps/backoffice/lib/empresa/periodo.ts`

Funções puras, testadas sem banco:

- `intervaloValido(i): boolean` — datas ISO válidas e `de <= ate`.
- `competenciasNoIntervalo(i): string[]` — `["2026-07", …]`, meses tocados,
  ordem crescente; lança `IntervaloExcedido` acima de 12.
- `segundasNoIntervalo(i): string[]` — segundas-feiras (UTC) entre o `de`
  arredondado para a segunda da semana e o `ate`; lança acima de 26.
- `intervaloPadraoCompetencia(hoje): Intervalo` — do primeiro dia do mês
  `hoje − 2` ao último dia do mês corrente (= "últimos 3 meses").
- `intervaloPadraoCaixa(hoje): Intervalo` — da segunda corrente até o domingo
  da 13ª semana.
- `rotuloDoIntervalo(i, presets, hoje): string` — nome do preset que bate, ou
  `dd/mm/aaaa – dd/mm/aaaa`.
- `lerIntervaloDaUrl(params, padrao): Intervalo` — valida `de`/`ate`; inválido
  ou ausente cai no padrão.

## 4. Plano de contas como tabela

### 4.1 Modelo — `empresa.prisma`

```prisma
/// Plano de contas da Nebuloz (docs/financeiro/plano-de-contas.md). Era
/// constante em código; virou tabela em 6 set porque a operação precisa
/// abrir conta sem deploy. As 27 do documento entram por seed.
model ContaDoPlano {
  id       String @id @default(cuid())
  tenantId String

  /// "1.1" … "6.3", ou o que o operador criar ("4.7"). Formato `^\d\.\d{1,2}$`.
  conta String
  nome  String
  /// 1 receita · 2 deduções · 3 custo de entrega · 4 comercial ·
  /// 5 produto/engenharia · 6 G&A. Define onde a conta soma no DRE.
  grupo Int
  /// comercial | produto-engenharia | entrega | ga; nulo nos grupos 1 e 2.
  centroDeCusto String?
  /// Desativada some da entrada e do DRE dos meses seguintes; os lançamentos
  /// já feitos continuam somando onde estão. Não há exclusão.
  ativa Boolean @default(true)
  ordem Int     @default(0)

  criadoEm     DateTime @default(now())
  atualizadoEm DateTime @updatedAt

  tenant Tenant @relation("ContaDoPlanoSystemTenant", fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, conta])
  @@index([tenantId, grupo])
}
```

Migration `20260907000000_conta_do_plano`, com RLS no mesmo bloco `DO $$`.
`LancamentoMensal.conta` continua `String` sem FK: lançamento sobrevive à
desativação, e a validação é na action (conta existente e ativa).

### 4.2 Seed

`PLANO_DE_CONTAS` sai de `apps/backoffice/lib/empresa/plano-de-contas.ts`
para `packages/provisioning/src/plano-de-contas-nebuloz.ts` (só dados). O
seed `seed:empresa:nebuloz` passa a semear as 27 contas também (create-only,
`skipDuplicates`). Em produção, SQL de seed entregue ao usuário como das
outras vezes.

### 4.3 O que muda no lib

`plano-de-contas.ts` deixa de ter a lista e passa a ter só o que é regra:

- `type Grupo`, `type CentroDeCusto`, `type Conta` (agora com `ativa`).
- `CONTAS_DO_CAC` (as seis 4.x) e `ContaDoCac` — continuam constantes: são o
  vínculo com o modelo de CAC, não o plano.
- `contaValida(codigo)` vira formato (`^\d\.\d{1,2}$`); a existência é
  consultada no banco.
- `centroDoGrupo(grupo)` — 3→entrega, 4→comercial, 5→produto-engenharia,
  6→ga, 1/2→null.
- `LINHAS_RECEITA/CUSTO/DESPESA` **saem**. As linhas do DRE passam a ser
  derivadas das contas: uma linha por conta ativa nos grupos 1 e 3; uma linha
  por centro de custo (comercial, produto e engenharia, G&A) somando as contas
  ativas dos grupos 4, 5 e 6. Conta desativada com lançamento no mês aparece
  na linha do seu grupo com o sufixo "(desativada)".

`calcularDre(contas: Conta[], lancamentos: LancamentosDoMes): LinhaCalculada[]`
— mesma semântica de nulo (linha agregada nula se qualquer conta ativa do
grupo estiver sem lançamento no mês). `somarMeses` inalterada; a coluna
"Trim." vira "Total".

### 4.4 Aba "Plano de contas" — `/empresa/financeiro?aba=plano`

Tabela por grupo (código, nome, centro, ativa, ações). Formulário de nova
conta: código (validado no formato e único), nome, grupo (select 1–6). Centro
derivado do grupo, só leitura — nada lê `centroDeCusto` fora da própria conta,
então não há por que editá-lo. Ações por linha: renomear (inline, `onBlur`),
desativar/reativar. Sem excluir — ponytail: desativar cobre o caso e não
quebra lançamento. Escrita gated por `podeEscrever`.

Actions em `financeiro.ts`: `listarPlanoDeContas()`, `criarConta(input)`,
`atualizarConta({ conta, nome?, ativa? })`. `salvarLancamento` recusa conta
inexistente ou inativa.

## 5. Leituras por intervalo

### 5.1 DRE — `lerDre({ de, ate })`

Competências = `competenciasNoIntervalo`. Uma coluna por mês, mais "Total"
(`somarMeses`). Contas = `ContaDoPlano` do tenant (ativas, mais as inativas que
tenham lançamento no intervalo). `salvarLancamento` ganha `de`/`ate` para
devolver a mesma janela — substitui o `competenciaFinal` de hoje.

### 5.2 CAC — `lerCac({ de, ate })`

Competências = `competenciasNoIntervalo`. A view ganha `competencias: string[]`
e `editavel: boolean` (verdadeiro só com um mês). Parcelas agregadas:

- conta 4.x: soma dos meses; **nula se qualquer mês do intervalo estiver sem
  lançamento** (mesma regra do DRE: total parcial mentiria com cara de número).
- `entregaDiagnosticoCentavos`: idem sobre `CacPeriodo`.
- `clientesGanhos`: soma; nula se algum mês for nulo.
- conversão e alocação: as do **último** mês do intervalo (são taxas, não
  somas); a tela diz de que mês são.
- `sugestaoClientesGanhos`: propostas `ACEITA` atualizadas dentro do intervalo.

`calcularCac` não muda: recebe as parcelas agregadas. As escritas
(`salvarParcelas`, `salvarConversao`, `salvarAlocacao`) continuam por
`competencia` e a tela só as oferece quando `editavel`; com mais de um mês os
inputs ficam `readOnly` com a nota "selecione um mês para editar".

### 5.3 Caixa — `lerCaixa({ de, ate })`

Semanas = `segundasNoIntervalo`. O resto igual: saldo de extrato só é lido na
primeira semana da janela; `salvarSemana` ganha `de`/`ate` para devolver a
mesma janela.

## 6. Páginas

- `/empresa/cac?de&ate` — `SeletorDePeriodo` com `PRESETS_COMPETENCIA` no
  lugar do `<input type="month">`; `key` do painel = `${de}:${ate}`.
- `/empresa/financeiro?aba=dre|caixa|plano&de&ate` — seletor por aba (DRE e
  Caixa têm padrões e presets diferentes; Plano não tem seletor). A aba DRE
  perde o campo "Até". `key` dos painéis = `${aba}:${de}:${ate}`.

Ao aplicar o seletor, a página faz `router.push` com os novos parâmetros; o
servidor relê. Sem estado de intervalo no cliente além do próprio seletor.

## 7. Testes

- `periodo.test.ts`: competências e segundas de intervalos comuns e de borda
  (mesmo dia, virada de ano, 12 meses ok, 13 recusado, 26 semanas ok, 27
  recusado), padrões, rótulo, leitura da URL.
- `financeiro.test.ts` (lib): `calcularDre` com contas dinâmicas — conta nova
  no grupo 4 soma em "Comercial"; conta desativada com lançamento aparece;
  grupo sem conta ativa → linha ausente.
- `seletor-de-periodo.test.tsx` (jsdom): abre, preset aplica e chama
  `onAplicar` com o intervalo certo; digitar data inválida não aplica.
- actions: `lerDre` com 4 meses e total; `lerCac` com 2 meses (soma, nulo
  parcial, `editavel=false`); `lerCaixa` com 5 semanas; `criarConta` recusa
  formato/duplicata; `salvarLancamento` recusa conta inativa; teto de 12/26.
- `no-cross-tenant-leak` continua cobrindo os arquivos.

## 8. Fora do v1

Comparar períodos; fuso por usuário; exclusão de conta; conta com subcontas.
