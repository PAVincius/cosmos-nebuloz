"use server";

import { database } from "@repo/database";
import { requirePlatformStaff, SYSTEM_TENANT_ID } from "@/lib/guard";
import {
  cortar,
  janela,
  type OpcoesDePagina,
  TETO_DA_LISTA,
} from "@/lib/paginacao";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Benchmark: comparação entre clientes e entre serviços.
 *
 * Não tem entidade própria — agrega Engagement, Proposal e Service. O que
 * decide a conclusão de quem lê a tela não é a soma, é **o que entra na soma**,
 * e é por isso que os cortes abaixo têm teste.
 *
 * Leitura pura: sem `assertCanWrite`.
 */

/** Contrato que virou (ou vai virar) dinheiro. Cancelado fora: somá-lo infla o
 *  número e faz a comparação mentir a favor de quem mais cancelou. */
const ENGAJAMENTO_CONTA = new Set(["ATIVO", "CONCLUIDO", "PAUSADO"]);

/** Proposta que descreve o que foi PRATICADO. Recusada fora: ela diz o que a
 *  Nebuloz ofereceu, não o que o cliente aceitou. */
const PROPOSTA_CONTA = new Set(["ENVIADA", "ACEITA"]);

export type ClienteBenchmark = {
  slug: string;
  nome: string;
  engajamentos: number;
  receitaCentavos: number;
  ticketCentavos: number;
  descontoMedio: number;
};

export type ServicoBenchmark = {
  codigo: string;
  nome: string;
  engajamentos: number;
  receitaCentavos: number;
};

export type Benchmark = {
  clientes: ClienteBenchmark[];
  servicos: ServicoBenchmark[];
  /** Há clientes além dos desta página — a tela diz que a comparação é
   *  parcial e oferece a próxima. */
  temMaisClientes: boolean;
};

/** Média inteira que não estoura em lista vazia. Sem esta guarda o ticket de
 *  quem não tem engajamento sai NaN e a tela mostra "NaN" para o operador. */
function media(total: number, quantidade: number): number {
  return quantidade === 0 ? 0 : Math.round(total / quantidade);
}

/**
 * A página de clientes (até o teto de `lib/paginacao.ts`) e as agregações
 * sobre ela: engajamentos e propostas são lidos só dos clientes da página,
 * então nenhuma das quatro leituras cresce com a base inteira. O custo é que,
 * quando há mais de uma página, "por serviço" soma o que os clientes desta
 * página compraram — e a tela diz isso, em vez de somar tudo em silêncio.
 */
export async function listBenchmark(
  opcoes?: OpcoesDePagina
): Promise<Result<Benchmark>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const pagina = cortar(
      await database.tenant.findMany({
        // O tenant interno não é cliente — compará-lo com os outros não
        // significa nada.
        where: { isSystem: false },
        orderBy: { name: "asc" },
        ...janela(opcoes),
        select: { id: true, slug: true, name: true },
      }),
      opcoes
    );
    const clientes = pagina.itens;
    const ids = clientes.map((c) => c.id);

    const [engajamentos, propostas, servicos] = await Promise.all([
      database.engagement.findMany({
        where: { tenantId: SYSTEM_TENANT_ID, clienteTenantId: { in: ids } },
        select: {
          clienteTenantId: true,
          status: true,
          valorCentavos: true,
          serviceId: true,
        },
      }),
      database.proposal.findMany({
        where: { tenantId: SYSTEM_TENANT_ID, clienteTenantId: { in: ids } },
        select: { clienteTenantId: true, status: true, descontoPercent: true },
      }),
      database.service.findMany({
        where: { tenantId: SYSTEM_TENANT_ID },
        orderBy: { codigo: "asc" },
        take: TETO_DA_LISTA,
        select: { id: true, codigo: true, nome: true },
      }),
    ]);

    const valem = engajamentos.filter((e) => ENGAJAMENTO_CONTA.has(e.status));
    const praticadas = propostas.filter((p) => PROPOSTA_CONTA.has(p.status));

    const linhasDeCliente = clientes.map((c) => {
      const meus = valem.filter((e) => e.clienteTenantId === c.id);
      const receita = meus.reduce((s, e) => s + e.valorCentavos, 0);
      const minhas = praticadas.filter((p) => p.clienteTenantId === c.id);
      const descontos = minhas.reduce((s, p) => s + p.descontoPercent, 0);

      return {
        slug: c.slug,
        nome: c.name,
        // Cliente sem engajamento fica na lista com zero. Sumir com quem não
        // comprou esconderia justamente o achado que a tela existe para dar.
        engajamentos: meus.length,
        receitaCentavos: receita,
        ticketCentavos: media(receita, meus.length),
        descontoMedio: media(descontos, minhas.length),
      };
    });

    const linhasDeServico = servicos.map((s) => {
      const meus = valem.filter((e) => e.serviceId === s.id);
      return {
        codigo: s.codigo,
        nome: s.nome,
        engajamentos: meus.length,
        receitaCentavos: meus.reduce((soma, e) => soma + e.valorCentavos, 0),
      };
    });

    return {
      // Maior receita primeiro: a pergunta que abre esta tela é "quem pesa
      // mais", e ordenar por nome obrigaria a varrer a lista para responder.
      clientes: linhasDeCliente.sort(
        (a, b) => b.receitaCentavos - a.receitaCentavos
      ),
      servicos: linhasDeServico.sort(
        (a, b) => b.receitaCentavos - a.receitaCentavos
      ),
      temMaisClientes: pagina.temMais,
    };
  });
}
