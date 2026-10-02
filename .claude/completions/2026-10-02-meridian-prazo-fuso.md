# Meridian: prazo do assessment com um dia a menos (atrito A1)

Branch `fix/meridian-prazo-fuso`, a partir de github/main. Dogfood de produção (QA, 02/10): prazo digitado 01/11/2026 aparecia como 31/10/2026.

## Causa
O `<input type="date">` entrega "2026-11-01". `createAssessment` usava `z.coerce.date()`, que grava essa string como meia-noite UTC (`2026-11-01T00:00:00Z`), isto é, 21h de 31/10 em Brasília. A tela formatava com `toLocaleDateString` no fuso do navegador e mostrava 31/10.

## O mesmo bug no token do respondente: sim, e pior
`assignRespondent` e a reemissão fixam `tokenExpiresAt = min(agora + 14d, deadline)`. Com o deadline em meia-noite UTC, o link do respondente morria às 21h de Brasília do dia ANTERIOR ao prazo digitado, e a bateria mostrava "prazo" um dia a menos. Um prazo de hoje era recusado (meia-noite UTC de hoje já passou).

## Correção
- `lib/meridian/prazo.ts`: `prazoDoDia("AAAA-MM-DD")` = último instante do dia em Brasília (UTC-3 fixo, sem horário de verão desde 2019); `prazoDeEntrada` aplica isso só a data de calendário (ISO com hora e Date seguem como antes); `formatarPrazo` e `FUSO_BRASILIA` fixam a exibição em Brasília, qualquer que seja o fuso do navegador.
- `createAssessment`: o prazo vira fim do dia em Brasília; hoje passa a ser aceito (vence no fim dele), ontem é recusado.
- Exibição em Brasília: lista de assessments, detalhe do assessment e prazo na bateria do respondente.

## Verificação
- Vermelho antes: gravava `2099-11-01T00:00:00.000Z`, recusava o dia de hoje, e a bateria mostrava 02/11 num navegador em UTC.
- `vitest` de `__tests__/meridian`, `__tests__/lib` e `__tests__/screens`: 1031 passando; biome limpo; `tsc` sem erro nos arquivos tocados.

## NÃO feito: dados já gravados
Assessments criados antes desta correção têm `deadline` em meia-noite UTC e continuam um dia antes na tela (agora exibidos em Brasília), e os tokens já emitidos mantêm essa expiração. Corrigir é escrita em produção e pede o "vai" do CEO, por operação. Sugestão de conferência antes de qualquer UPDATE: `SELECT id, code, deadline FROM "MeridianAssessment" WHERE deadline::time = '00:00:00'` (UTC); o ajuste seria somar 26h59min59,999s (para ir de 00:00Z ao fim do dia de Brasília, 02:59:59.999Z do dia seguinte) e refazer `tokenExpiresAt` dos respondentes ainda não concluídos. Não rodei nenhuma consulta nem UPDATE.
