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
  type UnidadeDeCobranca,
  precificarProposta,
} from "@/lib/comercial/precificar";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Escopo de assinatura da proposta.
 *
 * Esta action lê o catálogo, chama `precificarProposta` e grava o que a função
 * devolveu. Ela não refaz a conta — e não deve. A mesma fórmula roda no preview
 * que o cliente lê durante a call; se as duas divergissem, quem descobriria
 * seria o cliente, comparando o documento com o contrato.
 */

const MODULOS = ["COSMOS", "CHARTER", "SIGNAL", "MERIDIAN", "SCAFFOLD"] as const;

const EscopoSchema = z.object({
  /** Ausente = proposta nova. Presente = rascunho sendo ajustado na call. */
  id: z.string().min(1).optional(),
  titulo: z.string().min(2).max(160),
  clienteNome: z.string().max(160).optional(),
  /** FR-13.7: enviar exige contato válido. Guardar com lixo aqui só adia a
   *  descoberta para a hora do envio. */
  contatoEmail: z.string().email().max(160).optional(),
  planoSlug: z.string().min(1),
  assentos: z.number().int().min(0).max(100_000),
  modulos: z.array(z.enum(MODULOS)).min(1, "Escolha ao menos um módulo."),
  addOnSlugs: z.array(z.string().min(1)).max(20).default([]),
  termoSlug: z.string().min(1),
  descontoPercent: z.number().int().min(0).max(100).default(0),
  servicoIds: z.array(z.string().min(1)).max(30).default([]),
});

export type PropostaSalva = { id: string; numero: string };

export async function salvarEscopoAction(
  input: z.input<typeof EscopoSchema>
): Promise<Result<PropostaSalva>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = EscopoSchema.parse(input);
    const where = { tenantId: SYSTEM_TENANT_ID };

    const [planos, precosDeModulo, termos, addOns, servicos] =
      await Promise.all([
        database.planoComercial.findMany({ where: { ...where, ativo: true } }),
        database.precoDeModulo.findMany({ where }),
        database.termoDeContrato.findMany({ where }),
        database.addOnComercial.findMany({ where: { ...where, ativo: true } }),
        dados.servicoIds.length > 0
          ? database.service.findMany({
              where: { ...where, ativo: true, id: { in: dados.servicoIds } },
            })
          : Promise.resolve([]),
      ]);

    const plano = planos.find((p) => p.slug === dados.planoSlug);
    if (!plano) {
      throw new StaffAuthError(
        "FORBIDDEN",
        `Plano ${dados.planoSlug} não está no catálogo ativo.`
      );
    }

    const termo = termos.find((t) => t.slug === dados.termoSlug);
    if (!termo) {
      throw new StaffAuthError(
        "FORBIDDEN",
        `Prazo ${dados.termoSlug} não está no catálogo.`
      );
    }

    // Serviço fora do catálogo ativo não entra: a proposta citaria algo que a
    // Nebuloz não vende mais, e a diferença só apareceria na entrega.
    const faltando = dados.servicoIds.filter(
      (id) => !servicos.some((s) => s.id === id)
    );
    if (faltando.length > 0) {
      throw new StaffAuthError(
        "FORBIDDEN",
        `Serviço fora do catálogo ativo: ${faltando.join(", ")}.`
      );
    }

    const addOnsEscolhidos = dados.addOnSlugs.map((slug) => {
      const addOn = addOns.find((a) => a.slug === slug);
      if (!addOn) {
        throw new StaffAuthError(
          "FORBIDDEN",
          `Add-on ${slug} não está no catálogo ativo.`
        );
      }
      return addOn;
    });

    const preco = precificarProposta(
      {
        plano: {
          precoAssentoCentavos: plano.precoAssentoCentavos,
          minimoAssentos: plano.minimoAssentos,
        },
        modulos: dados.modulos.map((m) => ({
          moduloId: m,
          precoMensalCentavos:
            precosDeModulo.find((p) => String(p.modulo) === m)
              ?.precoMensalCentavos ?? 0,
        })),
        termo: { meses: termo.meses, descontoPercent: termo.descontoPercent },
        addOns: addOnsEscolhidos.map((a) => ({
          precoCentavos: a.precoCentavos,
          recorrente: a.recorrente,
        })),
        servicos: servicos.map((s) => ({
          precoCentavos: s.precoBaseCentavos,
          unidade: s.unidadeDeCobranca as UnidadeDeCobranca,
        })),
      },
      { assentos: dados.assentos, descontoPercent: dados.descontoPercent }
    );

    const escopo = {
      titulo: dados.titulo,
      clienteNome: dados.clienteNome ?? null,
      contatoEmail: dados.contatoEmail ?? null,
      planoSlug: plano.slug,
      assentos: dados.assentos,
      modulos: dados.modulos,
      addOnSlugs: dados.addOnSlugs,
      termoSlug: termo.slug,
      descontoPercent: dados.descontoPercent,
      totalCentavos: preco.liquidoMensalCentavos,
      acvCentavos: preco.acvCentavos,
      tcvCentavos: preco.tcvCentavos,
      umaVezCentavos: preco.umaVezCentavos,
    };

    // Itens guardam cópia de nome e preço, como no caminho antigo: o catálogo
    // muda, e uma proposta que muda de valor sozinha depois de emitida é
    // problema contratual, não detalhe de exibição.
    const itens = servicos.map((s, ordem) => ({
      serviceId: s.id,
      descricao: s.nome,
      quantidade: 1,
      precoUnitCentavos: s.precoBaseCentavos,
      ordem,
    }));

    if (dados.id) {
      const atual = await database.proposal.findFirst({
        where: { id: dados.id, tenantId: SYSTEM_TENANT_ID },
        select: { id: true, numero: true, status: true },
      });
      if (!atual) {
        throw new StaffAuthError("FORBIDDEN", "Proposta não encontrada.");
      }
      // Só rascunho se edita. Depois de enviada, o documento já saiu da casa:
      // mudar escopo por baixo dele é reescrever o que o cliente recebeu.
      if (atual.status !== "RASCUNHO") {
        throw new StaffAuthError(
          "FORBIDDEN",
          `Proposta em ${atual.status} não é mais rascunho — o escopo dela já foi enviado.`
        );
      }

      const salva = await database.$transaction(async (tx) => {
        const atualizada = await tx.proposal.update({
          where: { id: atual.id },
          data: escopo,
          select: { id: true, numero: true },
        });
        await tx.proposalItem.deleteMany({ where: { proposalId: atual.id } });
        if (itens.length > 0) {
          await tx.proposalItem.createMany({
            data: itens.map((i) => ({ ...i, proposalId: atual.id })),
          });
        }
        return atualizada;
      });

      await logPlatformAudit(database, {
        tenantId: SYSTEM_TENANT_ID,
        actorUserId: staff.userId,
        actorName: staff.name,
        action: "updated",
        entityType: "proposal",
        entityId: salva.id,
        target: `${salva.numero} · ${dados.titulo}`,
      });

      revalidatePath("/propostas");
      revalidatePath(`/propostas/${salva.id}`);
      return salva;
    }

    const numero = `P-${Date.now().toString(36).toUpperCase()}`;
    const criada = await database.$transaction(async (tx) => {
      const nova = await tx.proposal.create({
        data: {
          tenantId: SYSTEM_TENANT_ID,
          numero,
          status: "RASCUNHO",
          criadoPorId: staff.userId,
          criadoPorNome: staff.name,
          ...escopo,
        },
        select: { id: true, numero: true },
      });
      if (itens.length > 0) {
        await tx.proposalItem.createMany({
          data: itens.map((i) => ({ ...i, proposalId: nova.id })),
        });
      }
      return nova;
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "created",
      entityType: "proposal",
      entityId: criada.id,
      target: `${criada.numero} · ${dados.titulo}`,
    });

    revalidatePath("/propostas");
    return criada;
  });
}

