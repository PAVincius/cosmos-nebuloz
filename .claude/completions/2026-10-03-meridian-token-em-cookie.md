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

---

# 2ª parte: o token sai também da primeira requisição (link com fragmento)

A 1ª parte (cookie + redirect) ainda deixava o token no caminho da PRIMEIRA requisição (`GET /meridian-responder/<token>`), que a Vercel loga. Agora o link novo leva o token no fragmento, que o navegador nunca envia ao servidor.

## Como funciona
- Link novo: `https://app.nebuloz.ai/meridian-responder#t=<token>` (`lib/meridian/respondent-link.ts`: `respondentLink`, `tokenFromHash`, `isTokenShape`). A geração e a reemissão (as três telas de `tab-coleta.tsx`: atribuir, reemitir um, reemitir em lote) passam a emitir só esse formato.
- `app/meridian-responder/page.tsx` renderiza `RespondentSessionGate`. O servidor só vê o cookie; quem chega pelo link novo não tem cookie na primeira requisição, e a página mostra "Abrindo seu link…" (não pisca "link inválido").
- `RespondentSessionGate` (cliente) lê `location.hash`, **tira o hash do endereço com `history.replaceState` antes de qualquer chamada**, e manda o token à server action `startRespondentSession(token)`: POST com o token no CORPO, na URL `/meridian-responder`. A action valida (mesma consulta e mesmo teto de 30 consultas por minuto por IP; erro único para inexistente, expirado, revogado e fora de formato) e grava o cookie httpOnly. Com a sessão gravada, recarrega a página. Recusa mostra o texto de link inválido (ou o do teto de tentativas).
- Com cookie de outro respondente e link novo, a troca acontece em vez de mostrar a sessão antiga.
- Compatibilidade: links antigos `/meridian-responder/<token>` continuam funcionando pelo Route Handler (`[token]/route.ts`) até 16/10/2026, quando expiram; o arquivo tem o aviso de remoção. Esse caminho ainda deixa o token na URL daquela requisição, por isso nenhum link novo o usa.
- As mensagens de erro do respondente foram para `lib/meridian/respondent-messages.ts` (sem `node:crypto`), reexportadas de `respondent-token.ts`, para o componente do cliente poder traduzi-las.

## Testes
- Novos: `respondent-link.test.ts` (formato novo; o que o navegador envia, caminho e query, não contém o token; leitura estrita do hash), `respondent-session-gate.test.tsx` (10: token vai à action e recarrega; o endereço perde o hash antes da chamada e nenhuma URL do navegador contém o token; "abrindo" sem piscar inválido; recusa, teto e rejeição; troca de sessão; sem hash), 5 em `respondent.test.ts` para `startRespondentSession` (cookie com httpOnly/SameSite/path/expiração do token, lookup por hash, mesmo erro para todo token que não vale, formato, teto).
- "Reemitir gera o formato novo": os testes de `meridian-tab-coleta.test.tsx` (atribuir, reemitir um e em lote) passaram a exigir `#t=`.
- `vitest` de meridian, screens, lib e components: 1143 passando; biome limpo; `tsc` sem erro nos arquivos tocados.

## Não verificado
- Fluxo em navegador real (fragmento, server action, cookie, recarga): sem banco local (Docker parado), só em teste de componente com a action e o recarregamento mockados.
- E2E (`e2e/meridian-*.spec.ts`) atualizados para o formato novo (extração do token por `#t=`, `goto` com `#t=`) e k6 ajustado (POST em `/meridian-responder`, sem token nos argumentos), mas **nenhum rodou**.
- Links antigos já impressos ou enviados continuam deixando o token na URL da primeira requisição até 16/10; o token também já está nos logs anteriores.

