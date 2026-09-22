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
import {
  avaliarRegua,
  criteriosPendentes,
  LICENCAS,
  MIN_DESCRICAO,
  MIN_NOME,
  maturidadeDe,
  PROCEDENCIAS,
  TIPOS_DE_ATIVO,
} from "@/lib/ip/regua";
import {
  janela,
  type Listagem,
  listagem,
  type OpcoesDePagina,
} from "@/lib/paginacao";
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

export type IpAssetRow = {
  id: string;
  nome: string;
  slug: string;
  tipo: string;
  descricao: string | null;
  /** Nulo quer dizer que o ativo vive aqui, no editor. */
  link: string | null;
  dono: string | null;
  procedencia: string;
  licenca: string;
  servicos: { id: string; codigo: string; nome: string }[];
  reusos: number;
  horasPoupadas: number;
  maturidade: "RASCUNHO" | "COMPROVADO";
  versoes: number;
  origem: string | null;
  atualizadoEm: string;
};

/**
 * Forma comum a toda leitura de ativo — lista, detalhe e o retorno da
 * criação usam o mesmo `select` e o mesmo mapeamento, porque uma segunda
 * cópia dessa montagem divergiria da primeira no primeiro ajuste.
 */
const CAMPOS_LINHA = {
  id: true,
  nome: true,
  slug: true,
  tipo: true,
  descricao: true,
  link: true,
  procedencia: true,
  licenca: true,
  atualizadoEm: true,
  origem: { select: { codigo: true, nome: true } },
  dono: { select: { nome: true } },
  servicos: {
    select: { service: { select: { id: true, codigo: true, nome: true } } },
  },
  reusos: { select: { horasPoupadas: true } },
  _count: { select: { versions: true } },
} as const;

type LinhaBruta = {
  id: string;
  nome: string;
  slug: string;
  tipo: string;
  descricao: string | null;
  link: string | null;
  procedencia: string;
  licenca: string;
  atualizadoEm: Date;
  origem: { codigo: string; nome: string } | null;
  dono: { nome: string } | null;
  servicos: { service: { id: string; codigo: string; nome: string } }[];
  reusos: { horasPoupadas: number }[];
  _count: { versions: number };
};

function paraLinha(a: LinhaBruta): IpAssetRow {
  return {
    id: a.id,
    nome: a.nome,
    slug: a.slug,
    tipo: a.tipo,
    descricao: a.descricao,
    link: a.link,
    dono: a.dono ? a.dono.nome : null,
    procedencia: a.procedencia,
    licenca: a.licenca,
    servicos: a.servicos.map((s) => s.service),
    reusos: a.reusos.length,
    // Soma dos eventos, nunca uma média digitada multiplicada por uma
    // contagem — duas fontes para o mesmo número divergem.
    horasPoupadas: a.reusos.reduce((soma, r) => soma + r.horasPoupadas, 0),
    maturidade: maturidadeDe(a.reusos.length),
    versoes: a._count.versions,
    origem: a.origem ? `${a.origem.codigo} · ${a.origem.nome}` : null,
    atualizadoEm: a.atualizadoEm.toISOString(),
  };
}

/** Sem opções, a lista de sempre (até o teto); com `{ pagina }`,
 *  `{ itens, temMais }` — ver `lib/paginacao.ts`. */
export async function listIpAssets<
  O extends OpcoesDePagina | undefined = undefined,
