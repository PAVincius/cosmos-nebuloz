# Plano — condição 7 (M2–M11 em produção) e condição 9 (k6 em infra real)

**Origem:** condições 7 e 9 de `docs/qualidade/prontidao/meridian.md`. **Estado:** proposta, **nada executado**. Cada operação abaixo é um pedido de "vai" ao CEO; sem o "vai" daquela operação, ela não roda. Método geral: `docs/qualidade/esteira-de-prontidao.md` (passos 8 e 10).

---

## Parte A — Condição 7: M2 a M11 em produção

### A.0 Pré-condições (a rodada não começa sem todas)

| # | Pré-condição | Como se confere | Quem confere |
|---|---|---|---|
| P1 | **R3 — o deploy de produção contém os commits que os pareceres citam.** Lista mínima: retenção de 90 dias e eliminação do objeto (`7b035212`, `979240a4`, `06703fd0`, #277); aviso ao respondente com os 90 dias (`23bc6815`, que **só existe no `main` local**: precisa entrar em `github/main` antes); rate limit do token (`1646b50e`, `011c75f7`, `3db7c7b5`); reemissão e revogação de link (spec 006); atritos A1, A2, A4 (#288, `436f6d20`). | Para cada hash: `git fetch github main && git merge-base --is-ancestor <hash> github/main && echo sim`. Depois pegar, na Vercel, o deployment mais recente do `cosmos-nebuloz-app` com alvo production e estado READY, ler o **sha** dele e repetir `git merge-base --is-ancestor <hash> <sha-do-deploy>`. Anotar no diário o `dpl_...`, o sha e o "sim/não" de cada hash | QA (leitura) |
| P2 | **Cond. 2 — Inngest com as chaves do alvo Production.** `GET https://app.nebuloz.ai/api/inngest` responde 200 e as 21 funções aparecem registradas; `eliminateExpiredMeridianEvidence` e `processErasureRequest` entre elas | Infra/SRE confere e informa; QA só lê o que o seu papel enxerga e escreve "não conferi" no resto | Infra/SRE |
| P3 | **Cond. 3 — backup do reset.** Data do `DROP SCHEMA backup_meridian_20260929` (até 2026-10-29) marcada; janela de backup/PITR do Supabase registrada; linha no RoPA; regra de eliminação de titular dentro da janela escrita | parecer de 2026-09-29, C2–C5 | Pilar, Lacre |
| P4 | **Conta e organização certas.** O histórico tem um P1 de organização errada (AS-002 criado no tenant "nebula" em vez do interno). A conta ativa visível (spec 009) tem de mostrar o tenant da Nebuloz antes de cada escrita | captura da barra de conta ativa antes de cada operação | quem opera |
| P5 | **Estado inicial conhecido.** Depois do reset a carteira deve estar vazia ou só com o esperado | sessão `meridian-prod` em leitura (snapshot da carteira) | QA |
| P6 | **Respondente externo de confiança**, com e-mail real, escolhido pelo CEO, com aceite por escrito (dados reais, finalidade, prazo; a Nebuloz é operadora). O e-mail **não** entra no repositório: "respondente externo A" | mensagem de aceite guardada fora do repo; Lacre revisa o texto do convite e o aviso antes | CEO, Lacre |
| P7 | **Quem opera.** O CEO (papel consultor) faz os cliques; agentes ficam na sessão `meridian-prod` em **leitura** (snapshot, screenshot, get) e registram. Clique de agente em produção só com "vai" daquela operação | regra de papel | CEO, QA |

### A.1 Regras da rodada

1. **Um "vai" por operação.** Operações **idênticas e repetidas** (as 10 atribuições, as 9 sessões) entram como **lote com contagem fechada** no texto do "vai" ("10 atribuições, 2 por eixo, copiando cada link"); qualquer coisa fora do lote pede outro "vai".
2. **Antes de cada operação:** conta ativa e tenant corretos (P4), URL `https://app.nebuloz.ai`, deploy READY. Depois de cada operação: o resultado por leitura, antes de pedir a próxima.
3. **Parar no primeiro P0/P1 real.** Registrar FALHOU no diário (sem apagar), avisar a Morgana, **não repetir sem novo "vai"**. Sem SQL de correção: se faltar dado, é a Infra com "vai" próprio.
4. **Sem dado sensível na evidência.** Arquivos anexados são sintéticos; capturas sem e-mail de pessoa real.
5. **E-mail:** o produto não envia convite automático (link copiado e enviado à mão), então nenhum e-mail sai para endereço sintético. O envio do link ao respondente externo é por canal combinado, pelo CEO.

### A.2 Operações, em ordem

Cada linha é um "vai". "Reversível" quer dizer por tela; o que não desfaz, ninguém desfaz sem o reset (que tem "vai" e parecer próprios).

| Op | Passo | Ação exata (quem clica) | Escreve em produção | Reversível? | Evidência | SC |
|---|---|---|---|---|---|---|
| 0 | M1 (refazer) | CEO cria um assessment novo pela carteira: organização Nebuloz, setor Tecnologia, template vigente, prazo em 30 dias, benchmark **sem** opt-in. O reset apagou o AS-112 e o gabarito AS-NBZ-001 | 1 assessment (código gerado) | Não (fica em Rascunho) | captura da carteira e do detalhe, código | SC-001 (início) |
| 1 | M2 | **Lote de 10:** atribuir 2 respondentes por eixo (fundador, auditoria de repositório) nos 5 eixos, copiando cada link (o botão "Concluir" só habilita depois de "Copiar") | 10 respondentes, 10 tokens | Revogável (revoga o respondente, irreversível para o token) | captura da aba Coleta com 5 eixos × 2, os 10 links guardados fora do repo | — |
| 2 | M2 externo | Trocar **um** dos respondentes de um eixo (ex.: Governance) pela pessoa externa de confiança: nome e e-mail reais, link enviado a ela pelo CEO por canal combinado | 1 respondente com dado pessoal real | Só por eliminação a pedido (Op 5) | captura da Coleta, sem e-mail visível na imagem | — |
| 3 | M3 | **Lote de 9 sessões** (todos menos a pessoa externa): abrir o link, reentrar as respostas do gabarito (tabela do `roteiro.md` M3), anexar evidência sintética onde exigida, enviar; cronometrar cada uma | 9 × 3 respostas + evidências no bucket | Não (respostas são append-only) | tempo por sessão, painel de progresso antes e depois | SC-006 |
| 4 | M3 externo | A pessoa externa responde o eixo dela, sem ajuda; QA só observa o progresso da Coleta | 3 respostas de titular real (+ evidência sem informação sensível, se ela quiser) | Só por eliminação a pedido | progresso na Coleta, tempo dela | SC-006 |
| 5 | Eliminação a pedido | A pessoa externa pede a eliminação dos seus dados (pelo canal combinado; o produto hoje não tem canal direto para o titular sem conta, ver `lgpd-ropa-e-lacunas.md`); o CEO aciona a eliminação; conferir que nome e e-mail sumiram e o token foi invalidado, e o arquivo saiu do bucket | dispara `lgpd/erasure.requested` (depende do Inngest, P2) | Não | leitura da Coleta e da auditoria depois; contagem do bucket | direito de eliminação (parecer de compliance) |
| 6 | M4 | CEO fecha a coleta e roda o scoring | status vai a REVIEW e grava scores; **não repetível** (o botão some) | Não | scoring de cada eixo e comparação com a tabela esperada do `packages/database/scripts/2026-09-diagnostico-nebuloz.sql` (o gabarito AS-NBZ-001 foi apagado pelo reset; recriá-lo por SQL não faz parte deste dogfood) | SC-002 (a) |
| 7 | M5 | CEO tenta override com rationale curto (recusa, sem gravar), depois registra um override válido no eixo contestado | 1 override, append-only | Não | captura da dica "faltam N", override com antes → depois | SC-003, SC-004 |
| 8 | M6 | CEO gera o plano de 12 meses; QA confere por leitura a topologia (nenhum gap antes do pré-requisito) e o export | 1 plano (itens por trimestre) | Regenerável pela tela | plano por trimestre, pares gap → pré-requisito → trimestre | SC-007 |
| 9 | M7 | Leitura do relatório (shape, confiança, narrativa) | nada | — | captura do relatório | SC-001 (fim) |
| 10 | M8 | Leitura da trilha de auditoria filtrada por `meridian.` e pedido de URL de evidência (uma leitura, que grava `meridian.evidence.read`) | 1 entrada de auditoria de leitura | Não | checklist de eventos esperados × encontrados | SC-008 |
| 11 | M9 | CEO promove **um** gap ao Scaffold ("Virar caso de negócio" → escolher Scaffold → "Confirmar promoção"); em seguida, na tela do Scaffold, "Criar trilha" a partir da lacuna | 1 promoção + 1 trilha no Scaffold, com a lacuna de origem | Trilha cancelável; a promoção não | captura do gap promovido, da trilha "Semeada da lacuna" e da tentativa de editar a lacuna (sem controle) | SC-009 |
| 12 | Reemissão | CEO reemite o link de **um** respondente ainda pendente (sem ser a pessoa externa) e confere que o link antigo cai em "Link inválido" | gira o token de 1 respondente | Não | captura do diálogo e do link antigo inválido | spec 006 |
| 13 | M11 | Leitura do pool de benchmark e do relatório: coorte com n < 5 retida, sem percentil | nada | — | captura do pool e do relatório | SC-005 |

**M10 (carga de 200 assessments e 2.000 gaps) não roda em produção**, por decisão do plano (risco de sujar dado). Fica com o `e2e/meridian-load` local e com a condição 9.

### A.3 Registro e saída

- Cada operação vira uma linha no `diario.md` (quando, passo, "vai" com quem e hora, quem operou, resultado, evidência), FALHOU incluído. As pré-condições P1 (o `dpl_...`, o sha e o "sim/não" de cada hash) entram como linha própria no início da rodada.
- Capturas em `docs/qualidade/dogfood/meridian/evidencias/<data>/prod/`, sem dado pessoal real.
- Atritos novos em `atrito.md`, com severidade e dono.
- **A condição 7 fecha** quando as Ops 0 a 13 estão OK em produção com evidência e nenhum P0/P1 ficou aberto; o parecer `prontidao/meridian.md` é reescrito com C2 em produção.
- **Depois da rodada**, decidir com o CEO se os dados ficam (tenant interno) ou se roda um novo reset (com "vai" e parecer próprios). A linha do RoPA do backup do reset cobre o que foi apagado, não o que esta rodada criar.

---

## Parte B — Condição 9: k6 contra infraestrutura real, com dados sintéticos

### B.0 O que é e o que não é

Medir o **mesmo código de produção** (mesmo sha do deploy) em infraestrutura **igual à de produção, mas de teste**: um deployment de preview da Vercel, com banco e Storage próprios de teste. Não é carga em produção: o script recusa `*.nebuloz.ai` e o alias `<projeto>.vercel.app` dos quatro projetos, e não há variável que libere.

Não mede: o tamanho real dos dados de produção, a rede dos clientes, o comportamento com tráfego misturado. Serve para trocar "26 ms no meu computador" por "p95 no preview com banco e Storage remotos".

### B.1 Alvo, dados e limites

| Item | Definição |
|---|---|
| Alvo | Preview do `cosmos-nebuloz-app` no **mesmo sha** do deploy de produção (R3), URL `https://<preview>.vercel.app` |
| Gate 0 (cancela tudo se falhar) | O Preview usa **banco e Storage de teste, com host diferente do de produção**. Infra confere pelos nomes e hosts das variáveis do alvo Preview (sem ler segredo). Se o Preview compartilha o banco de produção, **não roda** |
| Proteção de deploy | Preview está atrás da Deployment Protection: o segredo de bypass fica no cofre, é exportado no shell de quem roda o k6 (o k6 lê o ambiente) e chega ao script como `K6_BYPASS_TOKEN`; nunca no repositório, nunca em log, nunca na linha de comando |
| Dados | Só sintéticos: 1 assessment "Carga k6 (sintética)" com 50 respondentes de e-mail `k6-N@carga.exemplo`, eixo DATA, tokens com validade curta (24 h). Criados por Infra no banco de **teste** com o preparo de carga, que hoje só aceita `localhost` e precisa de uma variante com lista exata de host permitido e recusa do host de produção (**a implementar**, Bussola, com teste) |
| Fluxo | `apps/app/load/k6/meridian-responder.js`: abre o link e grava respostas pela server action |
| Teto (imposto pela lib para alvo remoto) | pico de **20 VUs**, **5 minutos**, rampa em três degraus; aborta sozinho se o erro passar de 5 % depois de 30 s |
| Metas | p95 < 800 ms e erro < 1 % (as mesmas do local) |
| Volume esperado | cerca de 8 iterações por segundo no pico, uns 5.000 requisições no total |
| Janela | fora do horário comercial, combinada com o CEO; Infra acompanha logs de runtime da Vercel, conexões e CPU do banco de teste, e o Storage |
| Parada | Ctrl-C do k6; Infra pode pausar o preview; qualquer 5xx em rajada encerra a rodada |

### B.2 Operações (cada uma pede "vai")

| Op | O que | Quem | Escreve em | Por que precisa de "vai" |
|---|---|---|---|---|
| B1 | Provisionar banco e bucket de teste e as variáveis do alvo Preview | Infra/SRE | Supabase, Vercel (fora de produção) | cria recurso e custo; nome não pode coincidir com recurso de produção |
| B2 | Gerar o deployment de preview no sha do deploy de produção | Infra | Vercel (preview) | consome build e cria URL pública protegida |
| B3 | Migrar e semear o banco de teste (mesmas migrations) e rodar o preparo de carga | Infra | banco de teste | escrita em banco remoto, mesmo sendo de teste; confere o host antes |
| B4 | Fumaça: `k6 run --vus 1 --iterations 1` no preview (todos os checks verdes, respostas no banco de teste) | QA | banco de teste | primeira requisição real ao alvo remoto |
| B5 | Rampa completa (até 20 VUs, 5 min) | QA | banco de teste | é a carga |
| B6 | Desmontar: apagar dados de carga, bucket e o preview (ou marcar prazo) | Infra | Vercel, Supabase | remove recurso |

Comando da B5 (as três variáveis de alvo são obrigatórias; o segredo de bypass já está exportado no shell, vindo do cofre):

```bash
cd apps/app
k6 run \
  -e BASE_URL=https://<preview>.vercel.app \
  -e K6_ALLOW_REMOTE=https://<preview>.vercel.app \
  -e K6_APPROVAL=vai-<AAAA-MM-DD>-ceo \
  -e SUMMARY_FILE=/tmp/k6-meridian-preview.json \
  load/k6/meridian-responder.js
```

### B.3 Registro e saída

- No `diario.md`, uma seção "Carga em infraestrutura de teste" com: sha, URL do preview, host do banco de teste (nome, não segredo), requisições, erro, p50, p95 e o veredito das metas.
- No `prontidao/meridian.md` §3, uma linha nova na tabela ("Preview com banco e Storage de teste") e a frase "não é produção".
- A condição 9 fecha quando a B5 mede dentro das metas ou quando as falhas viram itens com causa e dono.

### B.4 Decisões que só o CEO toma

1. **Quem é a pessoa externa de confiança** (Parte A, P6) e se topa a eliminação a pedido como parte do teste.
2. **Se o Preview pode ter banco e Storage próprios** (B1) e quem executa (Infra).
3. **Janela** da rodada em produção (Parte A) e da carga (Parte B).
4. **O que fazer com os dados** depois da rodada em produção (manter no tenant interno ou novo reset).
