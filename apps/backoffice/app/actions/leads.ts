"use server";

import { database, ProductModule } from "@repo/database";
import { logPlatformAudit } from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { gerarNumeroProposta } from "@/lib/comercial";
import {
  ABERTOS,
  type ConfigEstagio,
  type Estagio,
  MOTIVOS_PERDA,
  type MotivoPerda,
  situacaoDe,
  type Transicao,
} from "@/lib/comercial/funil";
import {
  assertCanWrite,
  requirePlatformStaff,
  StaffAuthError,
  SYSTEM_TENANT_ID,
} from "@/lib/guard";
import {
  cortar,
  janela,
  type OpcoesDePagina,
  TETO_DA_LISTA,
} from "@/lib/paginacao";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Funil comercial v2 — quatro estágios (LEAD, DISCOVERY, EVALUATION,
 * PROPOSAL), regras puras em `lib/comercial/funil.ts` (spec
 * docs/superpowers/specs/2026-09-06-funil-v2-design.md).
 *
 * O invariante que carrega este módulo: lead convertido (`propostaId`
 * gravado) ou perdido (`perdidoEm` gravado) não volta a mover de estágio pelo
 * board. Sem isso, reabrir um funil que já fechou faria a mesma venda contar
 * duas vezes — ou o pipeline "aberto" incluir o que já morreu. `marcarPerdido`
 * é a única exceção: um lead em PROPOSAL pode ser perdido pelo funil sem que
 * isso mexa no status da proposta (quem decide isso é a tela de propostas).
 *
 * Toda transição — nascimento, movimento, conversão, perda — grava uma linha
 * em `HistoricoDeEstagio`: é o que sustenta "conversão 90 d" e "permanência
 * média" do painel.
 */

export type LeadRow = {
  id: string;
  nome: string;
  contatoNome: string | null;
  contatoEmail: string | null;
  estagio: string;
  estagioDesde: string;
  entrada: string | null;
  canal: { slug: string; nome: string; cacMedioCentavos: number | null } | null;
  acvEstimadoCentavos: number | null;
  origem: string | null;
  donoNome: string | null;
  proximaAcao: string | null;
  proximaAcaoEm: string | null;
  proposta: {
    id: string;
    numero: string;
    status: string;
    acvCentavos: number;
    tenantProvisionadoSlug: string | null;
  } | null;
  perdidoEm: string | null;
  perdidoNoEstagio: string | null;
  motivoPerda: string | null;
  notaPerda: string | null;
  situacao: "ATIVO" | "GANHO" | "PERDIDO";
  criadoEm: string;
};

export type CanalRow = {
  slug: string;
  nome: string;
  cacMedioCentavos: number | null;
};

const NOVENTA_DIAS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * O pacote do funil. Os leads vêm até o teto de `lib/paginacao.ts` — com
 * `{ pagina }`, a página pedida — e `temMaisLeads` diz se há próxima. O
 * histórico é o dos leads lidos: as métricas do estágio (conversão 90 d,
 * permanência) descrevem o que está na tela, e o número de linhas fica
 * limitado pelo número de leads em vez de crescer com a base inteira.
 * Estágios e canais são configuração — poucas linhas, mas com teto mesmo
 * assim, para nenhuma leitura sair daqui sem um.
 */
export async function listarFunil(opcoes?: OpcoesDePagina): Promise<
  Result<{
    leads: LeadRow[];
    temMaisLeads: boolean;
    estagios: ConfigEstagio[];
    canais: CanalRow[];
    historico: Transicao[];
    hoje: string;
  }>
> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const hoje = new Date();
    const desde = new Date(hoje.getTime() - NOVENTA_DIAS_MS);

    const [paginaDeLeads, estagios, canais] = await Promise.all([
      database.lead.findMany({
        where: { tenantId: SYSTEM_TENANT_ID },
        orderBy: { criadoEm: "desc" },
        ...janela(opcoes),
        select: {
          id: true,
          nome: true,
          contatoNome: true,
          contatoEmail: true,
          estagio: true,
          estagioDesde: true,
          entrada: true,
          origem: true,
          acvEstimadoCentavos: true,
          donoNome: true,
          proximaAcao: true,
          proximaAcaoEm: true,
          perdidoEm: true,
          perdidoNoEstagio: true,
          motivoPerda: true,
          notaPerda: true,
          criadoEm: true,
          canal: {
            select: { slug: true, nome: true, cacMedioCentavos: true },
          },
          proposta: {
            select: {
              id: true,
              numero: true,
              status: true,
              acvCentavos: true,
              tenantProvisionadoSlug: true,
            },
          },
        },
      }),
      database.estagioDoFunil.findMany({
        where: { tenantId: SYSTEM_TENANT_ID },
        orderBy: { ordem: "asc" },
        take: TETO_DA_LISTA,
        select: {
          codigo: true,
          pesoPercent: true,
          tetoDias: true,
          criterios: true,
        },
      }),
      database.canalDeLead.findMany({
        where: { tenantId: SYSTEM_TENANT_ID, ativo: true },
        orderBy: { ordem: "asc" },
        take: TETO_DA_LISTA,
        select: { slug: true, nome: true, cacMedioCentavos: true },
      }),
    ]);
    const { itens: leads, temMais } = cortar(paginaDeLeads, opcoes);

    const historico = await database.historicoDeEstagio.findMany({
      where: {
        tenantId: SYSTEM_TENANT_ID,
        em: { gte: desde },
        leadId: { in: leads.map((l) => l.id) },
      },
      orderBy: { em: "asc" },
      select: { leadId: true, de: true, para: true, em: true },
    });

    return {
      temMaisLeads: temMais,
      leads: leads.map((l) => {
        const perdidoEmIso = l.perdidoEm ? l.perdidoEm.toISOString() : null;
        return {
          id: l.id,
          nome: l.nome,
          contatoNome: l.contatoNome,
          contatoEmail: l.contatoEmail,
          estagio: l.estagio,
          estagioDesde: l.estagioDesde.toISOString(),
          entrada: l.entrada,
          canal: l.canal,
          acvEstimadoCentavos: l.acvEstimadoCentavos,
          origem: l.origem,
          donoNome: l.donoNome,
          proximaAcao: l.proximaAcao,
          proximaAcaoEm: l.proximaAcaoEm ? l.proximaAcaoEm.toISOString() : null,
          proposta: l.proposta,
          perdidoEm: perdidoEmIso,
          perdidoNoEstagio: l.perdidoNoEstagio,
          motivoPerda: l.motivoPerda,
          notaPerda: l.notaPerda,
          situacao: situacaoDe(perdidoEmIso, l.proposta?.status ?? null),
          criadoEm: l.criadoEm.toISOString(),
        };
      }),
      estagios: estagios.map((e) => ({
        codigo: e.codigo as Estagio,
        pesoPercent: e.pesoPercent,
        tetoDias: e.tetoDias,
        criterios: e.criterios,
      })),
      canais,
      historico: historico.map((h) => ({
        leadId: h.leadId,
        de: h.de,
        para: h.para,
        em: h.em.toISOString(),
      })),
      hoje: hoje.toISOString(),
    };
  });
}

const CriarSchema = z.object({
  nome: z.string().min(2).max(160),
  contatoNome: z.string().max(160).optional(),
  contatoEmail: z.string().email().max(160).optional(),
  entrada: z.enum(ProductModule),
  canalSlug: z.string().min(1),
  acvEstimadoCentavos: z.number().int().min(0).optional(),
  proximaAcao: z.string().trim().min(1).max(200),
  proximaAcaoEm: z.coerce.date(),
});

export async function criarLead(
  input: z.input<typeof CriarSchema>
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = CriarSchema.parse(input);

    const canal = await database.canalDeLead.findFirst({
      where: { tenantId: SYSTEM_TENANT_ID, slug: dados.canalSlug, ativo: true },
      select: { id: true },
    });
    if (!canal) {
      throw new StaffAuthError(
        "FORBIDDEN",
        "Esse canal não existe ou está inativo."
      );
    }

    // `donoId`/`donoNome` seguem `criadoPorId`/`criadoPorNome` de Proposal:
    // quem cria é quem toca, no nascimento. Reatribuir dono é operação que
    // este V1 não oferece — não foi pedida.
    const lead = await database.$transaction(async (tx) => {
      const criado = await tx.lead.create({
        data: {
          tenantId: SYSTEM_TENANT_ID,
          nome: dados.nome,
          contatoNome: dados.contatoNome ?? null,
          contatoEmail: dados.contatoEmail ?? null,
          entrada: dados.entrada,
          canalId: canal.id,
          acvEstimadoCentavos: dados.acvEstimadoCentavos ?? null,
          proximaAcao: dados.proximaAcao,
          proximaAcaoEm: dados.proximaAcaoEm,
          donoId: staff.userId,
          donoNome: staff.name,
        },
        select: { id: true },
      });

      await tx.historicoDeEstagio.create({
        data: {
          tenantId: SYSTEM_TENANT_ID,
          leadId: criado.id,
          de: null,
          para: "LEAD",
        },
      });

      return criado;
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "created",
      entityType: "lead",
      entityId: lead.id,
      target: dados.nome,
    });

    revalidatePath("/funil");
    return lead;
  });
}

/** Busca o lead escopado ao tenant, sem checar se ele já saiu do funil —
 *  `marcarPerdido` precisa disto puro porque um lead em PROPOSAL (já com
 *  `propostaId` gravado) ainda pode ser perdido pelo funil. A `proposta` vem
 *  junto para `marcarPerdido` recusar um lead já GANHO (proposta ACEITA). */
