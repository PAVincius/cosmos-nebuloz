# Roteiro de dogfood · Meridian

**Fonte:** `specs/001-meridian-diagnose/spec.md` (SC-001..010) + `specs/001-meridian-diagnose/quickstart.md` + `docs/qualidade/2026-09-23-plano-dogfood-esteira.md` (Produto 1).

**Decisões vigentes (Morgana/CEO):** D2 = respondentes são CEO + agentes via browser atuando como "auditoria de repo" (reproduz o AS-NBZ-001 para permitir comparação no M4); D3 = AS-NBZ-001 (carregado por SQL) fica como gabarito de comparação, não é apagado; D4 = "vai" do CEO exigido por passo (M1..M11), não por operação individual.

**Ambiente:** `https://app.nebuloz.ai` para todos os passos, exceto M10 (só local — ver nota do passo).

Cada passo lista: tela/URL, ação exata, resultado esperado (critério verificável), evidência a coletar, SC provado, e se escreve em produção.

---

## M1 — Abrir o AS-NBZ-002 pela carteira, do zero

- **Tela/URL:** `https://app.nebuloz.ai/meridian`
- **Ação exata:** CEO (papel consultor) cria um novo assessment escolhendo organização Nebuloz, a versão de template vigente (`v3.2` ou a que estiver ativa) e um prazo; confirma a criação; abre o assessment recém-criado (`AS-NBZ-002`) pela linha da carteira.
- **Resultado esperado:** `AS-NBZ-002` aparece na carteira com organização Nebuloz, versão de template travada, prazo definido e estado inicial (rascunho ou coletando); os quatro indicadores do topo da carteira refletem o novo assessment (spec US1, AS1).
- **Evidência a coletar:** screenshot da carteira com `AS-NBZ-002` listado; screenshot do detalhe recém-aberto; id/código do assessment.
- **SC provado:** SC-001 (início).
- **Escreve em prod:** Sim — cria assessment.

---

## M2 — Convidar respondentes por eixo

- **Tela/URL:** `https://app.nebuloz.ai/meridian/assessment/<AS-NBZ-002-id>` (aba Coleta)
- **Ação exata:** CEO atribui um respondente aos cinco eixos (Data, Process, People, Governance, Infrastructure) — cada respondente é um agente via browser atuando como "auditoria de repo" (D2). Confirma cada atribuição e verifica que o sistema gera o link seguro por eixo.
- **Resultado esperado:** os cinco eixos aparecem com dono atribuído na aba Coleta; cinco links `/meridian-responder/<token>` distintos são gerados, um por eixo; convite/lembrete é disparado (FR-008).
- **Evidência a coletar:** screenshot da aba Coleta com os cinco eixos com dono; os cinco tokens/links (print do console ou da tela de atribuição).
- **SC provado:** — (pré-condição para SC-006 no M3).
- **Escreve em prod:** Sim — atribuição de respondente e disparo de convite.

---

## M3 — Respondentes preenchem a bateria e anexam evidência, cronometrados

- **Tela/URL:** `https://app.nebuloz.ai/meridian-responder/<token>` (uma sessão por eixo, janela anônima/isolada por agente)
- **Ação exata:** cada respondente abre seu link, responde toda a bateria do seu eixo, anexa ao menos uma evidência por eixo, e envia. Cronometrar do instante em que a tela abre até o envio confirmado.
- **Resultado esperado:** cada eixo é concluído em menos de 10 minutos, evidência incluída (SC-006); após cada envio, o progresso de coleta sobe no painel da consultora (spec US2, AS4); a contagem de evidências do assessment aumenta.
- **Evidência a coletar:** timestamp de início/fim por eixo (5 medições); screenshot do painel de progresso antes e depois de cada envio; nome/tipo do arquivo de evidência anexado por eixo.
- **SC provado:** SC-006.
- **Escreve em prod:** Sim — respostas e evidência.

---

## M4 — Fechar coleta, rodar scoring e comparar com o AS-NBZ-001

