"use server";

import { $Enums, database, type ProductModule } from "@repo/database";
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

/**
 * Catálogo do que a Nebuloz vende.
 *
 * É a origem dos itens de uma proposta e do que um engajamento entrega. Sem
 * catálogo, proposta vira texto livre e não sobra eixo para comparar um cliente
 * com outro — que é justamente o que o Benchmark precisa.
 */

const MODALIDADES = ["PROJETO", "RETAINER", "LICENCA"] as const;

/** Como o serviço é cobrado. Só RETAINER entra na mensalidade da proposta —
 *  ver lib/comercial/precificar. */
const UNIDADES = ["PROJETO", "SPRINT", "HORA", "RETAINER"] as const;

/** Trilhas do catálogo de consultoria (backoffice-services do handoff). */
const TRILHAS = ["readiness", "adoption", "enablement", "custom"] as const;

/** Módulo a que o serviço se vincula.
 *
 *  String livre validada contra o enum do Prisma no momento da escrita, e não
 *  uma lista repetida aqui: repetir o enum em código quebrou o build de
 *  produção duas vezes — a cópia local ficou com cinco valores porque o schema
 *  no disco tinha cinco, enquanto o enum do repositório tem três. */
const moduloSchema = z.custom<ProductModule>(
  (v) => typeof v === "string" && Object.hasOwn($Enums.ProductModule, v),
  { message: "Módulo fora do catálogo da plataforma." }
);

export type ServiceRow = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  modalidade: string;
  precoBaseCentavos: number;
  unidade: string;
  ativo: boolean;
  trilha: string;
  unidadeDeCobranca: string;
  duracao: string | null;
  entregaveis: string[];
  papeis: string[];
  preRequisitos: string[];
  moduloVinculado: string | null;
  exigeLab: boolean;
};

export async function listServices(): Promise<Result<ServiceRow[]>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    return await database.service.findMany({
      // Sem filtro de `ativo`: esta é a tela de gestão do catálogo e mostra
      // tudo. Esconder o inativo faria o operador achar que o serviço sumiu e
      // cadastrar um duplicado com o mesmo código.
      where: { tenantId: SYSTEM_TENANT_ID },
      orderBy: [{ ativo: "desc" }, { codigo: "asc" }],
      select: {
        id: true,
        codigo: true,
        nome: true,
        descricao: true,
        modalidade: true,
        precoBaseCentavos: true,
        unidade: true,
        ativo: true,
        trilha: true,
        unidadeDeCobranca: true,
        duracao: true,
        entregaveis: true,
        papeis: true,
        preRequisitos: true,
        moduloVinculado: true,
        exigeLab: true,
      },
    });
  });
}

const CriarSchema = z.object({
  codigo: z.string().min(2).max(20),
  nome: z.string().min(2).max(120),
  descricao: z.string().max(500).optional(),
  modalidade: z.enum(MODALIDADES).optional(),
  /** Centavos. Inteiro e não-negativo — centavo não tem metade, e preço
   *  negativo é erro de digitação que vira desconto silencioso na proposta. */
  precoBaseCentavos: z.number().int().min(0),
  unidade: z.string().max(30).optional(),
  trilha: z.enum(TRILHAS).optional(),
  unidadeDeCobranca: z.enum(UNIDADES).optional(),
  duracao: z.string().max(60).optional(),
  entregaveis: z.array(z.string().min(1).max(200)).max(20).optional(),
  papeis: z.array(z.string().min(1).max(80)).max(12).optional(),
  /** Códigos de outros serviços. Não valida existência: um pré-requisito pode
   *  ser cadastrado depois, e travar a ordem de cadastro não protege nada. */
  preRequisitos: z.array(z.string().min(2).max(20)).max(10).optional(),
  moduloVinculado: moduloSchema.optional(),
  exigeLab: z.boolean().optional(),
});

export async function createServiceAction(
  input: z.input<typeof CriarSchema>
): Promise<Result<{ id: string; codigo: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = CriarSchema.parse(input);
    const codigo = dados.codigo.trim().toUpperCase();

    // Checagem antes do insert para o operador receber a mensagem certa; o
    // unique do banco segue sendo a garantia contra corrida.
    const jaExiste = await database.service.findFirst({
      where: { tenantId: SYSTEM_TENANT_ID, codigo },
      select: { id: true },
    });
    if (jaExiste) {
      throw new StaffAuthError(
        "FORBIDDEN",
        `Já existe um serviço com o código ${codigo}. Ele aparece em proposta e contrato, então precisa ser único.`
      );
    }

    const criado = await database.service.create({
      data: {
        tenantId: SYSTEM_TENANT_ID,
        codigo,
        nome: dados.nome,
        descricao: dados.descricao ?? null,
        modalidade: dados.modalidade ?? "PROJETO",
        precoBaseCentavos: dados.precoBaseCentavos,
        unidade: dados.unidade ?? "projeto",
        trilha: dados.trilha ?? "readiness",
        unidadeDeCobranca: dados.unidadeDeCobranca ?? "PROJETO",
        duracao: dados.duracao ?? null,
        entregaveis: dados.entregaveis ?? [],
        papeis: dados.papeis ?? [],
        preRequisitos: dados.preRequisitos ?? [],
        moduloVinculado: dados.moduloVinculado ?? null,
        exigeLab: dados.exigeLab ?? false,
      },
      select: { id: true, codigo: true },
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "created",
      entityType: "service",
      entityId: criado.id,
      target: `${codigo} · ${dados.nome}`,
    });

    revalidatePath("/servicos");
    return criado;
  });
}

