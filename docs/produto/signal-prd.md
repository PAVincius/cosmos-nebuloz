# Signal — Product Requirements Document

> **PRODUCT** Signal · **STAGE** Produto (cliente) · **STATUS** Draft for review
> **VERSION** 1.0 · **OWNER** Product, Nebuloz
> **COMPANION** [Signal SRD v1.0](./signal-srd.md)

Apura se cada iniciativa de IA valeu a pena: adoção e retorno juntos, com a origem de cada número à vista.

---

## 1. Problema

Quem investe em IA não consegue mostrar, com número defensável, se a iniciativa
é usada e se virou dinheiro. O reporte vive em planilha, BI e atualização
avulsa, e não resiste a contestação em comitê (`specs/003-signal-measure/spec.md:16-18`).
Adoção sozinha celebra uso que não rendeu; ROI sozinho defende um número que
ninguém reconstrói.

No [Mapa de fronteiras](./mapa-de-fronteiras.md) (Arquitetura de produto,
ago/2026 v1), o Signal é a fase **APURAR** e responde "Valeu a pena?": é o único
que decide sobre desempenho de valor em operação — "o vácuo real". O Mapa é o
alvo normativo; onde o código diverge dele, este documento registra um **gap**.

> **A REGRA-MÃE**
> Adoção e resultado moram juntos. ROI nunca aparece sem versão da fórmula e sem
> confiança (`spec.md:14`; `contracts/ui-contract.md` §6).

### Evidência

Referência: `main` @ `ea512044`. Sem pasta raiz (`packages/`, `specs/`, `docs/`, `.claude/`),
o caminho é relativo a `apps/app/`; `actions/` abrevia `app/(signal)/actions/` e `screens/`,
`components/signal/screens/`; os arquivos da spec ficam em `specs/003-signal-measure/`; nome
sozinho remete à última citação completa do arquivo.

- Não há evidência de cliente nem de tenant real usando o módulo. O problema vem
  de um PRD externo que não está no repositório (`uploads/signal-prd-detailed.md`).
- O site já vende o produto, e o catálogo tem preço de R$ 1.200/mês
  (`packages/database/scripts/2026-08-comercial.sql:94`).