>(opcoes?: O): Promise<Result<Listagem<IpAssetRow, O>>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const linhas = await database.ipAsset.findMany({
      where: { tenantId: SYSTEM_TENANT_ID },
      orderBy: { atualizadoEm: "desc" },
      ...janela(opcoes),
      // `conteudo` fora do select: um playbook tem dezenas de KB e a lista não
      // renderiza nenhum deles.
      select: CAMPOS_LINHA,
    });

    return listagem(linhas.map(paraLinha), opcoes);
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
        dono: { select: { nome: true } },
        servicos: {
          select: {
            service: { select: { id: true, codigo: true, nome: true } },
          },
        },
        reusos: { select: { horasPoupadas: true } },
        _count: { select: { versions: true } },
      },
    });
    if (!a) {
      throw new StaffAuthError("FORBIDDEN", "Ativo não encontrado.");
    }

    return {
      ...paraLinha(a),
      conteudo: a.conteudo,
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
  nome: z.string().min(MIN_NOME).max(140),
  tipo: z.enum(TIPOS_DE_ATIVO).optional(),
  descricao: z.string().min(MIN_DESCRICAO).max(500),
  conteudo: z.string().min(1),
  link: z.string().max(300).optional(),
  viveAqui: z.boolean().optional(),
  donoPersonId: z.string().optional(),
  // A IP-R4 já exige pelo menos um serviço — o mínimo mora só na régua.
  servicoIds: z.array(z.string().min(1)).max(20),
  procedencia: z.enum(PROCEDENCIAS).optional(),
  origemEngagementId: z.string().optional(),
  reusoConfirmado: z.boolean().optional(),
  licenca: z.enum(LICENCAS).optional(),
  licencaRef: z.string().max(200).optional(),
});

/**
 * Monta a entrada da régua a partir do input já validado pelo zod.
 *
 * Extraído porque `createIpAssetAction` já soma validação, régua, slug e
 * transação — mais um bloco inline estouraria a complexidade cognitiva.
 */
function entradaDaRegua(dados: z.infer<typeof CriarSchema>) {
  return {
    nome: dados.nome,
    descricao: dados.descricao,
    link: dados.link ?? "",
    viveAqui: dados.viveAqui ?? false,
    servicos: dados.servicoIds,
    procedencia: dados.procedencia ?? "INTERNO",
    origemEngagementId: dados.origemEngagementId ?? null,
    reusoConfirmado: dados.reusoConfirmado ?? false,
    licenca: dados.licenca ?? "NENHUMA",
    licencaRef: dados.licencaRef ?? "",
  };
}

export async function createIpAssetAction(
  input: z.input<typeof CriarSchema>
): Promise<Result<IpAssetRow>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = CriarSchema.parse(input);

    // A régua roda aqui porque a lista lateral do formulário é espelho, não
    // autoridade: um POST direto nesta action não passa por tela nenhuma.
    const pendentes = criteriosPendentes(avaliarRegua(entradaDaRegua(dados)));
    if (pendentes.length > 0) {
      throw new StaffAuthError(
        "FORBIDDEN",
        `${pendentes.length === 1 ? "Falta 1 critério" : `Faltam ${pendentes.length} critérios`} da régua: ${pendentes.map((c) => c.texto).join("; ")}.`
      );
    }

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

    const linhaBruta = await database.$transaction(async (tx) => {
      const a = await tx.ipAsset.create({
        data: {
          tenantId: SYSTEM_TENANT_ID,
          nome: dados.nome,
          slug,
          tipo: dados.tipo ?? "DOCUMENTO",
          descricao: dados.descricao,
          conteudo: dados.conteudo,
          link: dados.viveAqui ? null : (dados.link?.trim() ?? null),
          donoPersonId: dados.donoPersonId ?? null,
          procedencia: dados.procedencia ?? "INTERNO",
          reusoConfirmado: dados.reusoConfirmado ?? false,
          licenca: dados.licenca ?? "NENHUMA",
          licencaRef: dados.licencaRef?.trim() || null,
          origemEngagementId: dados.origemEngagementId ?? null,
          criadoPorId: staff.userId,
          criadoPorNome: staff.name,
        },
        select: { id: true },
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

      // Vínculo de serviço na mesma transação que o ativo: um ativo sem
      // serviço nenhum é exatamente o que a IP-R4 recusa, e um estado que a
      // régua proíbe não pode existir nem por um instante entre dois writes.
      await tx.ipAssetService.createMany({
        data: dados.servicoIds.map((serviceId) => ({
          assetId: a.id,
          serviceId,
        })),
      });

      return await tx.ipAsset.findUniqueOrThrow({
        where: { id: a.id },
        select: CAMPOS_LINHA,
      });
    });

    const linha = paraLinha(linhaBruta);

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "created",
      entityType: "ip_asset",
      entityId: linha.id,
      target: `${linha.tipo} · ${linha.nome}`,
    });

    revalidatePath("/ip");
    return linha;
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

