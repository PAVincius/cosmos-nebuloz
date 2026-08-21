# E2E do back-office

```bash
pnpm --filter backoffice test:e2e
```

Sobe `next dev -p 3013` sozinho. Para apontar para um ambiente já de pé, use
`PLAYWRIGHT_BASE_URL`, que também desliga o `webServer`.

## O que roda hoje

`default-deny.spec.ts` — o guard fecha em todas as 18 rotas do grupo `(staff)`,
mais `/seguranca`, mais a garantia de que `/sign-in` não redireciona para si
mesmo. Roda sem sessão nenhuma, que é justamente por que roda.

## O que está parado, e por quê

`charter-provisioning.spec.ts` está com `test.describe.skip`.

Ele veio de `apps/app/e2e/`, onde morava por falta de config própria aqui — e
alcançava a porta 3013 por cima da fronteira dos apps, importando o fixture por
`../../backoffice/e2e/fixtures/staff`. O efeito era o sinal chegar no time
errado: mudança no back-office quebrava a suíte do produto.

Ao trazê-lo ficou claro que nunca pôde passar. `requirePlatformStaff` exige
três coisas:

1. sessão
2. membership no tenant interno (`system`)
3. `twoFactorVerified` na sessão **em curso** — ter 2FA cadastrado não basta

`ensureStaffUser()` entrega só a segunda. Cria a linha no banco e nunca
estabelece sessão no navegador, então o spec redireciona para `/sign-in` e falha
com "não encontrado" num `getByLabel` — que parece bug de seletor e não é.

## Para destravar

Falta um `e2e/setup/staff.setup.ts` que produza sessão com o segundo fator
cumprido e grave o `storageState`.

Não dá para forjar por INSERT: `twoFactorVerified` não é coluna de `Session` —
quem o guarda é o plugin `twoFactor` do better-auth
(`packages/auth/server.ts`). Dois caminhos:

- **Pela UI**: cadastrar um TOTP de segredo conhecido para o usuário de E2E e
  resolver o desafio no login. Não mexe em código de produção.
- **Bypass restrito a ambiente de teste**: mais barato de escrever e mexe em
  código de auth. É decisão de quem cuida de auth, não do E2E.

O `globalSetup` fica fora da config até isso existir. O de `apps/app` não serve:
ele semeia papéis SAFe e personas do Charter assinando em 3012, e nada disso
produz a sessão que este app exige.

## E2E não roda no CI

Nem aqui nem em `apps/app`. Nenhum workflow em `.github/workflows/` referencia
`test:e2e` ou `playwright` — os 30+ specs do produto também nunca rodaram em
pull request. Ligar isso precisa de Postgres efêmero e do seed, como o job
`test` já faz, e é trabalho à parte.
