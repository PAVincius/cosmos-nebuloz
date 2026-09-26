/**
 * scripts/seed-diagramas-nebuloz.ts
 *
 * Compila os processos da Nebuloz que têm definição BPMN
 * (packages/provisioning/src/processos-bpmn) e os leva ao mapa de processos do
 * back-office, no tenant `system`:
 *   - StaffDiagram (kind BPMN) criado com a versão 1, ou versão nova só quando
 *     o XML gerado mudou e a última versão foi do próprio seed;
 *   - StaffProcess.diagramId gravado quando o processo ainda não tem diagrama.
 *
 *   pnpm seed:empresa:nebuloz     # antes: garante os processos (PZ-22, PZ-23)
 *   pnpm seed:diagramas:nebuloz
 *
 * SÓ BANCO LOCAL por padrão: recusa DATABASE_URL que não aponte para
 * localhost/127.0.0.1. Escrita em produção precisa do "vai" do dono, por
 * operação; para um banco remoto, com esse aval, rode com
 * SEED_DIAGRAMAS_PERMITIR_REMOTO=1.
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
// Caminho profundo, não o índice do pacote: o índice reexporta `platformDb`,
// que importa "@repo/database" por valor (server-only) — mesmo motivo de
// seed-empresa-nebuloz.ts.
import {
  gerarDiagramasNebuloz,
  sincronizarDiagramasNebuloz,
} from "@repo/provisioning/src/diagramas-nebuloz";
import { Pool } from "pg";
import { PrismaClient } from "../../../packages/database/generated";

const HOSTS_LOCAIS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function exigirBancoLocal(url: string | undefined): string {
  if (!url) {
    throw new Error("DATABASE_URL ausente.");
  }
  const host = new URL(url).hostname;
  if (
    !HOSTS_LOCAIS.has(host) &&
    process.env.SEED_DIAGRAMAS_PERMITIR_REMOTO !== "1"
  ) {
    throw new Error(
      `DATABASE_URL aponta para ${host}, que não é local. Este seed só roda em banco local sem o aval do dono (SEED_DIAGRAMAS_PERMITIR_REMOTO=1).`
    );
  }
  return url;
}

async function main() {
  const url = exigirBancoLocal(process.env.DATABASE_URL);
  const pool = new Pool({ connectionString: url });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    console.log("\n🗺️  Diagramas BPMN → tenant system\n");
    const gerados = await gerarDiagramasNebuloz();
    const resultados = await sincronizarDiagramasNebuloz(db, gerados);
    for (const r of resultados) {
      console.log(
        `  ${r.codigo}: diagrama ${r.diagrama}, processo ${r.vinculo}`
      );
    }
    if (resultados.some((r) => r.vinculo === "processo-inexistente")) {
      console.log(
        "\n  Processo inexistente: rode antes `pnpm seed:empresa:nebuloz`, que cria os processos do mapa."
      );
    }
    console.log("\nConcluído.\n");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
