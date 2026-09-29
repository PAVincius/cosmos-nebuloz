import { BUSINESS_CASE_DELIVERABLE_CODE } from "./deliverable-machine";

/**
 * "X/Y entregáveis" do portfólio: aprovados sobre obrigatórios. Opcional e
 * dispensado (que nasce com `required: false`) não entram, e o A3.2 é o caso de
 * negócio, que conta como aprovado quando está assinado, como no gate.
 */
export function deliverableProgress(
  items: readonly { code: string; status: string; required: boolean }[],
  businessCaseSigned: boolean
): { approved: number; required: number } {
  let approved = 0;
  let required = 0;
  for (const d of items) {
    if (!d.required) {
      continue;
    }
    required += 1;
    const derived =
      d.code === BUSINESS_CASE_DELIVERABLE_CODE && businessCaseSigned;
    if (derived || d.status === "APPROVED") {
      approved += 1;
    }
  }
  return { approved, required };
}
