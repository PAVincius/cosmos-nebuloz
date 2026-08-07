import { Knock } from "@knocklabs/node";
import { keys } from "./keys";

const key = keys().KNOCK_SECRET_API_KEY;

/**
 * Cliente do Knock construído na primeira utilização, não no import.
 *
 * Construir cliente de serviço no escopo do módulo faz **importar** o módulo
 * exigir a credencial — e o `next build` importa, ao coletar dados de página.
 * Era por isso que o job Build morria sem nunca ter passado. Ver o porquê
 * completo em packages/analytics/server.ts.
 */
let _notifications: Knock | null = null;

function _getnotifications(): Knock {
  if (!_notifications) {
    _notifications = new Knock({ apiKey: key });
  }
  return _notifications;
}

export const notifications = new Proxy({} as Knock, {
  get(_alvo, prop, receptor) {
    const alvoReal = _getnotifications();
    const valor = Reflect.get(alvoReal, prop, receptor);
    return typeof valor === "function" ? valor.bind(alvoReal) : valor;
  },
});
