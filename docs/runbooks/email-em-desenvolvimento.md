# Email em desenvolvimento

Enquanto se desenvolve, email não sai para a internet. Ele para numa caixa local.

## Subir

```bash
pnpm mail:dev
```

Mailpit sobe em dois lugares: **SMTP em `localhost:1025`** (para onde a
aplicação manda) e **interface em http://localhost:8025** (onde você lê).

No seu `.env`:

```
MAIL_CATCHER_SMTP="smtp://localhost:1025"
```

Só isso. Não precisa de `RESEND_TOKEN` em desenvolvimento.

Para derrubar: `pnpm mail:stop`.

## O que muda no código

Nada nos pontos de envio. Os quatro lugares que mandam email continuam
chamando `resend.emails.send(...)`; o desvio mora no proxy de
`packages/email/index.ts`.

Isso é deliberado: espalhar um `if (dev)` por quatro arquivos garantiria que o
quinto nasceria sem ele — e o quinto é justamente o que mandaria email de
verdade da máquina de alguém.

## A regra que importa

**Com `MAIL_CATCHER_SMTP` definido, o catcher vence o `RESEND_TOKEN`, mesmo que
os dois existam.**

Máquina de desenvolvimento costuma ter as duas variáveis, porque alguém copiou
um `.env` de algum lugar. Se a credencial vencesse, ligar o catcher não
protegeria ninguém — e a pessoa só descobriria pelo email de teste que chegou na
caixa de um cliente de verdade.

O risco que isso remove não é a cota do provedor. É o domínio da Nebuloz
colecionando reputação de spam por causa de endereço digitado em teste.

Quando o catcher está ligado, o cliente do Resend **não é construído**: nenhuma
credencial é lida e nenhuma conexão sai da máquina. Há teste fixando isso em
`packages/email/__tests__/transporte.test.ts`.

## Sem nenhum dos dois

A aplicação recusa e diz as duas saídas:

```
Nenhum transporte de email configurado. Em desenvolvimento, suba o catcher
com `pnpm mail:dev` e defina MAIL_CATCHER_SMTP=smtp://localhost:1025.
Em produção, defina RESEND_TOKEN.
```

`RESEND_TOKEN` deixou de ser obrigatório no schema de env de propósito. A
exigência não sumiu — mudou de lugar, para onde a mensagem pode dizer o que
fazer. "Invalid environment variables" não diz.

## O que este runbook não cobre

O Mailpit não valida entrega, SPF, DKIM nem reputação. Ele prova que a
aplicação **montou e despachou** a mensagem certa. Se a mensagem chega numa
caixa real, com que aparência e se cai em spam, só o provedor de produção
responde.

Também não há volume no container: mensagem de desenvolvimento não sobrevive ao
reinício, e isso é escolha. Guardar histórico criaria um arquivo com endereço de
gente de verdade dentro, na máquina de todo mundo.
