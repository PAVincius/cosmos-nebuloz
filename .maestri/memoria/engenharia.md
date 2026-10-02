# Memória da área: engenharia

Quem escreve: devs, QA (Crivo), Infra (Pilar), Security Reviewer (Vigia). Quem cura: Morgana.
Uma linha por lição: `AAAA-MM-DD — lição — origem (arquivo, PR, quem corrigiu)`.
Só o que vale para a área inteira; o que só vale para um agente fica na memória dele. Nunca segredo, chave ou dado de cliente.
Lição que se mostrou errada: risque com ~~ ~~ e diga por quê, em vez de apagar.

## Lições
2026-09-27 — estado de produção se confere no lugar, não se deduz: 3 registros em 10 h (runbook com nome de recurso de produção, merge afirmado sem ver o deploy, passo de produção rodado no ambiente local) — .maestri/aprendizado.jsonl, apontado pelo Vigilante
2026-09-27 — rodar .maestri/setup-canvas.sh reinicia todos os agentes e eles perdem o contexto: não rodar com tarefa em andamento; se precisar, redisparar todos em seguida — Morgana, setup da memória (merge 476eaa94)
2026-09-27 — vários agentes commitando no mesmo working tree colidem: lock do git, lint-staged cria stash de backup e um agente pode acabar com arquivos alheios no stage; commitar sempre com 'git add <arquivos próprios>' + 'git diff --cached --name-only' antes do commit — Lacre (134a653b), stash bec86c16
2026-09-28 — teste de cookie confere o Set-Cookie inteiro, não só o nome: cookie `__Secure-` apagado sem `Secure` é descartado pelo navegador e o teste que olhava só o nome passava — Alicerce (370cc35b → 1061d522, PR #275)
2026-09-28 — todo export de arquivo "use server" é endpoint público: controle (rate limit, permissão) tem de estar na função comum que todas as exports usam, não em algumas — Bussola (9468abd9 → 94d06741, PR #276)
2026-09-28 — rate limit contra adivinhação: conferir o teto ANTES da consulta e contar só a falha; contar tudo barra usuário legítimo atrás do mesmo IP, e conferir só depois da falha não freia nada — Bussola (94d06741 → 39473c43, PR #276)
2026-09-28 — dependência nova no package.json exige commitar o pnpm-lock.yaml e provar com `pnpm install --frozen-lockfile`; `tsc` "limpo" rodado sem node_modules não prova nada — Bussola (39473c43 → a1c7e704, PR #276)
2026-09-28 — nome de arquivo pode ser dado pessoal: não vai para auditLog (imutável por trigger, ADR-0009), use o id; eliminação LGPD anonimiza objeto E metadado — Bussola (7b035212 → 0232ce34, PR #277), Lacre (docs/compliance/2026-09-28-parecer-retencao-evidencia-meridian-pr277.md)
2026-09-28 — código no ar não é job rodando: o Inngest nunca teve conta nem chave em produção e 21 funções (DSAR incluído) não rodavam desde jul/26; depois de deploy com job, conferir o endpoint do provedor e o log do sync, não só o build — Morgana, docs/runbooks/inngest-producao.md (197ce54f)
2026-09-28 — a main local diverge da do GitHub: PR se monta em worktree a partir de `github/main` com cherry-pick dos commits aprovados (e das dependências deles), e se prova com install --frozen-lockfile + tsc + testes no worktree — Morgana (PRs #275, #276, #277)
2026-09-29 — `git stash` é do repositório, não do worktree: um `stash pop` num worktree aplica o backup do lint-staged de outro terminal. Em worktree, não usar stash; guardar trabalho com commit ou branch — Bussola (incidente ~22:2x, sem dano final)
2026-09-29 — teste com data fixa vira bomba-relógio: `deadline 2026-09-30` deixou a main vermelha à meia-noite UTC e travaria o push de todos. Datas de teste relativas a agora (ou relógio falso) — Crivo (f71a7a1e, PR #314)
2026-09-29 — o hook roda os testes SEM SKIP_ENV_VALIDATION (o turbo não repassa); rodar `env -u SKIP_ENV_VALIDATION npx vitest run` antes do push — Bussola (#312)
2026-09-29 — trocar o Inngest por cron perde a memoização entre tentativas: numa eliminação em passos, apagar o conteúdo antes de anonimizar a linha que serve de chave, senão o retry não acha o titular e fecha COMPLETED — Vigia sobre Alicerce (1cbac7dc → f063409e, PR #310)
2026-09-29 — o projeto da Vercel do app tem Root Directory apps/app: vale apps/app/vercel.json; o vercel.json da raiz não é lido e os crons dele nunca rodaram — Alicerce (#310)
2026-09-30 — PR mergeado antes do push de correção: follow-up empurrado num branch já mergeado não chega à main (#310 mergeado sem o audit aguardado; saiu no #319). Conferir o estado do PR antes do push; mergeado = branch novo + PR novo — Morgana
2026-09-30 — checagem obrigatória com filtro de caminho trava PR: o E2E Back-office é required e não roda em PR sem mudança no back-office, então o PR fica BLOCKED para sempre (só merge de admin) — Morgana, #329
2026-09-30 — catraca de tamanho quebra a main inteira quando um merge faz um arquivo da baseline crescer 1 linha: todo PR herda o Lint & Format vermelho. Registrar com `pnpm size:guard --update` no mesmo PR que cresce o arquivo — Morgana (#317/#323 → #329)
2026-09-30 — disco da máquina: cada worktree com dependências custa ~3 GB e o cache do uv chegou a 161 GB; disco cheio derruba a VM do Docker e o Postgres local responde I/O error sem estar corrompido. Um worktree com deps por agente, remover os mergeados, `uv cache prune` com agentes ligados é seguro — Morgana
2026-09-30 — fila de push serializada (um turbo test por vez) acabou com os timeouts de carga; dois hooks ao mesmo tempo derrubam testes de 5 s — Morgana
