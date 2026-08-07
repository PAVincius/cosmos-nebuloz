import "server-only";
import Stripe from "stripe";
import { keys } from "./keys";

/**
 * Cliente do Stripe construído na primeira utilização, não no import.
 *
 * Construir cliente de serviço no escopo do módulo faz **importar** o módulo
 * exigir a credencial — e o `next build` importa, ao coletar dados de página.
 * Era por isso que o job Build morria sem nunca ter passado. Ver o porquê
 * completo em packages/analytics/server.ts.
 */
let _stripe: Stripe | null = null;

function _getstripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(keys().STRIPE_SECRET_KEY, {
      apiVersion: "2025-11-17.clover",
    });
  }
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get(_alvo, prop, receptor) {
    const alvoReal = _getstripe();
    const valor = Reflect.get(alvoReal, prop, receptor);
    return typeof valor === "function" ? valor.bind(alvoReal) : valor;
  },
});

export type { Stripe } from "stripe";
