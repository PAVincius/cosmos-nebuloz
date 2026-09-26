import { render } from "@react-email/components";
import { Resend } from "resend";
import { keys } from "./keys";
import { InviteTemplate } from "./templates/invite";
import { ResetPasswordTemplate } from "./templates/reset-password";

/**
 * Cliente do Resend construído na primeira utilização, não no import.
 *
 * Construir cliente de serviço no escopo do módulo faz **importar** o módulo
 * exigir a credencial — e o `next build` importa, ao coletar dados de página.
 * Era por isso que o job Build morria sem nunca ter passado. Ver o porquê
 * completo em packages/analytics/server.ts.
 */
let _resend: Resend | null = null;

function _getresend(): Resend {
  if (!_resend) {
    _resend = new Resend(keys().RESEND_TOKEN);
  }
  return _resend;
}

/**
 * Ponto único onde o email escolhe o caminho.
 *
 * Os quatro pontos de envio do repositório chamam `resend.emails.send(...)`, e
 * continuam chamando: o desvio para o catcher local mora aqui, não neles.
 * Espalhar um `if (dev)` por quatro arquivos garantiria que o quinto nasceria
 * sem ele — e o quinto é o que manda email de verdade da máquina de alguém.
 *
 * Quando `MAIL_CATCHER_SMTP` está definido, `emails.send` vai para o SMTP
 * local e o cliente do Resend nunca é construído. Ver `transporte.ts` para a
 * ordem de precedência e o porquê.
 */
function _emailsComCatcher(catcher: string) {
  return {
    send: async (carta: {
      from: string;
      to: string | string[];
      subject: string;
      html: string;
    }) => {
      const { escolherTransporte } = await import("./transporte");
      return await escolherTransporte({ catcher }).send(carta);
    },
  };
}

export const resend = new Proxy({} as Resend, {
  get(_alvo, prop, receptor) {
    const catcher = process.env.MAIL_CATCHER_SMTP;
    if (catcher && prop === "emails") {
      return _emailsComCatcher(catcher);
    }

    const alvoReal = _getresend();
    const valor = Reflect.get(alvoReal, prop, receptor);
    return typeof valor === "function" ? valor.bind(alvoReal) : valor;
  },
});

export { keys } from "./keys";
export { ContactTemplate } from "./templates/contact";
export { InviteTemplate } from "./templates/invite";
export { ResetPasswordTemplate } from "./templates/reset-password";

type RenderInviteOptions = {
  inviteeName?: string;
  inviterName?: string;
  workspaceName: string;
  acceptUrl: string;
  expiresInDays?: number;
};

export async function renderInviteEmail(
  options: RenderInviteOptions
): Promise<string> {
  return render(
    InviteTemplate({
      inviteeName: options.inviteeName,
      inviterName: options.inviterName,
      workspaceName: options.workspaceName,
      acceptUrl: options.acceptUrl,
      expiresInDays: options.expiresInDays ?? 7,
    })
  );
}

type RenderResetPasswordOptions = {
  resetUrl: string;
  userName?: string;
  expiresInMinutes?: number;
};

export async function renderResetPasswordEmail(
  options: RenderResetPasswordOptions
): Promise<string> {
  return render(
    ResetPasswordTemplate({
      resetUrl: options.resetUrl,
      userName: options.userName,
      expiresInMinutes: options.expiresInMinutes ?? 60,
    })
  );
}