const ReusoSchema = z.object({
  assetId: z.string().min(1),
  engagementId: z.string().min(1),
  horasPoupadas: z.number().int().min(0).max(400),
  nota: z.string().max(300).optional(),
});

/**
 * Registra que o ativo foi reusado num engajamento.
 *
 * É o único caminho por onde reusos, horas poupadas e maturidade mudam — os
 * três são derivados desta tabela e não existem como campo em lugar nenhum.
 * O agregado de horas volta aqui, e não só o evento recém-criado, porque o
 * cliente não tem de onde somar: duas pessoas com a tela aberta ao mesmo
 * tempo divergiriam se cada uma somasse a própria cópia local.
 */
export async function registrarReusoAction(
  input: z.input<typeof ReusoSchema>
): Promise<
  Result<{
    id: string;
    reusos: number;
    horasPoupadas: number;
    maturidade: "RASCUNHO" | "COMPROVADO";
  }>
> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = ReusoSchema.parse(input);

    const ativo = await database.ipAsset.findFirst({
      where: { id: dados.assetId, tenantId: SYSTEM_TENANT_ID },
      select: { id: true, nome: true },
    });
    if (!ativo) {
      throw new StaffAuthError("FORBIDDEN", "Ativo não encontrado.");
    }

    const engajamento = await database.engagement.findFirst({
      where: { id: dados.engagementId, tenantId: SYSTEM_TENANT_ID },
      select: { id: true, codigo: true, nome: true },
    });
    if (!engajamento) {
      throw new StaffAuthError("FORBIDDEN", "Engajamento não encontrado.");
    }

    // "Foi reusado no EN-041" é um fato, não um contador. Recusar aqui, com a
    // frase inteira, evita que o `@@unique` apareça como erro do Prisma.
    const jaRegistrado = await database.ipAssetReuse.findUnique({
      where: {
        assetId_engagementId: {
          assetId: ativo.id,
          engagementId: engajamento.id,
        },
      },
      select: { id: true },
    });
    if (jaRegistrado) {
      throw new StaffAuthError(
        "FORBIDDEN",
        `${ativo.nome} já consta como reusado em ${engajamento.codigo}. Registrar de novo contaria o mesmo reuso duas vezes.`
      );
    }

    const criado = await database.ipAssetReuse.create({
      data: {
        assetId: ativo.id,
        engagementId: engajamento.id,
        horasPoupadas: dados.horasPoupadas,
        nota: dados.nota?.trim() || null,
        registradoPorId: staff.userId,
        registradoPorNome: staff.name,
      },
      select: { id: true },
    });

    const reusos = await database.ipAssetReuse.count({
      where: { assetId: ativo.id },
    });
    const agregado = await database.ipAssetReuse.aggregate({
      _sum: { horasPoupadas: true },
      where: { assetId: ativo.id },
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "created",
      entityType: "ip_asset_reuse",
      entityId: criado.id,
      target: `${ativo.nome} → ${engajamento.codigo} (${dados.horasPoupadas}h)`,
      note: dados.nota,
    });

    revalidatePath("/ip");
    return {
      id: criado.id,
      reusos,
      horasPoupadas: agregado._sum.horasPoupadas ?? 0,
      maturidade: maturidadeDe(reusos),
    };
  });
}
