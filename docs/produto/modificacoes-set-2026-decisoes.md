# Modificações de set/2026 (Scaffold, Signal, Charter): o que entra e o que precisa de decisão

- **Pedido por:** CEO · **Data:** 2026-09-29 · **Autor:** Norte (CPO)
- **Origem:** projeto "cards" no Claude Design (`claude.ai/design/p/691f7fe5-e623-458e-aa9f-92b8c46dbbd9`), documentos
  "Nebuloz - Scaffold Signal Charter - Modificacoes.html", "Scaffold - Backlog Trilhas e Entregaveis.md",
  "Nebuloz - Templates do Scaffold (spec e validacao de mercado).html", "Nebuloz - Marcas de Produto.html",
  "Auditoria Impeccable - Nebuloz.html" e "DESIGN.md".
- **Estado:** três decisões com o CEO (seção 1). O resto é trabalho de PO e Maestro depois delas.
- **Limite desta leitura:** os documentos foram lidos na íntegra; os `.jsx` dos protótipos não, só pelo que os
  documentos descrevem. Nada foi alterado no projeto do Claude Design nem no código.

## Resumo

A proposta organiza Scaffold, Signal e Charter pela mesma chave, as cinco "formas de trabalho" (assistente
conversacional, análise e priorização, revisão de documentos, triagem de demanda, relatórios recorrentes). No
Scaffold a forma vira template de trilha com entregáveis; no Signal, modelo de medição com contrafactual; no
Charter, perfil de controle com evidência. A divisão de donos respeita o Mapa de fronteiras. Não entra como está:
contradiz código, specs e uma ADR em cinco pontos, cria duas entidades sem dono e três costuras sem contrato.

## 1. Decisões do CEO

| # | Pergunta | Opções | Recomendação do CPO |
|---|---|---|---|
| D1 | Cinco formas de trabalho agora, ou três arquétipos completos primeiro? | (a) cinco templates já; (b) três arquétipos com 8–15 passos por fase, depois o quarto e o quinto | (b) para os templates do Scaffold, adotando as cinco formas já como vocabulário comum (enum X-02). É a ordem que o próprio documento de Templates do projeto registra, seção 08. Hipótese: sem validação com cliente. |
| D2 | O gate do Scale (SG-05) passa a exigir controles aceitos do Charter? | (a) mantém aceite da política; (b) exige controles aceitos | (a) no R1 e R2; (b) só no R3, depois de o Charter ter a entidade controle. Mudar agora trava o Scaffold numa entidade que não existe. |
| D3 | Qual sistema visual vale para Meridian, Scaffold, Signal e Charter? | (a) o do "cards": suíte escura, Inter Tight, Inter e JetBrains Mono, sem roxo; (b) o dos DESIGN.md do repo: fundo claro `#f5f6f8`, Manrope, Cosmos em lavanda | Separar tipografia de tema: fontes seguem o DS travado (Inter Tight, Inter, JetBrains Mono), tema claro dos quatro produtos fica como está. Decisão de marca; o CPO só aponta a contradição. |

## 2. O que já está coerente

- A tabela "quem é dono do quê" da proposta bate com `docs/produto/mapa-de-fronteiras.md`.
- Meta congelada no Signal vira pedido ao Scaffold, não edição local: respeita a costura 3.1.
- Modelos de medição com contrafactual atacam a lacuna já registrada em `signal-prd.md:75` ("Atribuição de ganho … ausente") e S-30 (`signal-prd.md:165`).
- Já existe no código e deve ser reaproveitado:
  - upload no bucket do tenant com leitura auditada (`packages/database/prisma/schema/scaffold.prisma:450-472`), o que responde boa parte de SC-PM-02;
  - trilha criada a partir de gap do Meridian (`apps/app/app/(scaffold)/actions/tracks.ts:102-170`);
  - permissões `case.submit` e `case.decide` (`packages/rbac/src/charter-matrix.ts:18-19`);
  - saúde de conexão do Signal (`packages/database/prisma/schema/signal.prisma:45`, `apps/app/lib/signal/health.ts:35-109`).

## 3. Onde a proposta contradiz o repo

