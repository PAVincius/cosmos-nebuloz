# Trilhas de IA — para onde vai cada camada

Três templates de trilha — [governança](ai-governance.md), [conformidade](ai-compliance.md)
e [segurança](ai-security.md) — chegaram como markdown solto. Este documento
diz onde cada parte deles vira dado na suíte, o que já existe e o que exige
decisão antes de carregar.

> **Correção de leitura anterior.** Uma versão anterior desta análise mandava a
> Fase 2 destes documentos para o catálogo de `Service` do back-office, tratando
> o Scaffold como catálogo de serviço vendável. Isso valia antes do #168: o
> Scaffold agora tem modelo próprio de trilha — `ScaffoldTemplate`,
> `ScaffoldTemplateVersion`, `ScaffoldStepTemplate`, `ScaffoldGateCriterion` — e
> é ali que o conteúdo mora. `Service` continua sendo o que se **vende**; a
> trilha é o que se **executa**.

---

## 1. O encaixe que já existe, e é bom

As quatro fases do Scaffold são exatamente as dos documentos:

| `ScaffoldPhase` | Camada do documento |
|---|---|
| `ASSESS` | Fase 1 — Triagem |
| `PILOT` · `SCALE` | Fase 2 — Ações concretas por obrigação/camada |
| `EMBED` | Critério de "Pronto" |

E `ScaffoldTemplateVersion.authorLabel` já prevê o caso: *"pessoa, ou **método
Nebuloz** quando veio do baseline do método"*. Estes três documentos **são**
baseline de método. O campo foi feito para eles.

`ScaffoldStepTemplate` pede `statement` e `expectedArtefact`, com o comentário
que explica a diferença: *"É o que separa passo de instrução: o passo entrega
alguma coisa."* A Fase 2 de cada documento já vem nesse formato — ação de um
lado, entregável do outro. Não precisa ser reescrita, precisa ser transposta.

`ScaffoldGateCriterion` recebe o Critério de "Pronto". Cada documento fecha com
quatro condições numeradas; são quatro critérios de gate, e `evaluationType`
decide quais são `MANUAL` e quais dá para derivar.

---

## 2. A decisão que trava tudo: arquétipo × assunto

`ScaffoldArchetype` tem três valores — `TRIAGE`, `DOC_REVIEW`, `REPORTING` — e
`ScaffoldTemplate.key` é `"triage" | "docreview" | "reporting"`. **O template
implementado classifica por arquétipo de trabalho.** Os documentos classificam
por **assunto**: governança, conformidade, segurança.

São eixos diferentes, e a diferença não é cosmética. Uma trilha de governança
pode ser um trabalho de triagem (classificar sistemas por risco) ou de revisão
documental (escrever política). Forçar um no outro perde informação.

Três saídas:

**A — Assunto vira arquétipo.** Acrescentar `GOVERNANCE`, `COMPLIANCE`,
`SECURITY` ao enum. Simples, mas mistura duas taxonomias no mesmo campo: o enum
deixaria de significar "forma do trabalho" e passaria a significar duas coisas.

**B — Assunto é dimensão nova.** `ScaffoldTemplate` ganha um campo de assunto ao
lado do arquétipo. Preserva os dois eixos, custa uma migration e obriga decidir
o que fazer com os três templates que já existem.

**C — Assunto não é do template.** Os documentos viram **conteúdo** dentro dos
arquétipos existentes: a trilha de governança é um `TRIAGE` cujos passos de
`ASSESS` são as perguntas de triagem, e um `DOC_REVIEW` cujos passos de `PILOT`
produzem política e RACI. Nenhuma migration; um documento vira mais de um
template.

**Recomendo C**, e a razão está no próprio schema: `key` é string livre
justamente para trilha nova ser INSERT e não migration — o mesmo princípio que
`Service.trilha` documenta. `C` respeita isso; `A` e `B` gastam migration para
uma distinção que o produto ainda não precisou fazer.

Se depois ficar claro que o assunto precisa ser filtrável de verdade — e a fila
de supervisão do ADR-0017 lista "trilha, org, fase, idade" —, aí `B` se justifica
com evidência, não por antecipação.

---

## 3. Camada por camada

| Camada | Destino | Estado |
|---|---|---|
| Fase 1 — Triagem | `ScaffoldStepTemplate` em `ASSESS` **e/ou** `MeridianQuestion` | ver §4 |
| Fase 2 — Ações e entregáveis | `ScaffoldStepTemplate` em `PILOT`/`SCALE`, com `expectedArtefact` | vazio, é a carga principal |
| Critério de "Pronto" | `ScaffoldGateCriterion` | vazio |
| Prazos das ações (2-4 sem, 3-6 sem…) | `ScaffoldStepTemplate.estimateMinutes` | conversão necessária — ver §5 |
| Mapeamento NIST / ISO 42001 | `CharterRequirementSet` | **já existe** |
| EU AI Act, LGPD | `CharterRequirementSet` | **já existem** |
| DORA, SR 11-7, CRA, NIST Cyber AI Profile | `CharterRequirementSet` | **novos** |
| Exemplos de software | `CharterVendor` como biblioteca de referência | hoje é por tenant |
| Pacote setorial financeiro | sem destino — ver §6 | **lacuna** |

