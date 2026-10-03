# Meridian: token do respondente sai da URL (achado 28a do Lacre, ALTO)

Branch `fix/meridian-token-em-cookie`, a partir de github/main. O token (64 hex) ia no caminho `/meridian-responder/<token>` em toda requisição (GET e cada server action) e aparecia em claro nos runtime logs da Vercel.

## O que mudou
- `app/meridian-responder/[token]/route.ts` (novo, GET): valida o token (mesmo lookup, com o teto de 30 consultas por minuto por IP), grava o cookie `meridian_resp` (httpOnly, Secure em produção, SameSite=Lax, path `/meridian-responder`, `Expires` = expiração do token) e redireciona (303) para `/meridian-responder`, sem token. Token inexistente, expirado, revogado, fora de formato ou barrado pelo teto termina no mesmo redirecionamento, sem cookie. `Cache-Control: no-store` e `Referrer-Policy: no-referrer`.
- `app/meridian-responder/page.tsx` (era `[token]/page.tsx`): lê a bateria pelo cookie; o formulário não recebe mais token.
- `getBattery`, `resolveRespondentToken`, `saveDraft`, `submitBattery` e `attachEvidence` perderam o parâmetro `token` e leem o cookie (`lib/meridian/respondent-session.ts`).
- `lib/meridian/respondent-lookup.ts` (novo): o lookup por token e o teto de tentativas saíram do arquivo `"use server"` para um módulo comum, porque o Route Handler precisa deles e um arquivo `"use server"` só exporta server actions (a função, exposta como action, seria um endpoint de sondagem de token).
- Links já emitidos continuam valendo: a primeira carga converte.

## Verificação
- Testes novos em `__tests__/meridian/respondent-session-route.test.ts` (9: URL final sem token, flags do cookie, Secure em produção, no-store, lookup por hash, e os quatro desfechos de token inválido idênticos) e 3 em `respondent.test.ts` (cookie ausente, formato inválido, lookup pelo hash do cookie). `vitest` de meridian, screens, lib e components: 1115 passando; biome limpo; `tsc` sem erro nos arquivos tocados.

## O que NÃO resolve / pendências
- O token ainda aparece **uma vez** no log: o GET da primeira carga (`/meridian-responder/<token>`). Fica fora o resto: refresh, cada GET e cada server action (dezenas por bateria). Para zerar, o link teria de levar o token em fragmento (`#`, que o navegador não envia ao servidor) e uma troca no cliente; muda o formato do link emitido, então ficou fora.
- Tokens que já passaram pelos logs da Vercel seguem válidos até expirar. Reemitir o link em lote (spec 006) invalida os antigos; decisão do dono.
- Um cookie por navegador: abrir o link de outro respondente no mesmo navegador troca a sessão do primeiro.
- Os scripts k6 (`load/k6/meridian-*.js`) e os E2E não foram atualizados nem rodados: o k6 posta as server actions na URL com token e passa a precisar da URL sem token com o cookie da primeira carga. Os E2E que fazem `goto(/meridian-responder/<token>)` seguem o redirecionamento e deveriam funcionar, mas não rodei.
- Esta branch muda `respondent-form.tsx` e `respondent.ts`, os mesmos arquivos de `fix/meridian-enviar-bateria` (e68af4c7) e de `fix/meridian-concorrencia-estado`: conflito esperado na ordem de merge, simples de resolver.