- **Tela/URL:** `https://app.nebuloz.ai/meridian/assessment/<AS-NBZ-002-id>` (aba Coleta → Scoring & Revisão)
- **Ação exata:** com os cinco eixos cobertos, fechar a coleta (dispara o scoring automaticamente, FR-013). Bussola + Crivo comparam, eixo a eixo, o score e a confiança do `AS-NBZ-002` com os do `AS-NBZ-001` (gabarito SQL), usando o mesmo conjunto de respostas.
- **Resultado esperado:** cada eixo do `AS-NBZ-002` tem score 0–100 e confiança 0–1; os valores batem campo a campo com o `AS-NBZ-001`, pois mesma versão de template e mesmas respostas devem produzir o mesmo resultado (FR-014); qualquer divergência é investigada e explicada antes de seguir.
- **Evidência a coletar:** tabela comparativa AS-NBZ-001 × AS-NBZ-002 por eixo (score, confidence); screenshot da aba Scoring & Revisão do AS-NBZ-002.
- **SC provado:** SC-002.
- **Escreve em prod:** Sim — fecha coleta e computa scoring.

---

## M5 — Fila de revisão: eixo contestado, override com rationale

- **Tela/URL:** `https://app.nebuloz.ai/meridian/queue` (fila global) e `https://app.nebuloz.ai/meridian/assessment/<AS-NBZ-002-id>` (aba Scoring & Revisão)
- **Ação exata:** confirmar na fila global que o(s) eixo(s) com dispersão acima do limiar do `AS-NBZ-002` aparecem antes de qualquer override; abrir a divergência lado a lado; CEO tenta registrar override com rationale de menos de 20 caracteres (deve recusar), depois registra com score diferente do computado e rationale de 25+ caracteres (deve aceitar).
- **Resultado esperado:** eixo contestado listado na fila global antes do override (FR-020); tentativa com rationale curto é recusada explicando o mínimo (spec US3, AS3); override válido é aceito, o score computado original permanece visível no histórico junto com o override (FR-018).
- **Evidência a coletar:** screenshot da fila global com o eixo contestado; screenshot da recusa por rationale curto; screenshot do override aceito mostrando computado + override no histórico.
- **SC provado:** SC-003, SC-004.
- **Escreve em prod:** Sim — registro de override.

---

## M6 — Gap register + plano de 12 meses: conferir a topologia

- **Tela/URL:** `https://app.nebuloz.ai/meridian/assessment/<AS-NBZ-002-id>` (aba Gap register → Plano 12 meses); `https://app.nebuloz.ai/meridian/registry` para a visão canônica
- **Ação exata:** Crivo confere os gaps derivados do scoring do `AS-NBZ-002`; abre o plano de 12 meses gerado; para cada gap com dependência declarada, verifica manualmente que ele não aparece em trimestre anterior ao de nenhum pré-requisito.
- **Resultado esperado:** plano distribuído em até quatro trimestres; nenhum gap aparece antes de um pré-requisito (checagem topológica manual sobre o grafo real do assessment, FR-024); export do plano em formato legível por máquina confirma a mesma ordem (FR-025).
- **Evidência a coletar:** screenshot do plano por trimestre; export/JSON do plano; nota da checagem gap-a-gap (lista de pares gap→pré-requisito→trimestre).
- **SC provado:** SC-007.
- **Escreve em prod:** Não — leitura e verificação; nenhuma escrita nova é necessária para provar o SC.

---

## M7 — Relatório gerado sem planilha auxiliar

- **Tela/URL:** `https://app.nebuloz.ai/meridian/assessment/<AS-NBZ-002-id>` (aba Relatório & Benchmark)
- **Ação exata:** CEO abre e gera o relatório de entrega ao patrocinador do `AS-NBZ-002`, fechando o ciclo aberto no M1, sem sair do produto e sem planilha ou editor externo.
- **Resultado esperado:** o relatório mostra o shape de prontidão (radar dos cinco eixos), confiança, narrativa dos gaps de maior custo de atraso e plano (FR-031); nenhum dado foi montado fora do produto.
- **Evidência a coletar:** screenshot/PDF do relatório gerado; nota no diário confirmando que nenhuma ferramenta externa foi usada.
- **SC provado:** SC-001 (fim).
- **Escreve em prod:** Não — `getReport` é leitura computada (confirmado no código: `apps/app/app/(meridian)/actions/report.ts` só faz `findFirst`/`findMany`, sem `create`/`update`).

---

## M8 — Amostragem na trilha de auditoria de leitura de evidência

