# Cadastro de 2FA por aplicativo autenticador — design

**Data**: 2026-08-13 · **Status**: aprovado, pronto para plano de implementação

## Problema

O fluxo de cadastro de 2FA **existe** — e está preso no lugar errado, entregando
o segredo para um terceiro.

Ele vive inteiro dentro de `apps/app/app/onboarding/components/onboarding-wizard.tsx`:
`handleEnable2FA` (linha 74), `handleVerify2FA` (linha 94), extração de chave
manual, estado de erro e carregamento. É alcançável **apenas** durante o
onboarding, uma única vez na vida da conta, e tem um botão "Pular por agora"
(linha 281) que leva direto ao fim.

Disso saem três problemas independentes.

### 1. O segredo do 2FA vai para um servidor de terceiro

```jsx
// onboarding-wizard.tsx:295
<img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(totpUri)}`} />
```

O `totpUri` é o `otpauth://` completo — **inclui a chave base32 compartilhada**,
que é o segredo inteiro do segundo fator. Ele é enviado para `api.qrserver.com`
em **query string**: registrado no log de acesso daquele servidor, visível a
qualquer proxy no caminho, e retido no histórico do navegador.

Quem tem essa string gera os mesmos códigos que o celular da pessoa. O segundo
fator deixa de ser um segundo fator.

> **CONSEQUÊNCIA PARA QUEM JÁ CADASTROU**
> Todo segredo cadastrado por este caminho já trafegou para fora. Corrigir o
> código não desfaz isso — quem cadastrou 2FA pelo onboarding precisa
> re-cadastrar depois do fix, e a decisão de forçar isso é de vocês.

Efeito colateral menor, mas real: o cadastro de 2FA depende de um serviço
gratuito de terceiro estar no ar.

### 2. Quem não passou pelo onboarding não tem como cadastrar

O back-office exige segundo fator ([B-06](../../produto/backoffice-prd.md),
verificado em `apps/backoffice/lib/guard.ts`). Um staff criado por SQL — que é
como os staff atuais nasceram — nunca viu o wizard. Ele é recusado com "habilite
2FA no seu perfil e entre de novo", vai ao perfil, e não encontra nada lá: o
perfil tem `profile-form` e `notification-preferences-form`, mais nada.

Quem pulou o onboarding está no mesmo lugar, sem caminho de volta.

> **O BECO**
> O guard bloqueia todo o grupo `(staff)` para quem não tem 2FA. Uma tela de
> cadastro dentro desse grupo seria inalcançável exatamente para quem precisa
> dela. A rota tem de nascer fora do guard.

### 3. O tratamento de erro do wizard não distingue causas

`handleEnable2FA` devolve "Erro ao ativar 2FA. Verifique sua senha." para
qualquer falha — senha errada, rede caída ou conta travada leem igual.

E `handleVerify2FA` (linha 94) chama `verifyTotp` dentro de `try/catch` **sem
checar o resultado**. O cliente do better-auth devolve `{ error }` em vez de
lançar — é assim que `apps/backoffice/app/sign-in/form.tsx:73` trata, checando
`result?.error` explicitamente. Se o comportamento for o mesmo aqui, um código
errado não lança, não é capturado, e o wizard avança para `done` como se tivesse
verificado. **Isto é caso de teste antes de ser correção**: confirmar o
comportamento real do retorno antes de mudar a lógica.

## Objetivo

Uma pessoa cadastra o autenticador sozinha, quando precisar, em qualquer um dos
dois apps — sem SQL, sem depender do onboarding, e sem o segredo sair do
navegador.

### Não-objetivos

- **Não é 2FA por e-mail nem por SMS.** O plugin suporta OTP por e-mail; fora.
- **Não regenera backup codes.** `disable` + `enable` cobre o caso raro.
- **Não mexe em `otpOptions`.** Seis dígitos continua seis: mudar invalidaria
  todo autenticador já cadastrado.
- **Não força re-cadastro de quem já tem 2FA.** É decisão de operação, não de
  código — a spec só registra que o caso existe.

## Decisões

| DECISÃO | ESCOLHA | POR QUÊ |
|---|---|---|
| Origem do código | **Extrair** do wizard, não escrever do zero | O fluxo existe e funciona; uma terceira cópia é o problema, não a solução |
| QR | SVG renderizado no cliente | Fecha o vazamento do §1. O segredo já está no cliente — desenhar lá não piora nada, mandar para fora piora tudo |
| Onde mora a tela | Perfil do app **e** rota própria no painel | O staff é recusado no painel; mandá-lo a outro app para se desbloquear é o beco de novo |
| Rota do painel | Fora do grupo `(staff)` | Guard sem a asserção de segundo fator, senão é inalcançável |
| Compartilhamento | Hook em `@repo/auth`, UI por app | A corretude mora no fluxo, não no markup — e o repo já tentou UI compartilhada: existe `packages/auth/components/sign-in.tsx` e o painel escreveu o próprio mesmo assim |
| `trustDevice` | Checkbox no login, desmarcado por padrão | Hoje o painel omite o campo e herda `true` — 30 dias, sem ninguém ter decidido |
| Máquina de estado | Reducer, não XState | Quatro estados lineares, sem concorrência |

