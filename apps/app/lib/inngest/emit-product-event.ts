import { log } from "@repo/observability/log";
import {
  buildProductEvent,
  type ProductEventData,
  type ProductEventKey,
} from "./product-events";
import { sendSafe } from "./send-safe";

/**
 * Emite um evento entre produtos DEPOIS que a action de negócio já confirmou.
 *
 * Nunca lança: o gate que fechou, o baseline que foi assinado e o relatório que
 * foi congelado são fatos consumados, e um Inngest fora do ar não pode fazer a
 * tela dizer que a operação falhou. Se o envio falha, `sendSafe` enfileira em
 * `JobFallbackQueue` para o drain reenviar; se até isso falha, ou se o dado não
 * bate com o contrato, registra e segue. O consumidor é idempotente, então o
 * reenvio posterior é seguro.
 */
export async function emitProductEvent<K extends ProductEventKey>(
  key: K,
  data: ProductEventData<K>
): Promise<void> {
  try {
    const event = buildProductEvent(key, data);
    await sendSafe(event, event.data.tenantId);
  } catch (error) {
    log.error("[emitProductEvent] evento não emitido", {
      key,
      error: String(error),
    });
  }
}