- **Tela/URL:** `https://app.nebuloz.ai/settings/audit`, filtrando `entityType` por prefixo `meridian.`
- **Ação exata:** Crivo consulta o log de auditoria filtrado por `meridian.` e amostra as entradas geradas pelos passos M1–M9: criação de assessment, atribuição de respondente, fechamento de coleta, scoring, contestação, override (com antes e depois), criação/transição de gap, e cada pedido de URL de evidência do M3.
- **Resultado esperado:** cada evento esperado do ciclo aparece na trilha, sem lacuna; toda leitura/URL de evidência solicitada no M3 tem entrada correspondente; a entrada de override mostra o valor antes e depois (FR-038).
- **Evidência a coletar:** screenshot/export do log filtrado; checklist de eventos esperados × encontrados.
- **SC provado:** SC-008.
- **Escreve em prod:** Não — consulta.

---

## M9 — Promover ≥1 lacuna para o Scaffold; tentar editar a lacuna fora do Meridian

- **Tela/URL:** `https://app.nebuloz.ai/meridian/assessment/<AS-NBZ-002-id>` (aba Gap register) ou `https://app.nebuloz.ai/meridian/registry`; depois a tela correspondente no Scaffold
- **Ação exata:** CEO promove ao menos um gap do `AS-NBZ-002` para o Scaffold (FR-027); em seguida, Crivo tenta editar o enunciado, severidade ou custo de atraso desse gap a partir da tela do Scaffold.
- **Resultado esperado:** o gap aparece promovido no Meridian, mostrando destino (produto, identificador, rótulo) e que o enunciado não é editável dali (spec US4, AS4); o trabalho criado no Scaffold carrega a referência ao gap de origem (`origin_gap_id`); a tentativa de editar enunciado/severidade/custo de atraso a partir do Scaffold é recusada ou simplesmente não oferecida (FR-028).
- **Evidência a coletar:** screenshot do gap promovido no Meridian; screenshot do item criado no Scaffold com a referência ao gap de origem; screenshot/print da tentativa de edição recusada.
- **SC provado:** SC-009 → entrada do Scaffold.
- **Escreve em prod:** Sim — promoção do gap e criação do trabalho no Scaffold.

---

## M10 — Carga: 200 assessments / 2.000 gaps, só no local

- **Tela/URL:** `http://localhost:3012/meridian` — **não é `app.nebuloz.ai`, este passo não roda em produção.**
- **Ação exata:** Crivo roda seed/carga local com 200 assessments e 2.000 gaps; mede o tempo de resposta da carteira (`/meridian`) e do registro de gaps (`/meridian/registry`).
- **Resultado esperado:** carteira e registro de gaps respondem em menos de 2 segundos sob essa carga (SC-010).
- **Evidência a coletar:** medição de tempo de resposta (aba Network do devtools ou script de medição); print do ambiente local com a carga aplicada.
- **SC provado:** SC-010.
- **Escreve em prod:** Não — roda exclusivamente no ambiente local, por decisão do plano (risco de sujar produção).

---

## M11 — Benchmark: com coorte < 5, nenhuma comparação aparece

- **Tela/URL:** `https://app.nebuloz.ai/meridian/benchmark` (pool) e `https://app.nebuloz.ai/meridian/assessment/<id-setor-agro>` (aba Relatório & Benchmark), assessment de um setor com coorte com n < 5
- **Ação exata:** Crivo abre o pool de benchmark e o relatório de um assessment cujo setor tem coorte abaixo do mínimo (n=3, por exemplo); confere que nenhuma comparação/percentil é exibida em nenhuma das duas telas, e sim a declaração de retenção; inspeciona a resposta da action (aba Network) para confirmar que os percentis não são retornados.
- **Resultado esperado:** a coorte aparece retida com o número de contribuições, sem percentil exposto em nenhuma superfície (FR-033, FR-034); a resposta da action já não traz os percentis — o corte é na leitura, não na renderização.
- **Evidência a coletar:** screenshot do pool com a coorte retida; screenshot do relatório com a declaração de retenção; captura da resposta da action (Network) sem campo de percentis.
- **SC provado:** SC-005.
- **Escreve em prod:** Não — leitura e verificação.

---

## Como saber que este roteiro terminou

- Os onze passos (M1–M11) foram executados e cada evidência listada foi coletada.
- Cada SC-001 a SC-010 tem pelo menos uma evidência de produção associada a um passo (exceto SC-010, provado só no local por decisão do plano).
- Todo atrito encontrado durante a execução foi registrado em `atrito.md`.
- Cada operação executada em produção foi registrada em `diario.md` com o "vai" do CEO correspondente.