Cinco conjuntos de exigências já estão publicados em `regulacao-corpora.ts` com
`editor: "NEBULOZ"`: EU AI Act, LGPD, NIST AI RMF 1.0, ISO/IEC 42001 e o
checklist próprio de segurança em IA generativa. **Os documentos não trazem
framework novo** — trazem a camada de consultoria sobre frameworks que a Nebuloz
já catalogou.

---

## 4. Triagem: Meridian ou Scaffold?

As perguntas da Fase 1 servem a dois propósitos diferentes e a escolha não é
óbvia.

**No Meridian** elas são diagnóstico: medem maturidade, produzem nota por eixo e
alimentam lacunas. Os cinco eixos (`DATA`, `PROCESS`, `PEOPLE`, `GOVERNANCE`,
`INFRASTRUCTURE`) já existem, e as perguntas de governança e conformidade caem
no eixo `GOVERNANCE`, as de segurança em `INFRASTRUCTURE` e `DATA`.

**No Scaffold** elas são o primeiro passo da execução: a fase `ASSESS` de uma
trilha já contratada.

**Não são a mesma pergunta feita duas vezes** — são momentos distintos: o
Meridian pergunta para vender e sequenciar; o Scaffold pergunta para executar.
Mas o conteúdo se sobrepõe, e duplicá-lo literalmente cria duas fontes que
divergem no primeiro ajuste.

Proposta: as perguntas entram como `ScaffoldStepTemplate` de `ASSESS`, e o
Meridian referencia — não copia — as que virarem pergunta de bateria, numa
versão nova de `MeridianTemplate`. A bateria atual tem 15 perguntas nos cinco
eixos; estas são de segundo nível e não cabem sem decidir o tamanho da bateria.

---

## 5. Atritos menores, todos resolvíveis

**Prazo não é minuto.** `ScaffoldStepTemplate.estimateMinutes` é inteiro em
minutos; os documentos falam em semanas ("2-4 semanas", "3-6 meses"). Converter
é trivial, mas perde a faixa: "2-4 semanas" vira um número só. Ou se aceita a
perda e se registra a mediana, ou a faixa vai para o `statement` em texto.

**ISO 42001 é `REFERENCIA`, não `LIVRE`.** O schema já impõe: *"norma
proprietária (ISO/IEC 42001) só entra por citação e formulação própria"*. O
conteúdo ISO desses documentos não pode virar corpus verbatim. Já resolvido no
modelo — quem carregar precisa saber antes, não depois.

**Datas regulatórias envelhecem, e o Charter já sabe disso.** 2/ago/2026,
2/dez/2027, 11/set/2026 do CRA. Existem `vigenciaEm`, `vigenciaPropostaEm` e
`normaStatus`, com o comentário explicando por que as duas datas coexistem —
*"escolher uma é apostar no resultado de um trílogo, e o painel não aposta"*.
Os prazos entram como dado datado, nunca como texto no meio da prosa.

**Categorias novas não encaixam nas sete existentes.** As atuais são técnicas —
`arquitetura`, `backend`, `dados`, `frontend`, `modelos`, `monitoramento`,
`runtime` — e alimentam o `CATEGORIAS_POR_SECAO` da geração de rascunho de
política. DORA e SR 11-7 são organizacionais. Entrando com categoria nula, o
`relevante()` as trata como sempre pertinentes e elas vazam para as nove seções.
Provavelmente amplo demais: ou entra categoria nova (e o teste de contrato
obriga mapeá-la em alguma seção), ou se aceita o vazamento conscientemente.

---

## 6. A lacuna: pacote setorial não tem onde morar

Cada documento fecha com um pacote setorial financeiro — classificação de alto
risco para crédito e seguro, registro na base da UE, FRIA, integração com DORA,
MRM sob SR 11-7. É conteúdo de alto valor e é o que sustenta a venda no ICP do
Charter, que mira regulados.

**O modelo não tem variante por setor.** `ScaffoldTemplateOverlay` existe e faz
quase isso — customiza um template com `ops` sobre uma `baseVersion` — mas é
`tenantId`-escopado, uma customização de cliente. Um pacote setorial é da
Nebuloz e serve a muitos clientes.

Três saídas, e esta merece decisão sua:

- **Overlay sem tenant.** Tornar `tenantId` opcional e chamar de overlay de
  método. Reusa a máquina de `ops` e de conflito que já existe.
- **Versão de template própria por setor.** "Governança — financeiro" como
  `ScaffoldTemplateVersion` separada. Simples, mas duplica os passos comuns e
  faz o comum divergir no primeiro ajuste.
- **Fora do produto.** O pacote setorial vira material de venda e de consultoria,
  não dado. Legítimo para o V1, e o mais barato.

---

## 7. Ordem sugerida

1. **Decidir §2** (arquétipo × assunto). Sem isso não há onde carregar nada.
2. Carregar a Fase 2 como `ScaffoldStepTemplate` e o Critério de "Pronto" como
   `ScaffoldGateCriterion`, publicados com `authorLabel = "método Nebuloz"`.
3. Acrescentar DORA, SR 11-7, CRA e Cyber AI Profile a `regulacao-corpora.ts`,
   com `vigenciaEm` preenchido e a decisão de categoria da §5.
4. Decidir §4 (triagem no Meridian, no Scaffold, ou referenciada).
5. Decidir §6 (pacote setorial) — pode ficar por último sem travar o resto.

Os passos 1, 4 e 5 são decisão. O 2 e o 3 são carga de dado, e são a maior parte
do valor: transformam três markdowns numa trilha que o produto executa.
