"use server";

import { database } from "@repo/database";
import { logPlatformAudit } from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertContaAtiva, contasDoPlano } from "@/lib/empresa/consultas";
import { competenciaValida } from "@/lib/empresa/financeiro";
import { agregarPorMes } from "@/lib/empresa/livro";
import {
  competenciasNoIntervalo,
  IntervaloSchema,
} from "@/lib/empresa/periodo";
import type { CentroDeCusto, Grupo } from "@/lib/empresa/plano-de-contas";
import { contaValida } from "@/lib/empresa/plano-de-contas";
import {
  assertCanWrite,
  requirePlatformStaff,
  SYSTEM_TENANT_ID,
  semTeto,
} from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Orçado × realizado (spec 2026-09-06 §3–§4): orçado por conta e competência
 * (OrcamentoDaConta); realizado é a soma dos lançamentos do livro-razão, para
 * não haver dois números para a mesma pergunta — nunca uma cópia gravada do
 * realizado.
 */

const ROTA = "/empresa/financeiro";

export type OrcadoPorCompetencia = {
  orcado: number | null;
  realizado: number | null;
  desvio: number | null;
};

export type OrcadoContaView = {
  conta: string;
  nome: string;
  grupo: Grupo;
  centroDeCusto: CentroDeCusto | null;
  porCompetencia: Record<string, OrcadoPorCompetencia>;
};

export type OrcadoView = {
  competencias: string[];
  contas: OrcadoContaView[];
};

export async function lerOrcado(
  input: z.input<typeof IntervaloSchema>
): Promise<Result<OrcadoView>> {
  return await safeAction(async () => {
    await requirePlatformStaff();
    const { de, ate } = IntervaloSchema.parse(input);
    const comps = semTeto(() => competenciasNoIntervalo({ de, ate }));

    const [orcamentos, linhas, contas] = await Promise.all([
      database.orcamentoDaConta.findMany({
        where: { tenantId: SYSTEM_TENANT_ID, competencia: { in: comps } },
        select: { competencia: true, conta: true, valorCentavos: true },
      }),
      database.lancamento.findMany({
        where: { tenantId: SYSTEM_TENANT_ID, competencia: { in: comps } },
        select: { competencia: true, conta: true, valorCentavos: true },
      }),
      contasDoPlano(),
    ]);

    const orcadoPorChave = new Map<string, number>();
    for (const o of orcamentos) {
      orcadoPorChave.set(`${o.competencia}:${o.conta}`, o.valorCentavos);
    }
    const realizadoPorMes = agregarPorMes(linhas);

    const contasView: OrcadoContaView[] = contas.map((c) => {
      const porCompetencia: Record<string, OrcadoPorCompetencia> = {};
      for (const competencia of comps) {
        const orcado = orcadoPorChave.get(`${competencia}:${c.conta}`) ?? null;
        const realizado = realizadoPorMes[competencia]?.[c.conta] ?? null;
        porCompetencia[competencia] = {
          orcado,
          realizado,
          desvio:
            orcado !== null && realizado !== null ? realizado - orcado : null,
        };
      }
      return {
        conta: c.conta,
        nome: c.nome,
        grupo: c.grupo,
        centroDeCusto: c.centroDeCusto,
        porCompetencia,
      };
    });

    return { competencias: comps, contas: contasView };
  });
}

const SalvarOrcamentoSchema = z.object({
  competencia: z
    .string()
    .refine(competenciaValida, "Competência no formato AAAA-MM."),
  conta: z.string().refine(contaValida, "Conta fora do plano de contas."),
  // Orçado é magnitude, como o valor de caixa (lib/empresa/financeiro.ts): não
  // aceita sinal. Nulo apaga a linha — é o "sem orçamento" da leitura.
  valorCentavos: z
    .number()
    .int()
    .nonnegative("Orçado não aceita valor negativo.")
    .nullable(),
});

export async function salvarOrcamento(
  input: z.infer<typeof SalvarOrcamentoSchema>
): Promise<Result<{ competencia: string; conta: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const dados = SalvarOrcamentoSchema.parse(input);
    await assertContaAtiva(dados.conta);

    if (dados.valorCentavos === null) {
      await database.orcamentoDaConta.deleteMany({
        where: {
          tenantId: SYSTEM_TENANT_ID,
          competencia: dados.competencia,
          conta: dados.conta,
        },
      });
    } else {
      await database.orcamentoDaConta.upsert({
        where: {
          tenantId_competencia_conta: {
            tenantId: SYSTEM_TENANT_ID,
            competencia: dados.competencia,
            conta: dados.conta,
          },
        },
        create: {
          tenantId: SYSTEM_TENANT_ID,
          competencia: dados.competencia,
          conta: dados.conta,
          valorCentavos: dados.valorCentavos,
        },
        update: { valorCentavos: dados.valorCentavos },
      });
    }

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "empresa.financeiro.orcamento.salvar",
      entityType: "OrcamentoDaConta",
      entityId: `${dados.competencia}:${dados.conta}`,
      target: `conta ${dados.conta} · ${dados.competencia}`,
      diff: [["valorCentavos", "", String(dados.valorCentavos)]],
    });
    revalidatePath(ROTA);
    return { competencia: dados.competencia, conta: dados.conta };
  });
}