async function buscarLead(id: string) {
  const lead = await database.lead.findFirst({
    where: { id, tenantId: SYSTEM_TENANT_ID },
    select: {
      id: true,
      nome: true,
      estagio: true,
      estagioDesde: true,
      contatoEmail: true,
      propostaId: true,
      perdidoEm: true,
      proposta: { select: { status: true } },
    },
  });
  if (!lead) {
    throw new StaffAuthError("FORBIDDEN", "Lead não encontrado.");
  }
  return lead;
}

/** Busca o lead e recusa se ele já saiu do funil — o mesmo par de checagem
 *  que `moverEstagio`, `registrarProximaAcao` e `converterEmProposta`
 *  fariam cada um por conta própria. Centralizado para as três mensagens não
 *  divergirem sozinhas com o tempo. */
async function buscarLeadAberto(id: string) {
  const lead = await buscarLead(id);
  if (lead.propostaId) {
    throw new StaffAuthError(
      "FORBIDDEN",
      `${lead.nome} já foi convertido em proposta — mexer no estágio reabriria um funil que já fechou.`
    );
  }
  if (lead.perdidoEm) {
    throw new StaffAuthError(
      "FORBIDDEN",
      `${lead.nome} foi marcado como perdido — reabrir o funil esconderia por que ele saiu. Crie um lead novo se a conversa recomeçar.`
    );
  }
  return lead;
}

const MoverEstagioSchema = z.object({
  id: z.string().min(1),
  estagio: z.enum(ABERTOS as unknown as [Estagio, ...Estagio[]]),
});

export async function moverEstagio(
  input: z.input<typeof MoverEstagioSchema>
): Promise<Result<{ id: string; estagio: Estagio }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = MoverEstagioSchema.parse(input);
    const lead = await buscarLeadAberto(dados.id);

    if (lead.estagio === dados.estagio) {
      throw new StaffAuthError("FORBIDDEN", "O lead já está neste estágio.");
    }

    await database.$transaction(async (tx) => {
      // `updateMany` (não `update`) porque o `where` precisa carregar o
      // estado lido — duas submissões concorrentes que leram o mesmo lead
      // aberto não podem as duas passar: sem isto, a segunda sobrescreve o
      // estágio da primeira e ainda duplica a linha de histórico.
      const atualizado = await tx.lead.updateMany({
        where: {
          id: lead.id,
          tenantId: SYSTEM_TENANT_ID,
          estagio: lead.estagio,
          perdidoEm: null,
        },
        data: { estagio: dados.estagio, estagioDesde: new Date() },
      });
      if (atualizado.count === 0) {
        throw new StaffAuthError(
          "FORBIDDEN",
          "Lead mudou de estado; recarregue e tente de novo"
        );
      }
      await tx.historicoDeEstagio.create({
        data: {
          tenantId: SYSTEM_TENANT_ID,
          leadId: lead.id,
          de: lead.estagio,
          para: dados.estagio,
        },
      });
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "updated",
      entityType: "lead",
      entityId: lead.id,
      target: lead.nome,
      diff: [["estagio", lead.estagio, dados.estagio]],
    });

    revalidatePath("/funil");
    return { id: lead.id, estagio: dados.estagio };
  });
}

const ProximaAcaoSchema = z.object({
  id: z.string().min(1),
  proximaAcao: z.string().trim().min(1).max(200),
  proximaAcaoEm: z.coerce.date(),
});

export async function registrarProximaAcao(
  input: z.input<typeof ProximaAcaoSchema>
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = ProximaAcaoSchema.parse(input);
    const lead = await buscarLeadAberto(dados.id);

    await database.lead.update({
      where: { id: lead.id },
      data: {
        proximaAcao: dados.proximaAcao,
        proximaAcaoEm: dados.proximaAcaoEm,
      },
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "updated",
      entityType: "lead",
      entityId: lead.id,
      target: lead.nome,
      diff: [["proximaAcao", "—", dados.proximaAcao]],
    });

    revalidatePath("/funil");
    return { id: lead.id };
  });
}

const MOTIVOS_PERDA_CODIGOS = Object.keys(MOTIVOS_PERDA) as [
  MotivoPerda,
  ...MotivoPerda[],
];

const MarcarPerdidoSchema = z.object({
  id: z.string().min(1),
  motivo: z.enum(MOTIVOS_PERDA_CODIGOS),
  nota: z
    .string()
    .trim()
    .min(
      12,
      "Conte o que aconteceu — perda sem nota não ensina nada sobre preço nem ICP para o próximo."
    )
    .max(500),
});

/** Permitida também em PROPOSAL: recusa da proposta pelo funil. A proposta em
 *  si NÃO muda de status — quem decide isso é a tela de propostas. */
