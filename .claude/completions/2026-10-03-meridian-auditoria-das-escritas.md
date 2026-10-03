# Meridian: escritas que não deixavam AuditLog (achado 29c do Lacre, MÉDIO/BAIXO)

Branch `fix/meridian-auditoria-escritas`, a partir de github/main. Cinco escritas do Meridian não gravavam `AuditLog`. Todas passam a chamar `logMeridianAudit` (ou `logRespondentAudit`, quando o ator é o respondente), na mesma transação da escrita, com diff e sem PII.

| Escrita | Ação | Entidade | Diff |
|---|---|---|---|
| `contributeInTx` (benchmark) | `meridian.benchmark.contribute` | `meridian.benchmark`, id do assessment | Coorte `—` → chave da coorte; Eixos contribuídos `—` → N. Não leva score nem nome |
| `withdrawContribution` | `meridian.benchmark.withdraw` | `meridian.benchmark`, id do assessment | Opt-in de benchmark: Ativo/Inativo → Retirado |
| `unlinkGapDependency` | `meridian.gap.unlink` | `meridian.gapdependency`, id do gap | Dependência `G-01 → G-02` → removida. Só grava se apagou algum vínculo |
| `sendReminder` | `meridian.respondent.remind` | `meridian.respondent`, id do respondente | Último lembrete: anterior (ou `—`) → agora. Alvo = assessment e eixo, sem nome nem e-mail |
| `saveDraft` | `meridian.respondent.draft` (ator respondente) | `meridian.response`, id do respondente | Respostas gravadas `—` → N; no primeiro rascunho, Status INVITED → PENDING. Rascunho que não grava nada não gera linha |

`contributeInTx` ganhou o parâmetro `ctx` (precisa do ator); o único chamador, `runScoringInTx`, já o tinha.

## Verificação
- Testes novos, vermelhos antes: collection (4), gaps (2), benchmark (5), respondent (5); cobrem ação, entidade, diff, ausência de PII, e que recusa ou escrita que não aconteceu não grava trilha. `vitest` de meridian, screens e lib: 1049 passando; biome limpo; `tsc` sem erro nos arquivos tocados (o `tsc` pegou um select aplicado na função errada durante o trabalho, já corrigido).

## Decisões e limites
- `saveDraft` usa `logRespondentAudit`, que grava `actorName` (nome do respondente) em `metadata`, como já fazem as trilhas de enviar e de anexar. É convenção do helper, para a trilha dizer quem agiu. O alvo e o diff não levam nome nem o valor da resposta. Se o Lacre quiser o nome fora de toda trilha de respondente, é decisão do helper inteiro, não só desta linha.
- Em `contributeInTx` a trilha entra na transação do scoring, mas as contribuições em si são escritas pelo cliente global (`database`), fora dela: comportamento que já existia. Se o scoring falhar depois, a contribuição pode ficar sem a linha de trilha. Não mexi.
- `saveDraft` agora gera uma linha por rascunho que gravou algo. O volume é uma por clique em "Salvar" ou "Enviar".
- Esta branch toca `respondent.ts` (`saveDraft`), o mesmo arquivo de `fix/meridian-token-em-cookie` e `fix/meridian-evidencia-mime`: conflito esperado e simples.

## Rebase sobre a main com #359, #360 e #365 (03/10)
Rebaseada sobre `github/main` 2f43d7d0. Só `respondent.test.ts` teve conflito textual (os dois lados acrescentaram testes ao fim do arquivo: mantidos os dois). Conferi o resultado à mão: `saveDraft` fica com a assinatura do #360 (sem `token`, token do cookie) e uma só chamada de `logRespondentAudit`. Resíduos semânticos corrigidos: os testes de auditoria do `saveDraft` ainda passavam `token`. `tsc` do app sem erro fora do `@repo/rbac` velho do checkout principal; vitest de meridian, screens, lib e components: 1171 passando.

