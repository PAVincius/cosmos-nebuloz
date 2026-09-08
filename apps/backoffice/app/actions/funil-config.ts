"use server";

import { database } from "@repo/database";
import { logPlatformAudit } from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  type ConfigEstagio,
  ESTAGIOS,
  type Estagio,
} from "@/lib/comercial/funil";
import {
  assertCanWrite,
  requirePlatformStaff,
  StaffAuthError,
  SYSTEM_TENANT_ID,
} from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Configuração do funil v2: peso e teto por estágio, e CAC médio por canal.
 *
 * `EstagioDoFunil` é a única fonte de peso e teto — mudar a fórmula sem
 * registro é número que ninguém aceita (design, backoffice-funnel-stage.jsx).
 * Por isso `atualizarEstagio` é append-only em `MudancaDeEstagio`: uma linha
 * por campo alterado, nunca um update silencioso.
 */

const ROTA_FUNIL = "/funil";

export type MudancaRow = {
  id: string;
  campo: string;
  de: string;
  para: string;
  motivo: string;
  autorNome: string | null;
  criadoEm: string;
};

const CodigoSchema = z.object({ codigo: z.enum(ESTAGIOS) });

export async function lerEstagio(
  input: z.input<typeof CodigoSchema>
): Promise<Result<{ config: ConfigEstagio; mudancas: MudancaRow[] }>> {
  return await safeAction(async () => {
    await requirePlatformStaff();
    const { codigo } = CodigoSchema.parse(input);

    const [estagio, mudancas] = await Promise.all([
      database.estagioDoFunil.findFirst({
        where: { tenantId: SYSTEM_TENANT_ID, codigo },
        select: {
          codigo: true,
          pesoPercent: true,
          tetoDias: true,
          criterios: true,
        },
      }),
      database.mudancaDeEstagio.findMany({
        where: { tenantId: SYSTEM_TENANT_ID, codigo },
        orderBy: { criadoEm: "desc" },
        select: {
          id: true,
          campo: true,
          de: true,
          para: true,
          motivo: true,
          autorNome: true,
          criadoEm: true,
        },
      }),
    ]);

    if (!estagio) {
      throw new StaffAuthError("FORBIDDEN", "Estágio não configurado.");
    }

    return {
      config: {
        codigo: estagio.codigo as Estagio,
        pesoPercent: estagio.pesoPercent,
        tetoDias: estagio.tetoDias,
        criterios: estagio.criterios,
      },
      mudancas: mudancas.map((m) => ({
        ...m,
        criadoEm: m.criadoEm.toISOString(),
      })),
    };
  });
}

function formatPeso(v: number): string {
  return `${v}%`;
}
function formatTeto(v: number): string {
  return `${v} d`;
}
function formatCriterios(v: string[]): string {
  return `${v.length} itens`;
}

