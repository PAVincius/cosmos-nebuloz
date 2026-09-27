# 2026-09-27 — Registro de decisões: preço, copiloto, raio X, modelo próprio e memória

Branch `claude/great-cori-herb4x`, junto com `2026-09-27-pacotes-e-precificacao.md`.
Só documento: nenhuma escrita em banco, nenhum código.

## O que entrou

- `docs/produto/registro-de-decisoes.md` — 18 decisões (D-01 a D-18), cada uma
  com estado (Decidida, Direção ou Proposta), dono no Maestri e sinal de revisão.
  Quatro frentes, a pedido do CEO:
  - sequência e preço (D-01 a D-06);
  - copiloto em todos os produtos e raio X (D-07, D-08);
  - modelo próprio (D-09 a D-11);
  - memória empresarial de longo prazo (D-12 a D-18).
  O documento termina com "Ponytail", ordem de execução e o que aguarda o CEO.
- `docs/produto/index.md` — link para o registro.
- `docs/comercial/pacotes-e-precificacao.md`:
  - aponta para D-02 a D-06;
  - registra a cota técnica de 150% (D-05): consumo não faturado continua sendo
    custo.

## Decidido pelo CEO nesta data

- **D-01:** nenhum produto é vendido antes de passar pela esteira de validação
  do Maestri.
- **Direções:**
  - D-07: copiloto em todos os produtos, com escopo;
  - D-08: raio X em PDF que cresce com os produtos contratados;
  - D-12: memória empresarial de longo prazo como o sistema escalável.

Na mesma data, em resposta à pergunta do registro:
- **D-08:** page index é o sumário do raio X.
- **D-17:** horizonte de memória igual em todos os pacotes (o contrato
  inteiro). A proposta por pacote foi riscada no registro. Também não há
  diferença por fonte da memória entre pacotes.
- **D-01:** o lançamento é produto a produto, na ordem do dogfood.

## Achados conferidos no código

- **Índice vetorial:** `PIKnowledgeVector` guarda o texto indexado e nenhum
  caminho de apagamento o toca:
  - revogação de consentimento de reunião (`actions/meeting/consent.ts`);
  - pedido LGPD de titular (`lib/inngest/lgpd-dsr.ts`);
  - exclusão de entidade (`deleteRisk`).
  Documento enviado ao Copilot grava a sessão só no `metadata` e fica visível ao
  tenant inteiro. Também não há índice HNSW nem IVFFlat.
- **Copilot:**
  - só a escrita confere papel;
  - `createFeature` e `moveFeature` não passam pela auditoria e pedem
    confirmação só no prompt, contra o UC-02 `FULL_REVIEW` do Charter da própria
    Nebuloz;
  - `extractCitations` só é usado em teste;
  - `fenceUntrusted` não é usado pelo Copilot;
  - não há `maxOutputTokens` na rota.
- **Corpus de fine-tune:** `experiments/slm-pipeline` tem só dados, sem treino.
  O `etl_safe_corpus.py` extrai perguntas de PDFs de prova SAFe, e um deles é um
  arquivo "dumps". O `train.jsonl` precisa de triagem antes de qualquer treino.
- **Catálogo:** o SV-11 promete residência de dado, e o ADR-0016 diz que
  residência não é atendível.
- **Raio X:** o único gerador de PDF é o do Charter (`@react-pdf/renderer`). O
  Signal congela e exporta JSON. O Meridian não tem documento de entrega.
- **Deploy:** o `nebuloz-web` falha em produção na `main`. O `turbo.json` faz
  todo build depender de `@repo/database#migrate:deploy`, e o projeto não tem
  `DATABASE_URL`.

## Fora deste PR (sugerido como tarefa separada)

- Propagar revogação, pedido LGPD e exclusão para `PIKnowledgeVector`.
- Destravar o deploy do `nebuloz-web`: tirar a migration do build do site.

## Pendências (aguardam o CEO)

- D-03: números dos pacotes, depois do Caixa e do pre-mortem do Sócio.
- D-10: dado de cliente não treina modelo compartilhado; a minuta do DPA já
  promete isso.
