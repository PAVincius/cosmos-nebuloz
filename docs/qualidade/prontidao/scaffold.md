# Prontidão do Scaffold para cliente externo

**QA da branch `fix/scaffold-p0-sa05-sb01`, segunda rodada, 2026-09-29.** Base testada: `286d08b3` (HEAD, que inclui `0ad3390d`: editor do caso, anexo/download/reabertura, E2E pela tela e F1–F6 do Crivo). Banco local `cosmos_dev` (localhost:5434) e Supabase local (`127.0.0.1:54321`). O worktree tinha edições não commitadas de outra pessoa (tela de métricas do produto); não fazem parte do que aqui se afirma. Metodologia: `docs/qualidade/gate-maturidade-carga.md` e gate de PR (`.maestri/knowledge/compartilhado/gate-de-pr.md`). Rodada anterior: `9a77c26e`.

## Veredito

**Branch: REPROVADA por um bloqueador (anexo de arquivo não funciona no navegador).** O restante da entrega passou: com o bloqueador contornado só no teste, o ciclo inteiro das Fases 1 e 2 passa pela tela. Os seis achados do Crivo (F1–F6) estão corrigidos.

**Prontidão para cliente externo: NÃO APTO.**

- O bloqueador abaixo impede o entregável com arquivo, que é requisito das duas primeiras fases.
- C2 (dogfood sem P0/P1) e C3 (parecer de compliance) continuam em aberto. Não existe `docs/qualidade/dogfood/scaffold/`.
- Não conferi produção, deploy nem merge. Tudo é local.

## 1. Bloqueador (P0)

**A política de segurança de conteúdo (CSP) barra o envio do arquivo ao Storage.** `packages/next-config/index.ts:28`: `connect-src` lista `'self'` e alguns hosts de terceiros, e nenhum host do Supabase. O anexo faz `PUT` do navegador na URL assinada do Storage (`components/scaffold/deliverable-list.tsx:162`), então o navegador recusa antes de a requisição sair.

- Provado no navegador: `securitypolicyviolation` com `connect-src`, `blockedURI=http://127.0.0.1:54321/storage/v1/bucket`; um `PUT` na URL assinada dá "Failed to fetch". O mesmo `PUT` feito do Node (200) e o preflight `OPTIONS` (200, `allow-origin *`) funcionam, então o Storage está sadio.
- Efeito na tela: a versão sobe no banco (`version` incrementa e o evento `ATTACH_VERSION` grava) mas nenhum objeto chega ao bucket (listei o prefixo da trilha: vazio). A lista fica presa em "ocupado" sem mensagem: `deliverable-list.tsx:148-176` não tem `try/catch` em volta do `fetch`, então uma falha de rede nunca chama `setBusy(false)` nem mostra erro. "Enviar para revisão" fica desabilitado e o entregável não sai de Em elaboração.
- Em produção: pelo código o host do Supabase de produção também não está na lista, então o mesmo bloqueio vale. Não conferi os cabeçalhos de produção.
- Dono: quem mantém `packages/next-config` (Plataforma) para o CSP; Andaime para o `try/catch` da tela.
- Não expliquei por que o E2E do Crivo passou para eles; nesta máquina, com o CSP como está, não passa.

## 2. Testes automatizados

| Verificação | Resultado |
|---|---|
| `vitest run __tests__/scaffold __tests__/e2e-setup` (apps/app) | 652 passam, 0 falham |
| `tsc --noEmit` em apps/app | 0 erros |
| `playwright test e2e/scaffold-track-lifecycle` (spec como está) | **falha** no teste 1, `spec:191-193`, duas vezes seguidas; os outros 4 não rodam |
| Cópia descartável do spec (sem a asserção acima e com `bypassCSP: true`) | **5/5 passam** (1,7 min) |

Falha do spec como está: espera "entregáveis obrigatórios pendentes: A1.1" logo após criar a trilha. Em trilha nova a Fase 1 está em andamento e o painel do gate mostra só os critérios; o motivo do botão só aparece com a fase pronta (`gate-panel.tsx`, `decidable` = `GATE_READY`/`BLOCKED`). Provável defeito do spec (Andaime), não do produto: não confirmei a intenção.

A cópia percorre, sem SQL: criar a trilha do catálogo; A1.1/A2.1/A3.1 até Aprovado (arquivo anexo, revisão por quem não produz); caso de negócio escrito, enviado e assinado; passos concluídos; "Revisar e assinar" fecha a Fase 1 e abre a Fase 2; B1–B3 até Aprovado; "Revisar e assinar" fecha a Fase 2. A cópia foi apagada; o `bypassCSP` só contorna o bloqueador do §1 dentro do teste.

## 3. Fluxo real local (navegador)

Trilha TR-908, sessões da consultora (`admin@cosmos.local`) e do patrocinador (`marina.duarte@nebuloz.exemplo`):