## Arquitetura

```
              ┌──────────────────────────────┐
              │  requirePlatformStaff         │  sessão · teto · membership · 2FA
              └───────────┬──────────────────┘
                          │  bloqueia quem não tem 2FA
                          ▼
                    grupo (staff)  ─── 16 rotas do painel
                          ╳
              ┌──────────────────────────────┐
              │  /seguranca   (FORA do grupo) │
              │  requirePlatformStaff…        │
              │  …SemSegundoFator()           │  sessão · teto · membership
              └───────────┬──────────────────┘
                          ▼
        ┌─────────────────────────────────────────┐
        │  useTwoFactorEnrollment  (@repo/auth)    │  o fluxo, os erros, a ordem
        └──┬──────────────┬─────────────────┬─────┘
           ▼              ▼                 ▼
     UI do painel   UI do perfil     wizard de onboarding
   (Campo/Botao)   (shadcn/Tailwind)  (consumidor #3, deixa de
           │              │            ter lógica própria)
           └──────┬───────┴─────────────────┘
                  ▼
        <CodigoOtp length={6} />      ← @repo/design-system/cosmos
        <QrCode value={totpURI} />    ← react-qr-code, NUNCA rede
```
*FIGURA 1 — UM FLUXO, TRÊS PELES. O WIZARD VIRA CONSUMIDOR.*

| PEÇA | O QUE MUDA |
|---|---|
| `packages/auth/two-factor-enrollment.ts` | **Novo.** Máquina, chamadas, tradução de erro. Sem JSX |
| `packages/design-system/cosmos/qr-code.tsx` | **Novo.** `<QrCode value>` sobre `react-qr-code` |
| `packages/design-system/cosmos/codigo-otp.tsx` | **Novo.** Campo de N slots, atrás de interface própria |
| `apps/backoffice/app/seguranca/` | **Novo.** Rota fora do `(staff)` |
| `apps/backoffice/lib/guard.ts` | Ganha `requirePlatformStaffSemSegundoFator()` |
| `apps/app/(authenticated)/profile/components/security-form.tsx` | **Novo.** Card no perfil |
| `apps/app/onboarding/components/onboarding-wizard.tsx` | **Perde** as duas funções e o `<img>` externo; passa a consumir o hook |
| `apps/backoffice/app/sign-in/form.tsx` | Ganha o checkbox de dispositivo confiável |
| `packages/auth/server.ts` | Nada. O plugin já está certo |

`@repo/design-system/cosmos` é o subpath que **as duas apps já importam**
(`icons`, `kit`). A dependência de QR é declarada uma vez.

## O fluxo

```
ocioso ──iniciar──▶ senha ──enable(senha)──▶ escaneando ──verifyTotp(código)──▶ códigos
                      │                          │                                  │
                      └──────── cancelar ────────┴──────────────────────────────────┘
```
*FIGURA 2 — QUATRO PASSOS. O TERCEIRO É O QUE LIGA A FLAG.*

`enable()` devolve `totpURI` **e** `backupCodes` de uma vez, no passo `senha`.
Os códigos só aparecem na tela depois do `verifyTotp`.

> **POR QUE SEGURAR OS CÓDIGOS**
> Entregar código de recuperação para um 2FA que ainda não foi ativado produz um
> papel que a pessoa guarda achando que vale — e não vale, porque a flag nunca
> virou.

`skipVerificationOnEnable` fica no padrão (`false`): `twoFactorEnabled` só vira
`true` depois de um código válido. É a proteção contra o lockout que o `UPDATE`
manual causa — a flag nunca liga sem autenticador comprovadamente funcionando.

O `verifyTotp` **do cadastro** passa `trustDevice: false` fixo. Confiar no
dispositivo como efeito colateral de cadastrar é surpresa; a escolha pertence à
tela de login.

A chave manual continua existindo — `extractTotpSecret` já está escrito no
wizard e migra para o hook.

## Erros

| O QUE ACONTECEU | O QUE A PESSOA LÊ |
|---|---|
| Senha errada no `enable` | "Senha incorreta." |
| Código errado no `verifyTotp` | "Código inválido. Confira o aplicativo autenticador." — a mesma frase do sign-in, de propósito |
| Conta travada pelo `accountLockout` | Frase própria, com o tempo de espera |
| Rede ou desconhecido | Mensagem genérica + Sentry |

