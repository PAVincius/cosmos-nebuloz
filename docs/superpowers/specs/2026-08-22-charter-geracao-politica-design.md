# Charter — geração do rascunho de política a partir do perfil real do tenant (NEB-156)

## 1. Por que este trabalho existe

O bootstrap do Charter cria a "Política de Uso de IA" com 9 seções vazias em
`DRAFT`. Preenchê-las é a primeira montanha do onboarding: quem chega não é
jurista, e uma página em branco com título "Uso aceitável" não ajuda. A promessa
do produto é reduzir essa montanha a revisão — o rascunho nasce pronto para ser
corrigido, não para ser escrito.

O que já existe, verificado em 22/08 contra o código:

| peça | estado | onde |
|---|---|---|
| Persistência de rascunho gerado | pronta | `policy.ts:200` — `saveGeneratedDraft` grava `body` + `generated: true` |
| Chamada de IA | **não existe** | nenhum `generateText` no módulo Charter |
| Infra de IA da casa | pronta | `packages/ai/lib/router.ts` — `getAIModel()` + `generateText`, padrão em `generate-prompt.ts`, `narrative-generator.ts`, `improve-description.ts` |
| Publicação com diff e versão | pronta | `publishPolicyVersion` + `getVersionDiff` |
| Teto de custo por IA | padrão pronto | cota mensal `fixedWindow(limite, "30 d")` sobre Postgres (PR #88, `analyze-invest`) |

O trabalho é ligar essas pontas — não construir plataforma nova.

## 2. A decisão central: o "perfil do cliente" não é um formulário

A issue fala em "perfil do cliente". A tentação é criar uma entidade
`ClientProfile` com setor, porte, apetite de risco — um formulário a mais para
preencher antes do formulário que a IA ia poupar.

**Decisão: o perfil é o dado que o Charter já tem.** O tenant que chega à
política já passou (ou vai passar) pelo resto do produto:

- **Casos de uso** (`CharterUseCase`): o que a empresa faz com IA, com as 7
  categorias de risco pontuadas
- **Fornecedores** (`CharterVendor`): de quem ela compra modelo/ferramenta, com tier
- **Conjuntos de exigência adotados** (`CharterRequirementSet` do tenant +
  globais com cobertura): a que regulação ela responde
- **Vigência e módulos contratados**: o contexto operacional

Gerar de formulário auto-declarado produziria política genérica de template.
Gerar do inventário real produz política que cita os casos de uso da casa pelo
nome — e envelhece junto com o dado, porque o dado é vivo.

Custo dessa decisão, dito claro: **tenant recém-bootstrapado, sem caso e sem
fornecedor, gera rascunho fraco.** Correto e honesto — a UI diz "quanto mais
casos e fornecedores cadastrados, melhor o rascunho" em vez de fingir que um
setor escolhido num dropdown substitui inventário.

## 3. Escopo

**Dentro.** Geração por seção (as 9 do bootstrap), grounded no inventário do
tenant e nas exigências dos conjuntos com cobertura; botão "Gerar rascunho" na
seção em `DRAFT`; cota mensal de geração; auditoria de cada geração.

**Fora, deliberadamente:**
- **Auto-publicação.** Rascunho gerado nasce `DRAFT` com `generated: true` e
  segue o fluxo humano de edição → status → publicação com diff. Produto de
  governança que publica política sozinho é oxímoro.
- **Entidade de perfil / formulário novo.** Ver §2.
- **Geração da política inteira num clique.** Por seção, sempre — o dono lê o
  que aprova, e 9 gerações de uma vez é como ninguém lê nada.
- **NEB-157/158/159.** Specs próprios; ver §7.

## 4. Arquitetura

### 4.1 A action

```ts
generatePolicyDraft({ sectionId }): Promise<Result<{ body: string; grounded: GroundedRef[] }>>
```

Em `apps/app/app/(charter)/actions/policy.ts`, exigindo `policy.edit` (mesmo
guard do `editSection`). Fluxo:

1. Carrega a seção e recusa gerar sobre seção `PUBLISHED`/`IN_REVIEW`
   (`GovernanceError("section.notDraft")` — gerar por cima de texto aprovado é
   reescrita silenciosa, a classe de bug que o produto inteiro combate).
2. Cota: `fixedWindow` mensal por tenant (mesmo padrão do `analyze-invest`;
   limite inicial 30 gerações/mês — 3 voltas completas nas 9 seções).
3. Monta o contexto: casos de uso (código+título+categorias de risco altas),
   fornecedores (nome+tier), exigências dos conjuntos com cobertura do tenant
   **relevantes à seção** (mapa estático seção→categorias de exigência — ex.
   seção "Dados e privacidade" puxa exigências `categoria: dados/privacidade`).
4. `generateText` com `getAIModel()` (modelo médio da casa), prompt que exige:
   português, tom declarativo de política (não explicativo), citar caso de uso
   e fornecedor pelo nome quando pertinente, e **nunca inventar exigência** —
   só referenciar as fornecidas.
5. Devolve `body` + a lista `grounded` de `requirementId`s usados. **Não
   persiste** — quem persiste é o `saveGeneratedDraft` existente, no clique de
   "Aceitar rascunho" do usuário. Gerar ≠ salvar: o usuário pode descartar sem
   sujar nada.
6. `logCharterAudit`: ação "Gerou rascunho de seção", com modelo usado e
   contagem de fontes no `note`. A auditoria registra a **geração** (custo,
   proveniência); o salvamento já tem trilha própria.

### 4.2 O grounding devolvido não é decorativo

`saveGeneratedDraft` hoje aceita `groundedRequirementId` (spec da
conformidade). A action nova devolve os ids usados e a tela os repassa no
salvamento — fechando o ciclo: a seção salva sabe **de quais exigências
nasceu**, e o mapa de conformidade pode um dia mostrar "esta política cobre
estas exigências por construção". (Esse "um dia" fica fora daqui; o dado é que
não pode nascer perdido.)