| # | Ponto | Proposta | Repo hoje | Consequência |
|---|---|---|---|---|
| C1 | Arquétipos | 5 trilhas, passos A1…E3 (~3 por fase) | 3 arquétipos (`scaffold.prisma:88-92`), 3–4 passos por fase; o documento de Templates fixa meta de 8–15 por fase | Depende de D1 |
| C2 | Papéis | dono, consultora, transformation lead, team lead, sponsor; "sponsor e team lead só leem" | 5 papéis: TEAM_MEMBER, PROCESS_OWNER, TRANSFORMATION_LEAD, CONSULTANT, ADMIN (`scaffold.prisma:79-85`); patrocinador não tem conta (`scaffold.prisma:76-78`, `PRODUCT.md` do Scaffold); team lead não existe; TEAM_MEMBER completa passo (`scaffold-matrix.ts:89`) | SC-PO-04 parte dos 5 papéis existentes; não criar papel só-leitura sem decisão |
| C3 | SG-05 | Gate do Scale lê controles aceitos | Lê aceite da política (`specs/002-scaffold-adoption/spec.md:130`, `actions/gates.ts:130-150`) | Depende de D2; se (b), muda a spec 002 |
| C4 | Vencimento de evidência | Job agendado (CH-DEV-07) | "Não há job agendado: SLA, atraso e alerta são calculados na leitura (ADR-0011)" (`charter-srd.md:313`) | Calcular "vencida" na leitura, como o OVERDUE das mitigações (`charter.prisma:87-88`) |
| C5 | Conceito de controle e evidência | Controle com arquivo de evidência revisado | "Controle" não existe no PRD/SRD; evidência é trilha de auditoria + pacote exportado (`charter-prd.md:109`); mitigação sem arquivo nem histórico (`charter.prisma:437-460`) | Mudança de definição de produto: PRD e SRD do Charter antes de spec |
| C6 | Baseline no Signal | "Congelada" = baseline fixada no gate do Scaffold | Signal cria o próprio baseline (`app/(signal)/actions/baseline.ts:236-263`); não lê o Scaffold; "aguardando promessa" não existe (S-27) | Implementar a costura 3.1 antes do plano de medição |

## 4. Lacunas no Mapa de fronteiras

- **Entidades novas sem dono.** Registro único de processo (X-01) e enum de formas de trabalho (X-02). Proposta:
  formas de trabalho com dono Scaffold (dono do método). Registro de processo precisa de decisão, porque cruza com
  a lacuna S-28: iniciativa é do Cosmos pelo Mapa, mas o Signal emite IN-014 como entidade própria
  (`signal.prisma:124-127`).
- **Costuras novas sem contrato:** Signal → Scaffold (pedido de revisão de meta); Charter → Scaffold (controles
  aceitos, se D2 = b); Meridian → Scaffold (gaps ranqueados, hoje parcial via promoção).
- **Cenário de demo.** Casos da proposta (autorizações prévias, glosas, UC-117/119/120 e números como "erro 2,3×",
  "4% incorretas") não existem no repo; UC-118 no repo é "Triagem de sinistros" (`app/(charter)/actions/_shared.ts:79`).
  Números de cenário ficam só na demo, nunca em material comercial.

## 5. Design

- A Auditoria Impeccable trocou Manrope e Space Grotesk por Inter Tight, Inter e JetBrains Mono **só nos
  protótipos**. A produção segue em Manrope e Space Grotesk (`packages/design-system/styles/globals.css:439`,
  DESIGN.md de Meridian, Scaffold, Charter, Cosmos e back-office). Depende de D3.
- O `DESIGN.md` do projeto "cards" contradiz os DESIGN.md do repo, que são o alvo binding do `/impeccable`
  (CLAUDE.md). Depois de D3, um dos dois precisa ser corrigido.
- Marcas de produto (glifos da Escada, "Nebuloz - Marcas de Produto.html") são coerentes com o DS e têm rampa
  para fundo claro próxima do accent do repo (`#1d6a97`). Ainda não estão no código.

## 6. Próximos passos (PO)

1. Esperar D1–D3.
2. Com as respostas: specs por produto na ordem R1 → R2 → R3 da proposta, com C6 (costura 3.1) antes do plano de
   medição do Signal e C5 (PRD/SRD do Charter) antes dos perfis de controle.
3. Atualizar o Mapa de fronteiras com os donos e costuras da seção 4 (mesa do CPO; o PO propõe o texto).
4. Registrar D1–D3 em `registro-de-decisoes.md` quando o CEO decidir.
