# Scaffold — security maxing: aprovador do gate só se for do tenant com gate.close (ALTO)

Branch `fix/scaffold-sec-approver`, a partir de github/main e67c1069. Origem: nota "Andaime - checklist", achado alto 4.

`closePhase` gravava o `approverId` do payload direto em `ScaffoldGateResult`. Qualquer cuid (de outro tenant, de quem só lê, que não existe) virava "quem assinou" num registro append-only. O override já usava `ctx.userId`; o fechamento normal não respeitava o SG-03 (quem decide vem da sessão).

- Nova `resolveApprover` em `gates.ts`: o id informado vale só se for o próprio ator, ou `ScaffoldMembership` do TENANT DA SESSÃO com `gate.close` (`hasScaffoldPermission`). Senão consta o ator da sessão.
- Quando há troca, a auditoria do fechamento diz (nota "O aprovador informado não é do tenant com permissão de fechar gate; foi registrado o ator da sessão"). O fechamento não é recusado: a tela segue passando o dono da trilha, que é membro com `gate.close`.
- Testes novos em `gates-approver.test.ts` (6): membro com gate.close vale, consulta escopada ao tenant, não membro vira o ator, papéis sem gate.close (SPONSOR, TEAM_MEMBER, TEAM_LEAD, ADMIN) viram o ator, o ator dispensa consulta, auditoria registra a troca. Os testes de gate que fecham fase ganharam o mock de `scaffoldMembership`. `__tests__/scaffold` 1113 verdes; tsc sem erro de Scaffold.
