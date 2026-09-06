/**
 * scripts/seed-empresa-nebuloz.ts
 *
 * Semeia as telas Empresa do back-office no tenant `system`:
 *   - FornecedorDpa: 18 linhas de docs/compliance/dpa-fornecedores.md
 *   - PerguntaAoParecer: 7 linhas de docs/compliance/aviso-de-gravacao.md §4
 *
 *   pnpm seed:empresa:nebuloz
 *
 * CREATE-ONLY: `createMany` com `skipDuplicates`. O seed é evidência de 5 set;
 * o que a tela mudou depois (estado, pedido, assinatura, notas) não pode ser
 * sobrescrito por reexecução. Nunca `deleteMany`.
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
// Caminho profundo para o provisioning, não o índice do pacote: o índice
// reexporta `platformDb`, que importa "@repo/database" por valor — e esse
// módulo tem `import "server-only"` no topo. Fora do Next isso lança
// incondicionalmente (mesmo motivo de seed-charter-nebuloz.ts).
import {
  FORNECEDORES_DPA,
  PERGUNTAS_AO_PARECER,
  VERIFICADO_EM,
} from "@repo/provisioning/src/empresa-nebuloz";
import { Pool } from "pg";
import { PrismaClient } from "../../../packages/database/generated";

const SYSTEM_TENANT_ID = "system";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  const system = await db.tenant.findUnique({
    where: { id: SYSTEM_TENANT_ID },
    select: { id: true },
  });
  if (!system) {
    throw new Error(
      "Tenant system não existe — a migration 20260728020000_system_tenant não rodou."
    );
  }

  console.log("\n🏢  Empresa → tenant system\n");

  const f = await db.fornecedorDpa.createMany({
    skipDuplicates: true,
    data: FORNECEDORES_DPA.map(({ classificacaoProvisoria, ...v }) => ({
      tenantId: SYSTEM_TENANT_ID,
      ...v,
      classificacaoProvisoria: classificacaoProvisoria ?? false,
      verificadoEm: new Date(`${VERIFICADO_EM}T00:00:00Z`),
    })),
  });
  console.log(
    `  ✓ fornecedores: ${f.count} criados (${FORNECEDORES_DPA.length - f.count} já existiam)`
  );

  const p = await db.perguntaAoParecer.createMany({
    skipDuplicates: true,
    data: PERGUNTAS_AO_PARECER.map((q) => ({
      tenantId: SYSTEM_TENANT_ID,
      ...q,
    })),
  });
  console.log(
    `  ✓ perguntas: ${p.count} criadas (${PERGUNTAS_AO_PARECER.length - p.count} já existiam)`
  );

  await pool.end();
  console.log("\nConcluído.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