O ramo do lockout não é zelo: o padrão do plugin é 10 tentativas em 15 minutos,
e sem ele a tela repete "código inválido" para quem já não consegue acertar por
outro motivo — o sintoma vira "o 2FA está quebrado".

## O campo de código

`<CodigoOtp value onChange length={6} invalido />` é uma fronteira, não um
desenho. A UI chama sem saber como é pintado por dentro.

Há um componente de design a portar (OTP Verification V3). Duas adaptações
obrigatórias, já acordadas:

- **Seis slots, não quatro.** `otpOptions: { digits: 6 }` manda.
- **Sem preenchimento por mensagem.** O original é um fluxo de SMS: bolha
  `MESSAGE · OTP`, botão "Fill", `autocomplete="one-time-code"` e número de
  telefone no subtítulo. O autofill de `one-time-code` no iOS e no Android lê
  **SMS**; não lê aplicativo autenticador. Slots, anel e animação transferem; a
  narrativa em volta vira "abra seu aplicativo autenticador".

Enquanto o fonte não chega, o campo nasce com seis slots simples que satisfazem
a mesma interface.

## Teste

| CAMADA | O QUE PROVA |
|---|---|
| Hook (vitest) | Cada transição, ordem das chamadas, códigos não aparecendo antes do verify, os quatro ramos de erro |
| Guard (vitest) | **`/seguranca` acessível para staff sem 2FA, e todo o resto do `(staff)` não** |
| Regressão (vitest) | **Nenhum `<img>` com `src` remoto em caminho de 2FA** — o vazamento do §1 não volta por descuido |
| Componentes | As três telas, no padrão de `confirmar-acao.test.tsx` |
| E2E (Playwright) | Entrar → cadastrar → sair → entrar com TOTP. Exige `otplib` no teste para computar código válido a partir do segredo |

Dois casos que precisam ser **verificados antes de corrigidos**:

1. **O retorno de `verifyTotp`.** Lança ou devolve `{ error }`? Do resultado
   depende se o wizard hoje aceita código errado (§3). Escrever o teste primeiro,
   ver falhar, então corrigir.
2. **Cadastro abandonado.** Rodar `enable()` e sair deixa linha em `TwoFactor`
   com segredo e flag `false`. Recomeçar tem de gerar segredo novo e invalidar o
   anterior — senão o QR velho, que a pessoa pode ter escaneado, confirma um
   segredo que ela acha que descartou.

## Critérios de aceite

- **Nenhum segredo de 2FA atravessa a rede para terceiro.** O QR é desenhado no cliente.
- Um staff sem 2FA entra em `/seguranca` pelo link da própria mensagem de recusa.
- Esse mesmo staff é recusado em qualquer outra rota do painel.
- Cadastrar exige senha, mostra QR, e só liga a flag após código válido.
- Um código errado **não** avança o wizard.
- Backup codes aparecem uma vez, depois da confirmação, nunca antes.
- Dez códigos errados produzem a mensagem de conta travada, não "código inválido".
- Cadastrar não marca o dispositivo como confiável.
- O checkbox de confiar no dispositivo nasce desmarcado no painel.
- O wizard de onboarding não tem mais lógica de 2FA própria.

## Riscos

| RISCO | MITIGAÇÃO |
|---|---|
| Segredos já vazados continuam válidos | Registrado aqui; forçar re-cadastro é decisão de operação |
| O `<img>` externo volta em outra tela | Teste de regressão que varre caminho de 2FA |
| Alguém "conserta" 2FA por `UPDATE` de novo | A tela existe e a mensagem de recusa aponta para ela |
| Rota de cadastro migra para dentro do `(staff)` | Teste de guard que falha nesse dia |
| Extrair o hook quebra o onboarding | O wizard é consumidor no mesmo PR, com teste |
| Componente de OTP chega e não encaixa | Fronteira `<CodigoOtp>` definida antes, não depois |
| Perder o celular vira chamado | `disable({ password })` entra no v1 |

## Dependências

| DEPENDE DE | NATUREZA |
|---|---|
| `better-auth ^1.6.26` | Plugin `twoFactor`, já configurado. **Nota**: 1.7 muda a assinatura de `enableTwoFactor` (passa a exigir `method`) |
| `react-qr-code` | Nova, em `@repo/design-system` |
| `otplib` | Nova, **só em devDependencies** — computa TOTP no E2E |
| Componente OTP Verification V3 | Fonte ainda não recebido; não bloqueia o resto |

**Oportunidade adjacente, fora deste escopo:** com o QR externo removido, o
`img-src 'self' data: blob: https:` do `packages/next-config/index.ts` pode
apertar. Não faz parte deste trabalho.

---

*Design aprovado. Próximo passo: plano de implementação.*
