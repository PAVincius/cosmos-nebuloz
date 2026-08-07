import { StripeAgentToolkit } from "@stripe/agent-toolkit/ai-sdk";
import { keys } from "./keys";

/**
 * Toolkit de agente do Stripe construído na primeira utilização, não no import.
 *
 * Construir cliente de serviço no escopo do módulo faz **importar** o módulo
 * exigir a credencial — e o `next build` importa, ao coletar dados de página.
 * Era por isso que o job Build morria sem nunca ter passado. Ver o porquê
 * completo em packages/analytics/server.ts.
 */
let _paymentsAgentToolkit: StripeAgentToolkit | null = null;

function _getpaymentsAgentToolkit(): StripeAgentToolkit {
  if (!_paymentsAgentToolkit) {
    _paymentsAgentToolkit = new StripeAgentToolkit({
      secretKey: keys().STRIPE_SECRET_KEY,
      configuration: {
        actions: {
          paymentLinks: {
            create: true,
          },
          products: {
            create: true,
          },
          prices: {
            create: true,
          },
        },
      },
    });
  }
  return _paymentsAgentToolkit;
}

export const paymentsAgentToolkit = new Proxy({} as StripeAgentToolkit, {
  get(_alvo, prop, receptor) {
    const alvoReal = _getpaymentsAgentToolkit();
    const valor = Reflect.get(alvoReal, prop, receptor);
    return typeof valor === "function" ? valor.bind(alvoReal) : valor;
  },
});