export async function marcarPerdido(
  input: z.input<typeof MarcarPerdidoSchema>
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = MarcarPerdidoSchema.parse(input);
    const lead = await buscarLead(dados.id);

    if (lead.perdidoEm) {
      throw new StaffAuthError(
        "FORBIDDEN",
        `${lead.nome} já foi marcado como perdido.`
      );
    }

    if (situacaoDe(null, lead.proposta?.status ?? null) === "GANHO") {
      throw new StaffAuthError(
        "FORBIDDEN",
        "Lead ganho não pode ser marcado como perdido"
      );
    }

    await database.$transaction(async (tx) => {
      // Mesma proteção de `moverEstagio`: o `where` carrega o estado lido, ou
      // duas chamadas concorrentes marcando o mesmo lead como perdido
      // duplicariam a linha de histórico.
      const atualizado = await tx.lead.updateMany({
        where: {
          id: lead.id,
          tenantId: SYSTEM_TENANT_ID,
          estagio: lead.estagio,
          perdidoEm: null,
        },
        data: {
          perdidoEm: new Date(),
          perdidoNoEstagio: lead.estagio,
          motivoPerda: dados.motivo,
          notaPerda: dados.nota,
        },
      });
      if (atualizado.count === 0) {
        throw new StaffAuthError(
          "FORBIDDEN",
          "Lead mudou de estado; recarregue e tente de novo"
        );
      }
      await tx.historicoDeEstagio.create({
        data: {
          tenantId: SYSTEM_TENANT_ID,
          leadId: lead.id,
          de: lead.estagio,
          para: "PERDIDO",
        },
      });
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "updated",
      entityType: "lead",
      entityId: lead.id,
      target: lead.nome,
      diff: [["perdido", "não", dados.motivo]],
    });

    revalidatePath("/funil");
    return { id: lead.id };
  });
}

const ConverterSchema = z.object({ id: z.string().min(1) });

/**
 * Converte o lead numa proposta em rascunho — só a partir de EVALUATION.
 *
 * Nasce sem item: quem escolhe o que vender é o gerador (`/propostas/<id>`),
 * não esta action — ela só fecha o elo comercial (funil → proposta) para
 * ninguém redigitar nome e e-mail do zero. O número vem de
 * `gerarNumeroProposta`, a mesma rotina de `createProposalAction`: dois
 * geradores de número para o mesmo tipo de documento seriam dois jeitos de
 * quebrar um identificador que aparece em contrato.
 */
export async function converterEmProposta(
  input: z.input<typeof ConverterSchema>
): Promise<Result<{ id: string; numero: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = ConverterSchema.parse(input);
    const lead = await buscarLeadAberto(dados.id);

    if (lead.estagio !== "EVALUATION") {
      throw new StaffAuthError(
        "FORBIDDEN",
        "Só é possível converter em proposta a partir de Avaliação."
      );
    }

    const numero = gerarNumeroProposta();

    const proposta = await database.$transaction(async (tx) => {
      const p = await tx.proposal.create({
        data: {
          tenantId: SYSTEM_TENANT_ID,
          numero,
          titulo: lead.nome,
          clienteNome: lead.nome,
          contatoEmail: lead.contatoEmail,
          criadoPorId: staff.userId,
          criadoPorNome: staff.name,
        },
        select: { id: true, numero: true },
      });

      // Mesma proteção de `moverEstagio`/`marcarPerdido`, mais `propostaId:
      // null`: sem ele, duas conversões concorrentes do mesmo lead as duas
      // passariam o `where` (o estágio ainda não mudou na leitura de
      // nenhuma) e criariam duas propostas para o mesmo lead. A proposta já
      // criada acima é desfeita pelo rollback da transação se isto recusar.
      const atualizado = await tx.lead.updateMany({
        where: {
          id: lead.id,
          tenantId: SYSTEM_TENANT_ID,
          estagio: lead.estagio,
          perdidoEm: null,
          propostaId: null,
        },
        data: {
          propostaId: p.id,
          estagio: "PROPOSAL",
          estagioDesde: new Date(),
        },
      });
      if (atualizado.count === 0) {
        throw new StaffAuthError(
          "FORBIDDEN",
          "Lead mudou de estado; recarregue e tente de novo"
        );
      }

      await tx.historicoDeEstagio.create({
        data: {
          tenantId: SYSTEM_TENANT_ID,
          leadId: lead.id,
          de: "EVALUATION",
          para: "PROPOSAL",
        },
      });

      return p;
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "converted",
      entityType: "lead",
      entityId: lead.id,
      target: `${lead.nome} → ${proposta.numero}`,
      diff: [["propostaId", "—", proposta.id]],
    });

    revalidatePath("/funil");
    revalidatePath("/propostas");
    return proposta;
  });
}