function mesmaLista(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

const AtualizarEstagioSchema = z.object({
  codigo: z.enum(ESTAGIOS),
  pesoPercent: z.number().int().min(0).max(100).optional(),
  tetoDias: z.number().int().min(1).optional(),
  criterios: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  motivo: z
    .string()
    .trim()
    .min(
      20,
      "Conte por que a fórmula está mudando — peso e teto sem registro é número que ninguém aceita."
    )
    .max(1000),
});

export async function atualizarEstagio(
  input: z.input<typeof AtualizarEstagioSchema>
): Promise<Result<{ codigo: Estagio }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const dados = AtualizarEstagioSchema.parse(input);

    const atual = await database.estagioDoFunil.findFirst({
      where: { tenantId: SYSTEM_TENANT_ID, codigo: dados.codigo },
      select: { id: true, pesoPercent: true, tetoDias: true, criterios: true },
    });
    if (!atual) {
      throw new StaffAuthError("FORBIDDEN", "Estágio não configurado.");
    }

    const update: Record<string, unknown> = {};
    const mudancas: { campo: string; de: string; para: string }[] = [];

    if (
      dados.pesoPercent !== undefined &&
      dados.pesoPercent !== atual.pesoPercent
    ) {
      update.pesoPercent = dados.pesoPercent;
      mudancas.push({
        campo: "PESO",
        de: formatPeso(atual.pesoPercent),
        para: formatPeso(dados.pesoPercent),
      });
    }
    if (dados.tetoDias !== undefined && dados.tetoDias !== atual.tetoDias) {
      update.tetoDias = dados.tetoDias;
      mudancas.push({
        campo: "TETO",
        de: formatTeto(atual.tetoDias),
        para: formatTeto(dados.tetoDias),
      });
    }
    if (
      dados.criterios !== undefined &&
      !mesmaLista(dados.criterios, atual.criterios)
    ) {
      update.criterios = dados.criterios;
      mudancas.push({
        campo: "CRITERIOS",
        de: formatCriterios(atual.criterios),
        para: formatCriterios(dados.criterios),
      });
    }

    if (mudancas.length === 0) {
      throw new StaffAuthError("FORBIDDEN", "Nada mudou.");
    }

    await database.$transaction(async (tx) => {
      // `updateMany` (não `update`) porque o `where` precisa carregar o
      // estado lido — duas edições concorrentes do mesmo estágio não podem
      // as duas passar: sem isto, a segunda sobrescreve a primeira e ainda
      // duplica a linha de `MudancaDeEstagio`. `criterios` é `String[]` no
      // Prisma — comparar exige `equals`, não `===`.
      const atualizado = await tx.estagioDoFunil.updateMany({
        where: {
          id: atual.id,
          pesoPercent: atual.pesoPercent,
          tetoDias: atual.tetoDias,
          criterios: { equals: atual.criterios },
        },
        data: update,
      });
      if (atualizado.count === 0) {
        throw new StaffAuthError(
          "FORBIDDEN",
          "Estágio mudou de configuração; recarregue e tente de novo"
        );
      }
      for (const m of mudancas) {
        await tx.mudancaDeEstagio.create({
          data: {
            tenantId: SYSTEM_TENANT_ID,
            codigo: dados.codigo,
            campo: m.campo,
            de: m.de,
            para: m.para,
            motivo: dados.motivo,
            autorId: staff.userId,
            autorNome: staff.name,
          },
        });
      }
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "updated",
      entityType: "EstagioDoFunil",
      entityId: dados.codigo,
      target: dados.codigo,
      diff: mudancas.map(
        (m) => [m.campo, m.de, m.para] as [string, string, string]
      ),
    });

    revalidatePath(ROTA_FUNIL);
    return { codigo: dados.codigo };
  });
}

const AtualizarCanalSchema = z.object({
  slug: z.string().min(1),
  cacMedioCentavos: z.number().int().min(0).nullable(),
});

export async function atualizarCanal(
  input: z.input<typeof AtualizarCanalSchema>
): Promise<Result<{ slug: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const dados = AtualizarCanalSchema.parse(input);

    const canal = await database.canalDeLead.findFirst({
      where: { tenantId: SYSTEM_TENANT_ID, slug: dados.slug },
      select: { id: true, cacMedioCentavos: true },
    });
    if (!canal) {
      throw new StaffAuthError("FORBIDDEN", "Canal não encontrado.");
    }

    // `updateMany` (não `update`) porque o `where` precisa carregar o estado
    // lido — mesma proteção de corrida das demais actions deste módulo.
    const atualizado = await database.canalDeLead.updateMany({
      where: { id: canal.id, cacMedioCentavos: canal.cacMedioCentavos },
      data: { cacMedioCentavos: dados.cacMedioCentavos },
    });
    if (atualizado.count === 0) {
      throw new StaffAuthError(
        "FORBIDDEN",
        "Canal mudou de configuração; recarregue e tente de novo"
      );
    }

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "updated",
      entityType: "CanalDeLead",
      entityId: canal.id,
      target: dados.slug,
      diff: [
        [
          "cacMedioCentavos",
          String(canal.cacMedioCentavos ?? "—"),
          String(dados.cacMedioCentavos ?? "—"),
        ],
      ],
    });

    revalidatePath(ROTA_FUNIL);
    return { slug: dados.slug };
  });
}
