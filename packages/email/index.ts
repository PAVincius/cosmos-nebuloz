import { render } from "@react-email/components";
import { Resend } from "resend";
import { keys } from "./keys";
import { InviteTemplate } from "./templates/invite";

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

export const resend = new Proxy({} as Resend, {
  get(_alvo, prop, receptor) {
    const alvoReal = _getresend();
    const valor = Reflect.get(alvoReal, prop, receptor);
    return typeof valor === "function" ? valor.bind(alvoReal) : valor;
  },
});

export { ContactTemplate } from "./templates/contact";
export { InviteTemplate } from "./templates/invite";

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