- O código V1 está na `main` desde 2026-09-04 (PR #182): 18 modelos, 10 telas,
  416 testes. Nenhuma tela foi vista rodando e os E2E não foram executados
  (`.claude/completions/2026-09-02-signal-measure.md:33-48`, `:142-151`).

---

## 2. Usuários

| PAPEL | TRABALHO A FAZER | SUCESSO É |
|---|---|---|
| Comprador: CFO ou Head de Operações | Decidir se a verba de IA renova | Número que aceita levar ao comitê, com ressalvas escritas |
| Usuário real: quem monta o orçamento | Defender a linha de IA no comitê | Relatório congelado que não muda depois de apresentado |
| Leitor (`VIEWER`) | Ler tudo e exportar relatório congelado | Ver número e origem sem pedir acesso |
| Dono de iniciativa (`OWNER`) | Registrar a própria iniciativa e assinar o baseline | Ativar só com linha de base assinada |
| Analista (`ANALYST`) | Mapear métrica, versionar fórmula, pontuar confiança, tratar alerta | ROI com componente, fonte e premissa visíveis |
| Administrador (`ADMIN`) | Fontes, réguas, congelamento, encerramento e papéis | Mudança de régua registrada com de → para |

- Comprador e usuário real vêm do ICP (`docs/comercial/icp-e-precificacao.md:202-203`);
  os papéis, de `packages/rbac/src/signal-matrix.ts:69-117`. Admin do tenant não
  herda papel no Signal (`lib/signal/guards.ts:60-76`). As personas do protótipo
  eram lentes de leitura e não foram portadas (`contracts/ui-contract.md:40`).
- **Gap com o Mapa.** Papel e permissão são do Charter; persona é lente sobre
  esse papel, nunca segundo modelo. O Signal tem `SignalRole`, `SignalMember` e
  matriz própria (`packages/database/prisma/schema/signal.prisma:107-119`). Ver S-21.

---

## 3. Objetivos e não-objetivos

### Objetivos

As quatro primeiras linhas são o núcleo exclusivo do Signal ("Consequência", no Mapa).

| OBJETIVO | MEDIDA | ESTADO NA MAIN |
|---|---|---|
| Decisão de valor | Continuar, escalar, pivotar ou encerrar, registrada com dono e prazo, enviada ao Cosmos | parcial — veredito e ação sugerida derivados; nada registra a decisão (S-29) |
| Atribuição de ganho | Fator, contrafactual e selo de confiança por ganho | ausente — atribuição é texto livre em transformação ou premissa (S-30) |
| Encerramento de benefício | Benefício apurado, variância contra o caso de negócio, lição ao Scaffold | parcial — encerrar exige motivo; sem benefício, variância nem lição (S-31) |
| Governança de dado de valor | Dono por métrica, fórmula versionada com retroatividade declarada, política de lacuna | parcial — fórmula e mapeamento versionados; sem dono por métrica nem retroatividade |
| ROI nunca sozinho | Nenhum múltiplo sem versão da fórmula e confiança | parcial — lista e detalhe sim; agregados não (S-09) |
| Número derivado, nunca digitado | Investido, retornado, múltiplo, score, adoção e veredito calculados na leitura | implementado |
| O que o comitê leu não muda | Relatório congelado idêntico a cada exportação | implementado |

### Não-objetivos

- Da spec (`spec.md:40`): compras e billing, treino de modelo, política de uso,
  BI genérico, workflow de GRC e benchmark entre tenants (V2). Nem pessoas: a
  adoção é contagem por iniciativa, sem evento individual (`signal.prisma:429-449`).
- Do Mapa — o que o Signal lê ou anexa, sem ser dono:

| NÃO É DO SIGNAL | DONO NO MAPA | NA MAIN |
|---|---|---|
| Criar baseline e caso de negócio | Scaffold | gap (S-04, S-27) |
| Iniciativa, status, escopo e hierarquia de portfólio | Cosmos | gap (S-02, S-12, S-28) |
| Escala de confiança | Meridian | gap (S-07, S-30) |
| Papel e permissão | Charter | gap (S-21) |
| Avaliação de prontidão · ranking WSJF | Meridian · Cosmos | não citada · não alimentado (S-32, S-29) |
| Trilha canônica · tenant | Charter | alinhado: `AuditLog` compartilhado no formato do Charter; tenant lido da sessão |

---

## 4. As telas

Dez telas atrás de `/signal/[[...seg]]`, em quatro seções: Valor · Prova · Dado ·
Sistema (`components/signal/shell.tsx:71-112`). Fora do guard, `/signal-indisponivel`
separa módulo não contratado de papel ausente. A paleta ⌘K busca por código e nome.

| TELA | SEÇÃO | O QUE MOSTRA | O QUE A UI PERMITE NA MAIN |
|---|---|---|---|
| Visão geral | Valor | Retorno agregado, valor em risco, matriz adoção × valor, "Precisa de decisão", cortes por área e categoria | Só leitura |
| Iniciativas | Valor | Veredito, múltiplo, versão da fórmula, confiança e adoção por linha | Criar iniciativa; filtrar por status |
| Iniciativa (`/signal/initiative/IN-014`) | Valor | Hipótese, baseline, adoção, resultado, retorno, confiança, veredito, alertas, encerramento | Rascunhar e assinar baseline; ativar, pausar, retomar, encerrar; lançar observação manual |
| Alertas | Valor | Fila por severidade: regra, o quê, próximo passo, dono | Rodar as regras; reconhecer; resolver com nota |
| Evidências · Trilha · Relatórios | Prova | Observação com janela, fonte e transformação · de → para, autor e papel · relatórios e motivo de bloqueio | Congelar relatório e baixar JSON; o resto é leitura |
| Conexões · Mapeamento | Dado | Saúde, último sync, conserto e impacto · evento → métrica, versão e estado | Só leitura |
| Configurações | Sistema | Réguas, pesos de confiança, moeda, ano fiscal, papéis, contraste, movimento | Salvar réguas e pesos; trocar papel de quem já é membro |

> **RESTRIÇÃO DURA**
> ROI sem lastro — sem fórmula ativa ou com confiança zero — aparece tachado e
> marcado "sem lastro", nunca escondido (`components/signal/verdict-badge.tsx:40-126`).
> Retorno sem custo vira "—", nunca "0,0×" (`lib/signal/roi.ts:111-118`).

**O que só existe no servidor.** Conexão, sync, mapeamento, fórmula, pontuação de
confiança e rascunho de relatório têm action e nenhuma tela. Adoção e resultado
não têm nem action: só o seed grava (`packages/database/seed-signal.ts:1918-1937`).
Pela UI, **um tenant novo não chega a ROI, confiança nem veredito**.

---

## 5. Requisitos

Prioridade: P0 e P1 vêm das user stories (`tasks.md:21-29`); requisito sem
história herda a da história que destrava; "—" = sem prioridade na spec nem no
Mapa. **Gap** = o código diverge do Mapa; a evidência diz o que teria de mudar.

| ID | REQUISITO | PRI | ESTADO | EVIDÊNCIA |
|---|---|---|---|---|
| S-01 | Criar e editar iniciativa com hipótese falseável, categoria, BU, dono e valor esperado (FR-1, FR-2) | P0 | parcial | actions completas (`actions/initiatives.ts:489-579`); a tela cria só com nome, BU, categoria e hipótese (`components/signal/modal.tsx:124-129`), e nenhuma tela abre o modo de edição (`screens/initiatives.tsx:96`). A spec pede data de início na criação; o código carimba `startedAt` na primeira ativação (`initiatives.ts:663-664`). Vale o código |
| S-02 | Ciclo DRAFT → ACTIVE → PAUSED → CLOSED ou CANCELLED; encerrar e cancelar exigem motivo de 20+ caracteres (FR-3) | P0 | implementado | `lib/signal/lifecycle.ts:22-44`; `initiatives.ts:597-638`; a tela não oferece cancelar. **Gap:** status de iniciativa é do Cosmos (S-28) |
| S-03 | Ativar só com baseline assinado (FR-4) | P0 | implementado | regra `baseline.required` (`initiatives.ts:625-630`) |
| S-04 | Baseline com tempo, custo, volume, qualidade e base de usuários, cada um com fonte; versão assinada imutável (FR-5, FR-6) | P0 | implementado | `app/(signal)/actions/baseline.ts:236-263`; rascunho aberto é sobrescrito sem trilha (`:137-162`). **Gap:** criar baseline é do Scaffold (S-27) |
| S-05 | Adoção e resultado com série, e tendência de ROI (FR-10, FR-11, FR-14) | P0 | parcial | cálculo e tela (`lib/signal/adoption.ts:41-73`; `lib/signal/outcome.ts:82-115`); nenhuma action grava, só o seed; ROI sem série (`tasks.md:130`) |
| S-06 | ROI por componentes de retorno e custo, com fonte e premissas, em fórmula versionada (FR-12) | P0 | parcial | `versionRoiFormula` testada e sem tela (`app/(signal)/actions/roi.ts:157-267`) |
| S-07 | Confiança por fatores ponderados, com nota do desconto (FR-13) | P0 | parcial | pesos editáveis (`components/signal/screens/settings.tsx:210-250`); pontuar fatores só por action. **Gap:** escala é do Meridian (S-30) |
| S-08 | Veredito adoção × múltiplo contra as réguas do tenant (spec §6.5) | P0 | implementado | `lib/signal/verdict.ts:75-85` |
| S-09 | Nenhum múltiplo sem versão da fórmula e confiança (spec §9, critério 3) | P0 | parcial | lista e detalhe sim; sidebar, visão geral e matriz mostram múltiplo sozinho ([SRD](./signal-srd.md) §5) |
| S-10 | Visão geral com portfólio, ativas, valor em risco e alertas (FR-15) | P0 | parcial | sem bloco de alertas nem narrativa (`components/signal/screens/overview.tsx:349-397`) |
| S-11 | Detalhe com métricas, evidências e histórico (FR-16) | P0 | parcial | evidência só como contagem (`screens/initiative-detail.tsx:714`); histórico não aparece |
| S-12 | Corte por BU, programa, região ou categoria (FR-17) | P0 | parcial | só BU e categoria. **Gap:** corte é lente sobre a árvore do Cosmos; hoje é campo digitado (`signal.prisma:130-131`) |
| S-13 | Filtro por status, categoria, BU, veredito e texto (`contracts/server-actions.md:32`) | P0 | parcial | action sem veredito (`initiatives.ts:79-84`); tela só status (`screens/initiatives.tsx:114-118`) |
| S-14 | Conectar fonte, mapear evento → métrica e ver saúde com conserto e impacto (FR-7, FR-8, FR-9) | P1 | parcial | escrita só por action (`actions/connections.ts:116-189`; `actions/mapping.ts:173-297`); `kind` é texto livre; a queda propaga (`connections.ts:198-364`), mas nada dispara `recordSync` nem `recomputeHealth` |
| S-15 | Observação com origem rastreável (FR-19) | P1 | implementado | `app/(signal)/actions/evidence.ts:142-177`; na UI, só entrada manual |
| S-16 | Alertas LOW, WEAK e STALE com o quê e próximo passo (FR-21 a FR-23) | P1 | implementado | `lib/signal/alerts.ts:152-181`; disparo por botão |
| S-17 | Todo alerta com dono (spec §6.8) | P1 | parcial | alerta aberto pelo código nasce sem `ownerId` (`app/(signal)/actions/alerts.ts:213-223`) |
| S-18 | Congelar relatório e exportar do snapshot (FR-18) | P1 | parcial | congela e baixa JSON (`app/(signal)/actions/reports.ts:308-414`); rascunho sem tela; sem PDF |
| S-19 | Trilha append-only com de → para (FR-20); mudança de régua entra nela (US7) | P1 | implementado | `actions/_shared.ts:98-168`; `actions/settings.ts:121-179` |
| S-20 | Moeda da configuração em todo valor (`screens/settings.tsx:148`) | P1 | parcial | `fmtBRL` fixa "R$" (`lib/signal/roi.ts:101-109`) |
| S-21 | Acesso exige módulo contratado e papel de medição (spec §7.2, §7.3) | P0 | implementado | `lib/signal/guards.ts:44-120`. **Gap:** papel é do Charter; para fechar, o papel de medição vira lente sobre ele e `SignalMember` deixa de ser segundo modelo |
| S-22 | Incluir pessoa no Signal | P0 | ausente | `setMemberRole` só muda quem já é membro (`actions/settings.ts:226-231`); o provisionamento não cria membro; o primeiro nasce no seed (`seed-signal.ts:1807`) |
| S-23 | Isolamento de tenant em toda leitura e escrita (spec §7.1) | P0 | implementado | RLS nas 18 tabelas; não exercida em dev ([SRD](./signal-srd.md) §7) |
| S-24 | Acessibilidade: skip link, alvo de 44 px, foco, alto contraste, movimento reduzido (spec §7.4) | P1 | implementado | `components/signal/signal.css:411`, `:594-640`; axe não executado |
| S-25 | Dicionário pronto para en-US (spec §7.5) | — | ausente | textos fixos em PT-BR; nenhum `SG_DICT` |
| S-26 | Conector real para ao menos uma fonte (spec Q1) | — | ausente | V1 entrega contrato de conexão e entrada manual (`spec.md:40`, `:157`) |
| S-27 | Apurar contra o baseline assinado do Scaffold; sem ele, "aguardando promessa", nunca zero (Mapa, costura Scaffold → Signal) | — | ausente | **Gap.** Nenhum importador de `nebuloz.signal.baseline/2`; o Signal cria o próprio. Para fechar: importar por chave estável, guardar como referência imutável, tirar a criação do Signal |
| S-28 | Anexar valor à iniciativa e à árvore do Cosmos; só recomendar status (Mapa, costura Cosmos → Signal) | — | ausente | **Gap.** `SignalInitiative` própria, sem chave para `Epic` ou `StrategicTheme` (`signal.prisma:124-165`). Para fechar: referenciar o nó do Cosmos e trocar a transição de status por recomendação |
| S-29 | Decisão de valor registrada com dono e prazo e enviada ao Cosmos como entrada do WSJF (Mapa, costura Signal → Cosmos) | — | parcial | veredito e ação sugerida só na leitura (`lib/signal/verdict.ts:31-85`); nenhuma entidade de decisão; nada sai do Signal |
| S-30 | Atribuição de ganho com fator, contrafactual e selo Medido, Estimado ou Declarado, até o relatório (Mapa, costura Meridian → Signal) | — | ausente | **Gap.** Sem modelo de atribuição; a confiança é escala própria 0–100 com faixas Alta, Média e Baixa, que mede o método (`lib/signal/confidence.ts:32-53`). Para fechar: modelar a atribuição com a escala do Meridian e aposentar a nomenclatura própria |
| S-31 | Encerramento de benefício com variância e lição ao Scaffold (Mapa, costura Signal → Scaffold) | — | ausente | o encerramento guarda só o motivo (`signal.prisma:138-142`) |
| S-32 | Citar a avaliação de prontidão de origem, sem recalcular (Mapa) | — | ausente | nenhuma referência ao Meridian |

---

## 6. Critérios de sucesso

- O detalhe mostra adoção, resultado, ROI, versão da fórmula, confiança e veredito juntos. **Hoje:** só com o seed.
- Nenhuma tela mostra múltiplo sem versão da fórmula e confiança. **Hoje:** parcial (S-09).
- Fonte caída quebra o mapeamento, marca a evidência, abre alerta e derruba a
  confiança. **Hoje:** os três primeiros; a confiança não se move.
- Mudar a fórmula depois de congelar não altera o relatório. **Hoje:** implementado.
- Sem baseline do Scaffold, a iniciativa fica "aguardando promessa", nunca zero.
  **Hoje:** ausente (S-27).
- Visão geral abaixo de 1,5 s no p95 com 50 iniciativas; detalhe abaixo de 1 s
  (`plan.md:23`). **Hoje:** nunca medido.
- Nenhum tenant lê dado de outro. **Hoje:** garantido no código; E2E não executado.
- Meta de negócio (uso, renovação, receita): nenhuma no repositório (§9).

---

## 7. Riscos

| RISCO | EVIDÊNCIA | ESTADO |
|---|---|---|
| Cobrar pelo que a UI não entrega | Preço no catálogo e módulo contratável; pela UI, tenant novo não chega a veredito (§4) | Duas saídas registradas, nenhuma escolhida (`docs/superpowers/plans/INDEX-MESTRE.md:54-72`) |
| O site vende outra coisa | Conectores, telemetria por time, horas recuperadas, relatório para o conselho (`packages/internationalization/dictionaries/pt.json:547-552`); sequência "Medir" antes de "Governar" e "Operar" (`pt.json:298-304`) | Sem decisão (§9) |
| O modelo que o Mapa tira do Signal cresce | Baseline, iniciativa, escala e papel próprios (S-04, S-21, S-27, S-28, S-30) | Pendente: cada iniciativa nova nasce no modelo a migrar |
| A UI do Scaffold promete o que o Signal não faz | "O Signal apura contra BC-…" e "aguardando promessa" (`components/scaffold/signal-contract-card.tsx:138-174`) | Gap S-27 |
| Nada validado rodando | `.claude/completions/2026-09-02-signal-measure.md:142-151` | Pendente |
| Número parado sem aviso | Sem agendador: saúde e alertas só mudam quando alguém chama a action ([SRD](./signal-srd.md) §8) | Pendente |
| Vigilância quando chegar conector | "Mede adoção, não pessoas" só no ICP (`icp-e-precificacao.md:208`); supressão de grupo pequeno saiu da spec (`git show 85da4348:specs/003-signal-measure/spec.md`) | Sem regra escrita (§9) |

Riscos de engenharia (cache de papel, casca, trilha, relatório): [SRD](./signal-srd.md) §8.

---

## 8. Dependências

| DEPENDE DE | PAPEL NO MAPA | ESTADO NA MAIN |
|---|---|---|
| Scaffold | Dono do baseline (costura 1); recebe a lição de encerramento (costura 5) | Contrato v2 emitido, sem consumidor (`specs/002-scaffold-adoption/contracts/signal-baseline-export.md`) |
| Cosmos | Dono da iniciativa, da hierarquia e do WSJF (costuras 2 e 3) | Nenhuma troca; `/produto` mostra SIGNAL "sem tela" (`app/actions/produtos/index.ts:70-74`) |
| Meridian | Dono da escala de confiança e da avaliação (costura 4) | Gap promovido a `SIGNAL` fica com `targetEntityId` nulo (`packages/database/prisma/schema/meridian.prisma:101-104`) |
| Charter | Dono de papel, política e formato da trilha (costura 6) | Trilha no formato dele; papel próprio (gap S-21); UI reusa primitivas do Charter (`components/signal/base.tsx:10-65`) |
| Back-office (Big Bang) | Vender e operar | Contrata `TenantModule{SIGNAL}`; não cria `SignalMember` nem `SignalSettings` (`packages/provisioning/src/modules.ts:52-60`) |
| Plataforma | `@repo/auth`, `@repo/rbac`, `@repo/database`, Upstash | Sessão, módulo, papel, Prisma com RLS; cache de 5 min, opcional |

---

## 9. Questões em aberto

- **O que a V1 vende.** Com preço no catálogo e sem caminho de UI até o veredito: tirar
  `SIGNAL` do `PrecoDeModulo`, exigir aprovação para contratar ou fechar a UI antes?
- **Ordem dos gaps do Mapa.** Baseline, iniciativa, escala, papel ou o núcleo
  (decisão, atribuição, encerramento)? A spec 003 é anterior ao Mapa.
- **Chave do baseline importado.** `content_hash` ou `signalInitiativeRef`
  (`packages/database/prisma/schema/scaffold.prisma:553-555`)? E o cliente só de
  Meridian, que o ICP aceita (`icp-e-precificacao.md:200`)?
- **Como fechar os outros dois gaps.** O Cosmos não tem "iniciativa": o valor se
  pendura em `Epic` ou em `StrategicTheme`? E o score de confiança vira agregado
  dos selos do Meridian, ou sai?
- **Primeiro conector e copy do site.** A Q1 da spec segue aberta (`spec.md:157`). A copy muda até lá?
- **Adoção sem vigilância.** Agregação por time e supressão de grupo pequeno viram requisito antes do conector?
- **Dono e métrica de sucesso.** O RACI do Signal está vazio
  (`docs/comercial/playbook-de-vendas.md:121-137`), e não há meta de negócio.
- **Relatório.** PDF, recorte por iniciativa e período como filtro (hoje é rótulo)?
- **Primeiro membro.** Quem cria — e `SignalMember` sobrevive ao gap S-21?

---

*Draft para revisão interna. Documento companheiro: Signal SRD v1.0.*