| Passo | Resultado |
|---|---|
| Fases 1 e 2 fechadas (pela cópia do E2E) | Assess e Pilot `CLOSED`, Scale `OPEN`, Embed `IDLE` |
| Baixar arquivo de entregável aprovado | Entrada `scaffold.deliverable.read` em `AuditLog` (`A1.1 · evidencia.pdf`), gravada quando a URL é emitida. Não verifiquei a abertura do arquivo na nova aba |
| Reabrir entregável aprovado com a fase fechada | A1.1 vai a Reaberto e **a Fase 1 volta de `CLOSED` para `OPEN`**. A tela mostra "Reaberto por Admin E2E · 29/09/2026" e o comentário |
| Motivo de reabertura curto ("ok") | Botão "Reabrir" fica desabilitado; com uma frase habilita |
| Patrocinador (`SPONSOR`) na trilha | "Nova trilha", "Cancelar trilha", "Adicionar entregável", "Reabrir", "Iniciar" e "Desmarcar passo" ficam desabilitados; o link de papéis não aparece |
| Anexar arquivo pela tela | **não funciona** (§1) |
| Fluxo de anexo do bucket | O bucket `scaffold-artefacts` não existia no Supabase local (só `meridian-evidence`); a criação automática (`ensureScaffoldBucket`) não o criou e não deixou erro visível. `packages/storage/src/index.ts:87` chama `createBucket` sem checar o retorno. Criei o bucket à mão, local, com as mesmas regras (privado, 10 MB, tipos do Scaffold) |

## 4. Correções do Crivo (F1–F6)

| # | Estado | Como confirmei |
|---|---|---|
| F1 comentário do ajuste/reabertura visível a quem produz | Corrigido | O item mostra "Reaberto por Admin E2E · data" e o comentário |
| F2 papel só-leitura vê controles desabilitados, sem derrubar a tela | Corrigido | Marina (patrocinador), controles desabilitados, tela íntegra |
| F3 "Dono do processo" só com papel de dono | Corrigido | Só Paula Oliveira (PROCESS_OWNER) na lista |
| F4 as cinco formas de trabalho | Corrigido | Filtro e seletor com as 5; trilhas novas (TR-904 a TR-908) mostram a forma. TR-901 a TR-903 seguem "sem arquétipo" (criadas antes/seed, sem preenchimento retroativo) |
| F5 papéis só oferecem o que o servidor aceita | Corrigido | Lista da consultora sem Consultor nem Administrador |
| F6 mínimo de uma frase no comentário | Corrigido | "ok" desabilita "Reabrir" |

## 5. Acessibilidade (X-06)

axe embutido, tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`, sessão da consultora, tema escuro: **0 violações** em trilha (Fase 1), diálogo "Adicionar entregável", diálogo "Reabrir", gaveta "Vínculos" e editor do caso de negócio. `color-contrast` ficou "incomplete" em todas (fundo em gradiente, 7 a 10 nós): não verificado, exige conferência manual. Não cobertos: tema claro, teclado e foco.

## 6. Outros achados

| # | Sev. | Achado | Onde | Dono |
|---|---|---|---|---|
| G1 | Média | O A3.2 (caso de negócio) conta como aprovado no gate, mas na lista fica "Não iniciado" (banco: `NOT_STARTED`) e o contador da trilha mostra 8/16, sem ele, com a Fase 1 fechada | `lib/scaffold/deliverable-machine.ts:407`, lista de entregáveis | Andaime |
| G2 | Média | Bucket `scaffold-artefacts` não nasce sozinho e o erro do `createBucket` some sem log | `packages/storage/src/index.ts:87` | Plataforma |
| G3 | Baixa | Ao reabrir um entregável da Fase 1, as fases seguintes (Pilot `CLOSED`, Scale `OPEN`) não se movem. Pode ser intencional; confirmar a regra | `actions/deliverables.ts`, reabertura da fase | Norte (regra) |
| G4 | Baixa | TR-901 (fixture do seed) e trilhas antigas continuam sem forma de trabalho | `scripts/seed-scaffold-e2e.ts` | Andaime |

## 7. O que este QA não fez

- Não anexei arquivo pela tela (bloqueado). O anexo só foi exercitado com o CSP contornado no teste.
- Não abri o arquivo baixado; só conferi a auditoria da emissão.
- Não testei as fases 3 e 4 nem a janela de observação de 30 dias.
- Não conferi produção, cabeçalhos de produção nem o merge.
- Só rodei testes escopados e um spec de Playwright por vez.

## 8. Estado deixado no ambiente local

Bucket `scaffold-artefacts` criado por mim no Supabase local, com objetos dos testes do E2E; trilhas TR-904 a TR-908 no banco (TR-908 com a Fase 1 reaberta); membros e papéis do QA anterior (Marina patrocinadora, Tiago líder do time). Nada disso vai a produção.
