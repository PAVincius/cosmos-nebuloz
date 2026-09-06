/**
 * scripts/seed-empresa-nebuloz.ts
 *
 * Semeia as telas Empresa e Funil do back-office no tenant `system`:
 *   - FornecedorDpa: 18 linhas de docs/compliance/dpa-fornecedores.md
 *   - PerguntaAoParecer: 7 linhas de docs/compliance/aviso-de-gravacao.md §4
 *   - ContaDoPlano: 27 linhas de docs/financeiro/plano-de-contas.md
 *   - EstagioDoFunil: 4 linhas (peso/teto/critérios) do funil v2
 *   - CanalDeLead: 5 linhas (CAC médio nulo) do funil v2
 *   - StaffProcess: 21 linhas do mapa de processos
 *   - StaffProcessEdge: 23 linhas do mapa de processos
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
import {
  CANAIS_NEBULOZ,
  ESTAGIOS_NEBULOZ,
} from "@repo/provisioning/src/funil-nebuloz";
import { PLANO_DE_CONTAS_NEBULOZ } from "@repo/provisioning/src/plano-de-contas-nebuloz";
import {
  LIGACOES_NEBULOZ,
  PROCESSOS_NEBULOZ,
} from "@repo/provisioning/src/processos-nebuloz";
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

  const c = await db.contaDoPlano.createMany({
    skipDuplicates: true,
    data: PLANO_DE_CONTAS_NEBULOZ.map((x) => ({
      tenantId: SYSTEM_TENANT_ID,
      ...x,
    })),
  });
  console.log(
    `  ✓ plano de contas: ${c.count} criadas (${PLANO_DE_CONTAS_NEBULOZ.length - c.count} já existiam)`
  );

  const e = await db.estagioDoFunil.createMany({
    skipDuplicates: true,
    data: ESTAGIOS_NEBULOZ.map((x) => ({
      tenantId: SYSTEM_TENANT_ID,
      ...x,
    })),
  });
  console.log(
    `  ✓ estágios do funil: ${e.count} criados (${ESTAGIOS_NEBULOZ.length - e.count} já existiam)`
  );

  const ca = await db.canalDeLead.createMany({
    skipDuplicates: true,
    data: CANAIS_NEBULOZ.map((x) => ({
      tenantId: SYSTEM_TENANT_ID,
      ...x,
    })),
  });
  console.log(
    `  ✓ canais de lead: ${ca.count} criados (${CANAIS_NEBULOZ.length - ca.count} já existiam)`
  );

  const pr = await db.staffProcess.createMany({
    skipDuplicates: true,
    data: PROCESSOS_NEBULOZ.map(({ revisadoEm, ...x }) => ({
      tenantId: SYSTEM_TENANT_ID,
      ...x,
      revisadoEm: revisadoEm ? new Date(`${revisadoEm}T00:00:00Z`) : null,
    })),
  });
  console.log(
    `  ✓ processos: ${pr.count} criados (${PROCESSOS_NEBULOZ.length - pr.count} já existiam)`
  );

  const processos = await db.staffProcess.findMany({
    where: { tenantId: SYSTEM_TENANT_ID },
    select: { id: true, codigo: true },
  });
  const idPorCodigo = new Map(
    processos.map((processo) => [processo.codigo, processo.id])
  );
  const le = await db.staffProcessEdge.createMany({
    skipDuplicates: true,
    data: LIGACOES_NEBULOZ.map(({ de, para, rotulo }) => {
      const deId = idPorCodigo.get(de);
      const paraId = idPorCodigo.get(para);
      if (!(deId && paraId)) {
        throw new Error(`Ligação ${de} → ${para}: processo não encontrado`);
      }
      return { tenantId: SYSTEM_TENANT_ID, deId, paraId, rotulo };
    }),
  });
  console.log(
    `  ✓ ligações de processos: ${le.count} criadas (${LIGACOES_NEBULOZ.length - le.count} já existiam)`
  );

  await pool.end();
  console.log("\nConcluído.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