### 4.3 A tela

Na seção em `DRAFT` de `policy.tsx`: botão "Gerar rascunho" (com o aviso de
inventário do §2 quando casos+fornecedores = 0). Resultado abre em prévia
dentro da própria seção — não modal — com "Aceitar" (chama `saveGeneratedDraft`
com body+grounding) e "Descartar". Seção com body existente pede confirmação
antes de sobrescrever a prévia sobre o texto atual.

Streaming fica fora da v1: seção de política tem ~300 palavras, `generateText`
resolve em segundos, e o estado de loading honesto ("Gerando… ~10s") custa uma
fração do encanamento de stream.

## 5. Erro

| situação | resposta |
|---|---|
| seção não-DRAFT | `GovernanceError("section.notDraft", "Seção publicada não recebe rascunho — edite uma revisão.")` |
| cota do mês esgotada | mensagem com o número: "30 gerações este mês; renova em N dias" |
| modelo indisponível/timeout | erro visível na prévia com "Tentar de novo"; nada persistido |
| inventário vazio | gera mesmo assim, com o aviso do §2 — recusar seria paternalismo |
| resposta da IA vazia/curta demais (<200 chars) | tratada como falha, não como rascunho |

## 6. Teste

- action: recusa seção não-DRAFT; respeita cota (mock do limiter); monta contexto
  com caso/fornecedor/exigência do tenant e **só** do tenant; devolve grounding
  não-vazio quando havia exigências relevantes; auditoria gravada.
- prompt: teste de contrato do contexto montado (o que entra no prompt), não do
  texto gerado — IA mockada sempre.
- tela: mock atrasado (padrão da casa pós-PR #80); prévia não persiste nada;
  "Aceitar" chama `saveGeneratedDraft` com body e grounding; "Descartar" limpa.
- verificação: binários locais de dentro de `apps/app`, suíte inteira + tsc.

## 7. O que este spec diz sobre as irmãs

- **NEB-157 (matriz de risco de fornecedor):** a matriz existe derivada de caso
  de uso; o caminho fornecedor→risco é ausente de verdade. Spec próprio depois
  deste — reusa o mesmo padrão de contexto+geração.
- **NEB-158 (cláusulas de fornecedor):** a auditoria indica que a biblioteca de
  cláusulas é **estática por design** e o vínculo é manual. Antes de spec:
  decisão de produto — cláusula jurídica gerada por IA sem revisão de advogado é
  passivo, não feature. Recomendação: reescopar a issue para "sugerir cláusulas
  da biblioteca por tier do fornecedor" (seleção, não geração).
- **NEB-159 (guia de onboarding):** ausente; espera a NEB-156 provar o padrão.

## 8. Lacunas conhecidas

- Qualidade do rascunho depende do inventário — tenant vazio recebe texto
  genérico (aceito e sinalizado, §2).
- O mapa seção→categoria de exigência é estático em código; corpus novo com
  categorias novas exige atualizá-lo (teste de contrato acusa categoria órfã).
- Custo de IA é limitado por cota, não por orçamento em reais — quando o
  billing por tenant existir, a cota migra para lá.
