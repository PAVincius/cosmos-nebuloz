"use server";

import { database, type Prisma, withTenantDb } from "@repo/database";
import {
  deriveVendorMaxClass,
  logPlatformAudit,
  platformDb,
} from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  type AcaoDpa,
  acoesDisponiveis,
  aplicarAcao,
  type Contadores,
  contadores,
  type EstadoDpa,
} from "@/lib/empresa/fornecedores";
import {
  assertCanWrite,
  requirePlatformStaff,
  StaffAuthError,
  SYSTEM_TENANT_ID,
} from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Fornecedores e DPA — o estado real do acordo de tratamento de dados com os
 * 18 fornecedores do Charter interno (docs/compliance/dpa-fornecedores.md).
 *
 * Tudo no tenant system, menos `exportarAoCharter`: ela escreve no
 * `CharterVendor` do tenant nebuloz, por `withTenantDb`, e é a única escrita
 * fora de casa deste diretório (ADR-0013).
 */

const ROTA_FORNECEDORES = "/empresa/fornecedores";

/** Slug do tenant que carrega o Charter interno (seed:charter:nebuloz). */
const TENANT_CHARTER_NEBULOZ = "nebuloz";

export type FornecedorDpaRow = {
  codigo: string;
  nome: string;
  estado: EstadoDpa;
  classificacaoProvisoria: boolean;
  regiao: string | null;
  retencao: string | null;
  transferencia: string | null;
  dpaUrl: string | null;
  subprocessadoresUrl: string | null;
  evidenciaUrl: string | null;
  verificadoEm: string;
  acaoPendente: string | null;
  donoPapel: string | null;
  bloqueiaVenda: boolean;
  pedidoEm: string | null;
  assinadoEm: string | null;
  exportadoAoCharterEm: string | null;
  notas: string | null;
  acoes: AcaoDpa[];
};

const SELECT = {
  codigo: true,
  nome: true,
  estado: true,
  classificacaoProvisoria: true,
  regiao: true,
  retencao: true,
  transferencia: true,
  dpaUrl: true,
  subprocessadoresUrl: true,
  evidenciaUrl: true,
  verificadoEm: true,
  acaoPendente: true,
  donoPapel: true,
  bloqueiaVenda: true,
  pedidoEm: true,
  assinadoEm: true,
  exportadoAoCharterEm: true,
  notas: true,
} as const;

type Linha = Prisma.FornecedorDpaGetPayload<{ select: typeof SELECT }>;

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

function paraRow(l: Linha): FornecedorDpaRow {
  return {
    ...l,
    verificadoEm: l.verificadoEm.toISOString(),
    pedidoEm: iso(l.pedidoEm),
    assinadoEm: iso(l.assinadoEm),
    exportadoAoCharterEm: iso(l.exportadoAoCharterEm),
    acoes: acoesDisponiveis(l.estado),
  };
}

function chave(codigo: string) {
  return { tenantId_codigo: { tenantId: SYSTEM_TENANT_ID, codigo } };
}

async function buscar(codigo: string): Promise<Linha> {
  const l = await database.fornecedorDpa.findUnique({
    where: chave(codigo),
    select: SELECT,
  });
  if (!l) {
    throw new StaffAuthError(
      "FORBIDDEN",
      `Fornecedor ${codigo} não existe no inventário.`
    );
  }
  return l;
}

export async function listarFornecedoresDpa(): Promise<
  Result<{ linhas: FornecedorDpaRow[]; contadores: Contadores }>
> {
  return await safeAction(async () => {
    await requirePlatformStaff();
    const linhas = await database.fornecedorDpa.findMany({
      where: { tenantId: SYSTEM_TENANT_ID },
      orderBy: { codigo: "asc" },
      select: SELECT,
    });
    return { linhas: linhas.map(paraRow), contadores: contadores(linhas) };
  });
}

const AcaoSchema = z.object({
  codigo: z.string().min(1),
  acao: z.enum(["MARCAR_ACEITO", "REGISTRAR_PEDIDO"]),
  evidenciaUrl: z.url().optional(),
});

export async function aplicarAcaoDpa(
  input: z.infer<typeof AcaoSchema>
): Promise<Result<FornecedorDpaRow>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { codigo, acao, evidenciaUrl } = AcaoSchema.parse(input);

    const atual = await buscar(codigo);
    const r = aplicarAcao(atual, acao, new Date(), evidenciaUrl);
    if (!r.ok) {
      throw new StaffAuthError("FORBIDDEN", r.erro);
    }

    const depois = await database.fornecedorDpa.update({
      where: chave(codigo),
      data: r.patch,
      select: SELECT,
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: `empresa.dpa.${acao.toLowerCase()}`,
      entityType: "FornecedorDpa",
      entityId: codigo,
      target: `${codigo} · ${atual.nome}`,
      diff:
        atual.estado === depois.estado
          ? []
          : [["estado", atual.estado, depois.estado]],
    });
    revalidatePath(ROTA_FORNECEDORES);
    return paraRow(depois);
  });
}