const AtivoSchema = z.object({
  id: z.string().min(1),
  ativo: z.boolean(),
});

/**
 * Tira do catálogo (ou devolve) sem apagar.
 *
 * Não existe delete aqui de propósito: proposta antiga aponta para o serviço
 * que existia quando foi feita, e apagar quebraria um documento comercial
 * retroativamente. A FK de `ProposalItem` é RESTRICT pelo mesmo motivo — se
 * alguém tentar apagar pelo banco, falha.
 */
export async function setServiceAtivoAction(
  input: z.input<typeof AtivoSchema>
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = AtivoSchema.parse(input);

    const atual = await database.service.findFirst({
      where: { id: dados.id, tenantId: SYSTEM_TENANT_ID },
      select: { id: true, codigo: true, nome: true, ativo: true },
    });
    if (!atual) {
      throw new StaffAuthError("FORBIDDEN", "Serviço não encontrado.");
    }

    await database.service.update({
      where: { id: atual.id },
      data: { ativo: dados.ativo },
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "updated",
      entityType: "service",
      entityId: atual.id,
      target: `${atual.codigo} · ${atual.nome}`,
      diff: [["ativo", String(atual.ativo), String(dados.ativo)]],
    });

    revalidatePath("/servicos");
    return { id: atual.id };
  });
}

/** Campos que a edição alcança. `codigo` fica de fora de propósito: ele é o
 *  que aparece em proposta e contrato já assinados, e renomear a chave de um
 *  documento emitido é reescrever o passado. Serviço com código errado se
 *  desativa e se cadastra de novo. */
const EditarSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(2).max(120),
  descricao: z.string().max(500).nullable().optional(),
  precoBaseCentavos: z.number().int().min(0),
  unidade: z.string().max(30).optional(),
  trilha: z.enum(TRILHAS),
  unidadeDeCobranca: z.enum(UNIDADES),
  duracao: z.string().max(60).nullable().optional(),
  entregaveis: z.array(z.string().min(1).max(200)).max(20),
  papeis: z.array(z.string().min(1).max(80)).max(12),
  preRequisitos: z.array(z.string().min(2).max(20)).max(10),
  moduloVinculado: moduloSchema.nullable().optional(),
  exigeLab: z.boolean(),
});

/**
 * Edita um serviço do catálogo.
 *
 * Não existia: o catálogo só sabia criar e (des)ativar, então corrigir um
 * preço digitado errado exigia SQL. Mudar preço aqui não mexe em proposta
 * nenhuma — `ProposalItem` guarda cópia de nome e valor desde a criação.
 */
export async function updateServiceAction(
  input: z.input<typeof EditarSchema>
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = EditarSchema.parse(input);

    const atual = await database.service.findFirst({
      where: { id: dados.id, tenantId: SYSTEM_TENANT_ID },
    });
    if (!atual) {
      throw new StaffAuthError("FORBIDDEN", "Serviço não encontrado.");
    }

    await database.service.update({
      where: { id: atual.id },
      data: {
        nome: dados.nome,
        descricao: dados.descricao ?? null,
        precoBaseCentavos: dados.precoBaseCentavos,
        unidade: dados.unidade ?? atual.unidade,
        trilha: dados.trilha,
        unidadeDeCobranca: dados.unidadeDeCobranca,
        duracao: dados.duracao ?? null,
        entregaveis: dados.entregaveis,
        papeis: dados.papeis,
        preRequisitos: dados.preRequisitos,
        moduloVinculado: dados.moduloVinculado ?? null,
        exigeLab: dados.exigeLab,
      },
    });

    // Diff campo a campo, não "serviço atualizado": quando o preço de um
    // serviço muda, a pergunta que a auditoria precisa responder é de quanto
    // para quanto.
    const diff: [string, string, string][] = [];
    const anota = (campo: string, antes: unknown, depois: unknown) => {
      const a = Array.isArray(antes) ? antes.join(", ") : String(antes ?? "");
      const d = Array.isArray(depois) ? depois.join(", ") : String(depois ?? "");
      if (a !== d) {
        diff.push([campo, a, d]);
      }
    };
    anota("nome", atual.nome, dados.nome);
    anota("descricao", atual.descricao, dados.descricao ?? null);
    anota(
      "precoBaseCentavos",
      atual.precoBaseCentavos,
      dados.precoBaseCentavos
    );
    anota("trilha", atual.trilha, dados.trilha);
    anota(
      "unidadeDeCobranca",
      atual.unidadeDeCobranca,
      dados.unidadeDeCobranca
    );
    anota("duracao", atual.duracao, dados.duracao ?? null);
    anota("entregaveis", atual.entregaveis, dados.entregaveis);
    anota("papeis", atual.papeis, dados.papeis);
    anota("preRequisitos", atual.preRequisitos, dados.preRequisitos);
    anota(
      "moduloVinculado",
      atual.moduloVinculado,
      dados.moduloVinculado ?? null
    );
    anota("exigeLab", atual.exigeLab, dados.exigeLab);

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "updated",
      entityType: "service",
      entityId: atual.id,
      target: `${atual.codigo} · ${dados.nome}`,
      diff,
    });

    revalidatePath("/servicos");
    revalidatePath(`/servicos/${atual.id}`);
    return { id: atual.id };
  });
}
