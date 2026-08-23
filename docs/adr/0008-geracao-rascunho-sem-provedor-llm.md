# ADR-0008 — Geração de rascunho sem provedor de LLM no V1

**Status**: Accepted · **lacuna de spec**
**Data**: 2026-07-28
**Contexto de origem**: `FR-2.7`

> **Superseded (NEB-156)**: `generatePolicyDraft` agora chama um provedor de
> LLM de verdade (grounded no inventário do tenant), então a decisão "sem
> provedor de LLM no V1" abaixo não vale mais. Registro histórico mantido
> como estava — ver `docs/design-handoff/charter-prototype/HANDOFF.md` e o
> plano de NEB-156 para o desenho atual.

## Contexto

`FR-2.7` exige:

> deve oferecer geração de rascunho de seção **assistida**, com estado
> intermediário visível (form → gerando → resultado editável). Rascunho gerado
> entra como `draft`, **nunca** como `published`.

O PRD reforça em UC-CHA-01: "reduzo semanas de trabalho legal de página em
branco".

**A lacuna**: nenhum documento define provedor, prompt, tratamento de erro,
custo por chamada, ou o que fazer com o conteúdo gerado do ponto de vista de
governança — e este é um produto cujo objeto é justamente governar uso de IA. Um
Charter que envia contexto organizacional a um modelo externo sem DPA estaria
violando a própria política que ajuda a escrever.

`packages/ai` existe no monorepo e o app já depende de `ai@^5`, então a
capacidade técnica está disponível. A decisão que falta é de produto e de
compliance, não de engenharia.

## Decisão

O **fluxo** é implementado por inteiro: os três estados visíveis, o resultado
editável, e a garantia de que entra como `DRAFT` (`saveGeneratedDraft` força
`status: "DRAFT"` e marca `generated: true` no servidor, independentemente do
que o cliente mande).

A **composição** é determinística a partir do contexto que o usuário digita — sem
chamada a modelo. `GenerateDraftModal` monta o corpo com o contexto informado
mais o lembrete de revisão humana obrigatória.

O ponto de troca é uma função só. Ligar um provedor não muda o contrato do modal,
nem a action, nem o schema: `generated` já existe na tabela para distinguir texto
assistido de texto humano na trilha de auditoria.

## Alternativas consideradas

**Ligar direto a um provedor.** Rejeitada: sem decisão de compliance sobre qual
provedor, com qual DPA e sob qual classe de dado o contexto organizacional se
enquadra. Um produto de governança de IA não pode ser o primeiro violador da
política do cliente.

**Não implementar FR-2.7 e deixar o botão fora.** Rejeitada: o fluxo, o estado
intermediário e a garantia de `DRAFT` são requisitos testáveis por si. Entregar a
casca vazia deixaria a parte governável do requisito por fazer.

**Biblioteca de templates por indústria.** Entrega valor real de "página em
branco" sem chamada externa. Fora do escopo do V1 — o PRD §17 já lista
"biblioteca regulatória por país" como fora de escopo, e templates por indústria
são a mesma família de trabalho.

## Consequências

- FR-2.7 está atendido no que é verificável: três estados, resultado editável,
  entrada como `DRAFT`, auditoria com `generated = true`.
- O texto produzido **não** reduz trabalho de página em branco hoje. A promessa
  do PRD não está cumprida, e isso precisa ser dito em demo — não vender como
  geração assistida real.
- Quando o provedor entrar, `generated` já permite a pergunta de auditoria que
  importa: "quais seções da política publicada nasceram de IA?".
- Antes de ligar: definir provedor, DPA, classe de dado do contexto enviado, e
  se o conteúdo do tenant pode sair da região configurada em `CharterSettings.geo`.