const PatchSchema = z.object({
  codigo: z.string().min(1),
  notas: z.string().nullable().optional(),
  acaoPendente: z.string().nullable().optional(),
  donoPapel: z.string().nullable().optional(),
  bloqueiaVenda: z.boolean().optional(),
  regiao: z.string().nullable().optional(),
  retencao: z.string().nullable().optional(),
  verificadoEm: z.iso.datetime().optional(),
});

export async function atualizarFornecedorDpa(
  input: z.infer<typeof PatchSchema>
): Promise<Result<FornecedorDpaRow>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { codigo, verificadoEm, ...campos } = PatchSchema.parse(input);
    const atual = await buscar(codigo);

    // Só o que veio no input entra no update: `undefined` não é "apagar".
    const data = Object.fromEntries(
      Object.entries({
        ...campos,
        verificadoEm: verificadoEm ? new Date(verificadoEm) : undefined,
      }).filter(([, v]) => v !== undefined)
    );

    const depois = await database.fornecedorDpa.update({
      where: chave(codigo),
      data,
      select: SELECT,
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "empresa.dpa.atualizar",
      entityType: "FornecedorDpa",
      entityId: codigo,
      target: `${codigo} · ${atual.nome}`,
      diff: Object.keys(data).map((k): [string, string, string] => [
        k,
        String((atual as Record<string, unknown>)[k] ?? ""),
        String((depois as Record<string, unknown>)[k] ?? ""),
      ]),
    });
    revalidatePath(ROTA_FORNECEDORES);
    return paraRow(depois);
  });
}

const ExportSchema = z.object({ codigos: z.array(z.string().min(1)).min(1) });

const UM_ANO_MS = 365 * 86_400_000;

/**
 * A única escrita fora do tenant system (spec §4.1).
 *
 * Muda quatro colunas do CharterVendor e recomputa `maxClass`, que é cache
 * derivado de `dpa` (ADR-0003). `notes`, `tier`, `score`, `subprocessors`
 * ficam como estão: são do produto e de quem opera o Charter.
 */
export async function exportarAoCharter(
  input: z.infer<typeof ExportSchema>
): Promise<Result<{ exportados: string[]; semCorrespondente: string[] }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { codigos } = ExportSchema.parse(input);

    const nebuloz = await platformDb.tenant.findUnique({
      where: { slug: TENANT_CHARTER_NEBULOZ },
      select: { id: true, slug: true },
    });
    if (!nebuloz) {
      throw new StaffAuthError(
        "FORBIDDEN",
        `O tenant "${TENANT_CHARTER_NEBULOZ}" não existe — o Charter interno não foi semeado.`
      );
    }

    const exportados: string[] = [];
    const semCorrespondente: string[] = [];
    const agora = new Date();

    for (const codigo of codigos) {
      const f = await buscar(codigo);
      const dpa = f.estado === "EMBUTIDO" || f.estado === "ASSINADO";
      const renewalAt = f.assinadoEm
        ? new Date(f.assinadoEm.getTime() + UM_ANO_MS)
        : null;

      const escreveu = await withTenantDb(nebuloz.id, async (tx) => {
        const vendor = await tx.charterVendor.findUnique({
          where: { tenantId_code: { tenantId: nebuloz.id, code: codigo } },
          include: {
            clauses: { include: { clause: { select: { code: true } } } },
          },
        });
        if (!vendor) {
          return false;
        }
        const { maxClass } = deriveVendorMaxClass({
          tier: vendor.tier,
          dpa,
          clauseCodes: vendor.clauses.map((c) => c.clause.code),
        });
        const region = f.regiao ?? vendor.region;
        const retention = f.retencao ?? vendor.retention;
        const data = {
          dpa,
          region,
          retention,
          renewalAt,
          maxClass,
        };
        await tx.charterVendor.update({ where: { id: vendor.id }, data });
        await logPlatformAudit(tx, {
          tenantId: nebuloz.id,
          actorUserId: staff.userId,
          actorName: staff.name,
          action: "charter.vendor.dpa_exportado",
          entityType: "CharterVendor",
          entityId: vendor.id,
          target: `${nebuloz.slug} · ${codigo}`,
          note: "Exportado da tela Fornecedores e DPA do back-office.",
          diff: [
            ["dpa", String(vendor.dpa), String(dpa)],
            ["region", vendor.region ?? "", region ?? ""],
            ["retention", vendor.retention ?? "", retention ?? ""],
            ["maxClass", vendor.maxClass ?? "", maxClass ?? ""],
          ],
        });
        return true;
      });

      if (!escreveu) {
        semCorrespondente.push(codigo);
        continue;
      }
      await database.fornecedorDpa.update({
        where: chave(codigo),
        data: { exportadoAoCharterEm: agora },
      });
      exportados.push(codigo);
    }

    if (exportados.length > 0) {
      await logPlatformAudit(database, {
        tenantId: SYSTEM_TENANT_ID,
        actorUserId: staff.userId,
        actorName: staff.name,
        action: "empresa.dpa.exportar_charter",
        entityType: "FornecedorDpa",
        entityId: exportados.join(","),
        target: `${exportados.length} fornecedor(es) → ${nebuloz.slug}`,
      });
    }
    revalidatePath(ROTA_FORNECEDORES);
    return { exportados, semCorrespondente };
  });
}
