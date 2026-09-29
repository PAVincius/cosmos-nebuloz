---
status: approved
---

# Intent: Ver evidência a partir de Coleta e do gap (Meridian A3)

**Feature Branch**: `010-evidencia-coleta-gap`

**Created**: 2026-09-29

**Input**: descrição original do usuário: "spec do Meridian A3 (decisão D-19 do Norte, confirmada pelo CEO em 29/09; detalhe em docs/produto/meridian-escopo-dogfood-a3-a5.md). Escopo mínimo: o botão Ver evidência (EvidenceButton; hoje em tab-scoring.tsx e no painel de divergência) aparece também onde a tela mostra 'N anexos' em Coleta e no gap; sem prévia nem download em lote; evidência eliminada pela retenção aparece sem botão. Mesma action requestEvidenceUrl (audita antes da URL), mesma permissão meridian.evidence.read. Critério de aceite testável, incluindo M8 provando evidence.read a partir de Coleta e do gap, e o caso sem permissão (403)."

## Problema

O consultor do Meridian não tem, hoje, caminho pela tela para abrir a evidência anexada a uma resposta quando está em Coleta ou olhando um gap — só vê um número ("N evidência(s) anexada(s)" em Coleta, "N anexos" no gap). A leitura em si já existe e já é auditada (`requestEvidenceUrl`, `apps/app/app/(meridian)/actions/report.ts:265`), e o botão que a aciona já existe (`EvidenceButton`, `apps/app/components/meridian/screens/tab-scoring.tsx:56-102`) — mas só é renderizado dentro do painel de divergência da aba Scoring & Revisão (`tab-scoring.tsx:273-278`, dentro de `DivergencePanel`).

Isso bloqueia o dogfood: sem abrir a evidência, o consultor não revisa o score nem defende o relatório ao cliente — é o que separa um achado "medido" de um achado "declarado" na escala de confiança da qual o Meridian é dono (Mapa de fronteiras).

## Contexto

Achado do dogfood local (`docs/qualidade/dogfood/meridian/diario.md:112`, main `93b77c9a`), virou decisão de produto D-19 (Norte, confirmada pelo CEO em 29/09, `docs/produto/meridian-escopo-dogfood-a3-a5.md`). É o item "A3" desse documento; o item irmão "A5" (dependência/ciclo entre gaps) foi explicitamente adiado e está fora desta spec.

Achados de código que definem o tamanho real do trabalho (maiores que "só chamar o componente em outro lugar"):

- **Coleta hoje só tem um número agregado, não uma lista.** `AssessmentDetail.evidence` é uma contagem única do assessment inteiro (`apps/app/app/(meridian)/actions/assessments.ts:46,138,202` — `_count.evidence`), renderizada como texto simples em `apps/app/components/meridian/screens/tab-coleta.tsx:1038`. Não existe, hoje, nenhuma lista de evidências individuais (id + nome de arquivo) em Coleta — só o total. Para "abrir cada evidência" (like the scope asks), a tela precisa passar a listar os arquivos individualmente, não só o número.
- **O gap também só tem contagem, e é a do assessment de origem inteiro.** `gap.evidenceCount` vem de `g.assessment._count.evidence` (`apps/app/app/(meridian)/actions/gaps.ts:124`) — é o total de evidências do assessment que originou o gap, não uma lista filtrada por eixo ou por pergunta. O texto atual já diz isso: "N evidência(s) anexada(s) no assessment de origem" (`apps/app/components/meridian/screens/gap-register.tsx:187-189`).
- **Elimination pela retenção não é sinalizada na listagem, só na tentativa de abrir.** `isEvidenceRetentionEliminated` (`apps/app/lib/meridian/evidence-retention.ts:17`) só é chamada dentro de `requestEvidenceUrl` (`report.ts:286`), depois do clique — nenhuma action de listagem hoje devolve se uma evidência já foi eliminada. Hoje, mesmo na aba Scoring (onde o botão já existe), clicar numa evidência eliminada só falha com um erro no toast; não há estado "sem botão ativo" em lugar nenhum ainda.
- **Não existe, hoje, nenhuma ocultação de botão por permissão em toda a superfície do Meridian.** Toda tela do módulo mostra os botões de ação (Fechar coleta, Registrar override, Abrir evidência) para qualquer papel, e quem não tem a permissão só descobre ao clicar (o servidor recusa com 403). Não há prop nem contexto de papel/permissão chegando hoje a nenhum componente cliente do Meridian (`grep` não encontra `meridianRole`/`canX` em nenhuma tela). Esconder o botão para quem não tem `evidence.read` é a primeira vez que esse padrão entra no módulo — não é reaproveitar algo que já existe em outro botão.

## Restrições

- Reaproveitar a mesma action (`requestEvidenceUrl`) e a mesma permissão (`meridian.evidence.read`) — nenhuma nova action, nenhuma nova permissão.
- Sem prévia inline do conteúdo do arquivo, sem download em lote — só abrir um arquivo por vez, como já funciona em Scoring.
- Sem gravar nome de arquivo em nenhum lugar novo (log, exportação) além do já existente — `requestEvidenceUrl` já evita isso deliberadamente (`report.ts:290-293`, comentário sobre dado pessoal no nome do arquivo).
- Não muda o tratamento de dado (mesma permissão, mesma trilha, mesmo bucket) — só muda de onde a leitura parte. Parecer de compliance de 2026-09-24 já cobre esta leitura (`docs/compliance/2026-09-24-parecer-meridian-respondente.md:20`).
- A5 (dependência/ciclo entre gaps) fica fora desta spec — é item separado, adiado por decisão de produto.
- Se a spec, ao detalhar, acabar propondo prévia de conteúdo ou nome de arquivo em superfície nova (lista, exportação), isso precisa passar pelo Lacre antes de ir para dev — não decidir sozinho.

## Resultado desejado

Um consultor (papel CONSULTANT ou REVIEWER) que está em Coleta ou olhando um gap consegue abrir cada evidência anexada, uma de cada vez, pelo mesmo botão e mesma URL assinada de curta duração já usados em Scoring — cada clique gera uma linha de auditoria `meridian.evidence.read` antes da URL existir. Evidência já eliminada pela política de retenção aparece marcada como eliminada, sem botão para abrir. Um usuário sem `evidence.read` (papel VIEWER) não vê o botão em lugar nenhum — nem em Coleta, nem no gap.

## Fora de escopo

- A5 (dependência/ciclo entre gaps, ajuste de severidade/esforço) — item separado, adiado.
- Prévia inline do conteúdo da evidência.
- Download em lote de várias evidências de uma vez.
- Filtrar a lista de evidências do gap por eixo ou por pergunta — mantém o mesmo escopo do `evidenceCount` atual (todo o assessment de origem).
- Ocultar por permissão em telas fora de Coleta e do gap (ex.: o painel de divergência em Scoring, que já expõe o botão sem checar permissão no cliente hoje) — fica registrado como achado relacionado, não como requisito desta spec.
