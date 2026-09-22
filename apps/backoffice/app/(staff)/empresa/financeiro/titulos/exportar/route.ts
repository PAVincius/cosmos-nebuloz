import { database } from "@repo/database";
import {
  centavosParaCsv,
  paraCsv,
  respostaCsv,
  respostaDeFalha,
} from "@/lib/csv";
import {
  ROTULO_SITUACAO,
  ROTULO_TIPO,
  type Situacao,
  situacaoDoTitulo,
  type TituloRow,
} from "@/lib/empresa/livro";
import { formatarDataBr } from "@/lib/empresa/periodo";
import { requirePlatformStaff, SYSTEM_TENANT_ID } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** Mesmo teto da trilha: a carteira de títulos é pequena hoje, mas um GET
 *  sem teto é uma promessa que ninguém lembra de rever. */
const TETO_DA_EXPORTACAO = 5000;

const CABECALHO = [
  "Tipo",
  "Situação",
  "Descrição",
  "Contraparte",
  "Conta",
  "Valor (R$)",
  "Emissão",
  "Vencimento",
  "Baixado em",
  "Motivo do cancelamento",
  "Cliente",
];

const TIPOS = new Set<string>(["PAGAR", "RECEBER"]);
const SITUACOES = new Set<string>(Object.keys(ROTULO_SITUACAO));

/** Data de calendário ("2026-08-01") → "01/08/2026" sem passar por `Date`:
 *  meia-noite UTC no fuso do painel é o dia anterior. */
function dia(iso: string | null): string {
  return iso ? formatarDataBr(iso) : "";
}

/** A linha como a tela a lê (`TituloRow`), com as datas já de calendário. */
function paraLinha(t: {
  id: string;
  tipo: string;
  descricao: string;
  contraparte: string;
  conta: string;
  valorCentavos: number;
  emissao: Date;
  vencimento: Date;
  status: string;
  baixadoEm: Date | null;
  competenciaBaixa: string | null;
  motivoCancelamento: string | null;
  clienteSlug: string | null;
}): TituloRow {
  return {
    ...t,
    baixadoEm: t.baixadoEm ? t.baixadoEm.toISOString().slice(0, 10) : null,
    emissao: t.emissao.toISOString().slice(0, 10),
    status: t.status as TituloRow["status"],
    tipo: t.tipo as TituloRow["tipo"],
    vencimento: t.vencimento.toISOString().slice(0, 10),
  };
}

/**
 * CSV dos títulos a pagar e a receber.
 *
 * Filtros opcionais, os mesmos da tela: `?tipo=PAGAR|RECEBER` vai ao banco;
 * `?situacao=ABERTO|VENCIDO|BAIXADO|CANCELADO` é calculada como a tela
 * calcula (`situacaoDoTitulo` — vencido é aberto com vencimento passado, não
 * um status gravado). Valor fora do que a tela conhece é ignorado, não vira
 * consulta estranha no banco.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    await requirePlatformStaff();
    const params = new URL(request.url).searchParams;
    const tipo = params.get("tipo") ?? "";
    const situacao = params.get("situacao") ?? "";

    const titulos = await database.titulo.findMany({
      where: {
        tenantId: SYSTEM_TENANT_ID,
        ...(TIPOS.has(tipo) ? { tipo: tipo as TituloRow["tipo"] } : {}),
      },
      orderBy: { vencimento: "asc" },
      take: TETO_DA_EXPORTACAO,
      select: {
        id: true,
        tipo: true,
        descricao: true,
        contraparte: true,
        conta: true,
        valorCentavos: true,
        emissao: true,
        vencimento: true,
        status: true,
        baixadoEm: true,
        competenciaBaixa: true,
        motivoCancelamento: true,
        clienteSlug: true,
      },
    });

    const hoje = new Date();
    const linhas = titulos
      .map(paraLinha)
      .map((t) => ({ situacao: situacaoDoTitulo(t, hoje), t }))
      .filter(
        (l) => !SITUACOES.has(situacao) || l.situacao === (situacao as Situacao)
      )
      .map(({ situacao: s, t }) => [
        ROTULO_TIPO[t.tipo],
        ROTULO_SITUACAO[s],
        t.descricao,
        t.contraparte,
        t.conta,
        centavosParaCsv(t.valorCentavos),
        dia(t.emissao),
        dia(t.vencimento),
        dia(t.baixadoEm),
        t.motivoCancelamento,
        t.clienteSlug,
      ]);
    return respostaCsv("titulos", paraCsv(CABECALHO, linhas));
  } catch (erro) {
    return respostaDeFalha(erro);
  }
}
