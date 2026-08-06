"use server";

import { database } from "@repo/database";
import { logPlatformAudit } from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  assertCanWrite,
  requirePlatformStaff,
  StaffAuthError,
  SYSTEM_TENANT_ID,
} from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";
import { slugificar } from "@/lib/slug";

/**
 * Biblioteca de IP: ativos reutilizáveis entre engajamentos.
 *
 * Versionado do mesmo jeito que os diagramas, e pelo mesmo motivo — o valor de
 * um ativo reusado num cliente novo está em saber o que mudou entre a v3 e a
 * v4. As duas entidades compartilham a forma, não o código: unificá-las
 * juntaria "documento de processo" com "ativo comercial", que têm ciclos de
 * vida e donos diferentes.
 */

const TIPOS = ["TEMPLATE", "PLAYBOOK", "COMPONENTE", "DOCUMENTO"] as const;
export type TipoDeAtivo = (typeof TIPOS)[number];

export type IpAssetRow = {
  id: string;
  nome: string;
  slug: string;
  tipo: string;
  descricao: string | null;
  versoes: number;
  origem: string | null;
  atualizadoEm: string;
};

export async function listIpAssets(): Promise<Result<IpAssetRow[]>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const linhas = await database.ipAsset.findMany({
      where: { tenantId: SYSTEM_TENANT_ID },
      orderBy: { atualizadoEm: "desc" },
      // `conteudo` fora do select: um playbook tem dezenas de KB e a lista não
      // renderiza nenhum deles.
      select: {
        id: true,
        nome: true,
        slug: true,
        tipo: true,
        descricao: true,
        atualizadoEm: true,
        origem: { select: { codigo: true, nome: true } },
        _count: { select: { versions: true } },
      },
    });

    return linhas.map((a) => ({
      id: a.id,
      nome: a.nome,
      slug: a.slug,
      tipo: a.tipo,
      descricao: a.descricao,
      versoes: a._count.versions,
      origem: a.origem ? `${a.origem.codigo} · ${a.origem.nome}` : null,
      atualizadoEm: a.atualizadoEm.toISOString(),
    }));
  });
}

export type IpAssetDetail = IpAssetRow & {
  conteudo: string;
  historico: {
    versao: number;
    nota: string | null;
    autorNome: string | null;
    criadoEm: string;
  }[];
};

export async function getIpAsset(id: string): Promise<Result<IpAssetDetail>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const a = await database.ipAsset.findFirst({
      where: { id, tenantId: SYSTEM_TENANT_ID },
      include: {
        versions: { orderBy: { versao: "desc" } },
        origem: { select: { codigo: true, nome: true } },
        _count: { select: { versions: true } },
      },
    });
    if (!a) {
      throw new StaffAuthError("FORBIDDEN", "Ativo não encontrado.");
    }

    return {
      id: a.id,
      nome: a.nome,
      slug: a.slug,
      tipo: a.tipo,
      descricao: a.descricao,
      conteudo: a.conteudo,
      versoes: a._count.versions,
      origem: a.origem ? `${a.origem.codigo} · ${a.origem.nome}` : null,
      atualizadoEm: a.atualizadoEm.toISOString(),
      historico: a.versions.map((v) => ({
        versao: v.versao,
        nota: v.nota,
        autorNome: v.autorNome,
        criadoEm: v.criadoEm.toISOString(),
      })),
    };
  });
}

const CriarSchema = z.object({
  nome: z.string().min(2).max(140),
  tipo: z.enum(TIPOS).optional(),
  descricao: z.string().max(500).optional(),
  conteudo: z.string().min(1),
  origemEngagementId: z.string().optional(),
});

export async function createIpAssetAction(
  input: z.input<typeof CriarSchema>
): Promise<Result<{ id: string; slug: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = CriarSchema.parse(input);
    const slug = slugificar(dados.nome);
    if (!slug) {
      throw new StaffAuthError(
        "FORBIDDEN",
        `"${dados.nome}" não gera um slug utilizável. Use letras ou números.`
      );
    }

    const jaExiste = await database.ipAsset.findFirst({
      where: { tenantId: SYSTEM_TENANT_ID, slug },
      select: { id: true },
    });
    if (jaExiste) {
      throw new StaffAuthError(
        "FORBIDDEN",
        `Já existe um ativo com o slug ${slug}. Escolha outro nome.`
      );
    }

    const criado = await database.$transaction(async (tx) => {
      const a = await tx.ipAsset.create({
        data: {
          tenantId: SYSTEM_TENANT_ID,
          nome: dados.nome,
          slug,
          tipo: dados.tipo ?? "DOCUMENTO",
          descricao: dados.descricao ?? null,
          conteudo: dados.conteudo,
          origemEngagementId: dados.origemEngagementId ?? null,
          criadoPorId: staff.userId,
          criadoPorNome: staff.name,
        },
        select: { id: true, slug: true },
      });

      // Versão 1 na mesma transação: um ativo sem revisão nenhuma seria um
      // histórico que começa no segundo salvamento.
      await tx.ipAssetVersion.create({
        data: {
          assetId: a.id,
          versao: 1,
          conteudo: dados.conteudo,
          nota: "Versão inicial",
          autorId: staff.userId,
          autorNome: staff.name,
        },
      });

      return a;
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "created",
      entityType: "ip_asset",
      entityId: criado.id,
      target: `${dados.tipo ?? "DOCUMENTO"} · ${dados.nome}`,
    });

    revalidatePath("/ip");
    return criado;
  });
}

const AtualizarSchema = z.object({
  id: z.string().min(1),
  conteudo: z.string().min(1),
  nota: z.string().max(300).optional(),
});

export async function updateIpAssetAction(
  input: z.input<typeof AtualizarSchema>
): Promise<Result<{ id: string; versao: number | null }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = AtualizarSchema.parse(input);

    const atual = await database.ipAsset.findFirst({
      where: { id: dados.id, tenantId: SYSTEM_TENANT_ID },
      select: { id: true, nome: true, slug: true, conteudo: true },
    });
    if (!atual) {
      throw new StaffAuthError("FORBIDDEN", "Ativo não encontrado.");
    }

    // Conteúdo idêntico não vira revisão — histórico não é log de cliques.
    if (atual.conteudo === dados.conteudo) {
      return { id: atual.id, versao: null };
    }

    const versao = await database.$transaction(async (tx) => {
      const { _max } = await tx.ipAssetVersion.aggregate({
        where: { assetId: atual.id },
        _max: { versao: true },
      });
      const proxima = (_max.versao ?? 0) + 1;

      await tx.ipAssetVersion.create({
        data: {
          assetId: atual.id,
          versao: proxima,
          conteudo: dados.conteudo,
          nota: dados.nota ?? null,
          autorId: staff.userId,
          autorNome: staff.name,
        },
      });

      await tx.ipAsset.update({
        where: { id: atual.id },
        data: { conteudo: dados.conteudo },
      });

      return proxima;
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "updated",
      entityType: "ip_asset",
      entityId: atual.id,
      target: `${atual.nome} → v${versao}`,
      note: dados.nota,
    });

    revalidatePath("/ip");
    return { id: atual.id, versao };
  });
}
