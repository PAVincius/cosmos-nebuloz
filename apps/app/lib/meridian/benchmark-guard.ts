import { type EnablementDb, isBenchmarkEnabled } from "./benchmark-enablement";
import { MeridianRuleError } from "./guards";

/** Recusa no servidor quando o tenant não tem a habilitação de benchmark
 *  ligada (specs/012). Vale para criar com opt-in e para ler coortes: a Nebuloz
 *  é quem liga, e sem isso o tenant nem contribui nem lê. */
export async function requireBenchmarkEnabled(
  db: EnablementDb,
  tenantId: string
): Promise<void> {
  if (!(await isBenchmarkEnabled(db, tenantId))) {
    throw new MeridianRuleError(
      "benchmark.not-enabled",
      "O benchmark não está habilitado para esta organização. A habilitação é feita pela Nebuloz, com o aditivo contratual."
    );
  }
}
