/**
 * Escolha do transporte de email.
 *
 * Duas saídas possíveis, e a ordem entre elas é a decisão:
 *
 * 1. **Catcher local** (`MAIL_CATCHER_SMTP`) — em dev, o email para numa caixa
 *    local e ninguém de fora recebe nada.
 * 2. **Resend** — produção.
 *
 * **O catcher ganha da credencial quando as duas existem.** Máquina de dev
 * costuma ter as duas, porque alguém copiou um `.env` de algum lugar. Se a
 * credencial vencesse, ligar o catcher não protegeria ninguém — e a pessoa só
 * descobriria pelo email de teste que chegou na caixa de um cliente de verdade.
 *
 * O custo de errar aqui não é cota de provedor: é o domínio da Nebuloz ganhando
 * reputação de spam por causa de endereço digitado em teste.
 */

type Carta = {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
};

export type Transporte = {
  /** Para onde o email vai, em uma frase — aparece no log de arranque. */
  destino: string;
  send: (carta: Carta) => Promise<unknown>;
};

export type ConfigDeTransporte = {
  /** `smtp://host:porta` do catcher local. Vence a credencial quando presente. */
  catcher?: string;
  /** Token do Resend. Só usado quando não há catcher. */
  token?: string;
};

export function escolherTransporte(config: ConfigDeTransporte): Transporte {
  if (config.catcher) {
    return transporteLocal(config.catcher);
  }

  if (config.token) {
    return transporteResend(config.token);
  }

  throw new Error(
    "Nenhum transporte de email configurado. Em desenvolvimento, suba o catcher " +
      "com `pnpm mail:dev` e defina MAIL_CATCHER_SMTP=smtp://localhost:1025. " +
      "Em produção, defina RESEND_TOKEN."
  );
}

/**
 * SMTP local. O `nodemailer` entra por import dinâmico e é devDependency: em
 * produção este ramo nunca roda, e a dependência não precisa existir lá.
 */
function transporteLocal(url: string): Transporte {
  return {
    destino: `catcher local em ${url}`,
    send: async (carta) => {
      const nodemailer = await import("nodemailer");
      const criar =
        nodemailer.createTransport ?? nodemailer.default.createTransport;
      const transporte = criar(url);
      return await transporte.sendMail(carta);
    },
  };
}

function transporteResend(token: string): Transporte {
  return {
    destino: "Resend (envio real)",
    send: async (carta) => {
      const { Resend } = await import("resend");
      const cliente = new Resend(token);
      return await cliente.emails.send(carta as never);
    },
  };
}