export type PropostaParaEdicao = {
  id: string;
  numero: string;
  status: string;
  titulo: string;
  clienteNome: string | null;
  contatoEmail: string | null;
  planoSlug: string | null;
  assentos: number;
  modulos: string[];
  addOnSlugs: string[];
  termoSlug: string | null;
  descontoPercent: number;
  servicoIds: string[];
};

/**
 * Lê uma proposta para reabrir no gerador.
 *
 * Devolve o escopo, não o preço: o preço se recalcula no cliente a partir do
 * catálogo atual enquanto a proposta é rascunho. O valor gravado é o que vale
 * depois de enviada — e proposta enviada não volta para o gerador.
 */
export async function getPropostaParaEdicao(
  id: string
): Promise<Result<PropostaParaEdicao>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const p = await database.proposal.findFirst({
      where: { id, tenantId: SYSTEM_TENANT_ID },
      select: {
        id: true,
        numero: true,
        status: true,
        titulo: true,
        clienteNome: true,
        contatoEmail: true,
        planoSlug: true,
        assentos: true,
        modulos: true,
        addOnSlugs: true,
        termoSlug: true,
        descontoPercent: true,
        itens: { select: { serviceId: true }, orderBy: { ordem: "asc" } },
      },
    });
    if (!p) {
      throw new StaffAuthError("FORBIDDEN", "Proposta não encontrada.");
    }

    return {
      id: p.id,
      numero: p.numero,
      status: p.status,
      titulo: p.titulo,
      clienteNome: p.clienteNome,
      contatoEmail: p.contatoEmail,
      planoSlug: p.planoSlug,
      assentos: p.assentos,
      modulos: p.modulos.map(String),
      addOnSlugs: p.addOnSlugs,
      termoSlug: p.termoSlug,
      descontoPercent: p.descontoPercent,
      servicoIds: p.itens.map((i) => i.serviceId),
    };
  });
}
