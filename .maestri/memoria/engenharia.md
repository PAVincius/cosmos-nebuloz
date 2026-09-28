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
