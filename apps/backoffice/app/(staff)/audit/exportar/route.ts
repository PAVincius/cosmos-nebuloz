import { database } from "@repo/database";
import {
  filtroDaUrl,
  montarWhere,
  paraEventoRow,
  SELECT_EVENTO,
} from "@/lib/audit-filtro";
import { paraCsv, respostaCsv, respostaDeFalha } from "@/lib/csv";
import { formatarDataHora } from "@/lib/data";
import { requirePlatformStaff } from "@/lib/guard";
import { ACOES, ENTIDADES } from "../rotulos";

export const dynamic = "force-dynamic";

/** Teto do arquivo. Alto porque exportar é levar o filtro inteiro, não uma
 *  página; finito porque o AuditLog não para de crescer e um GET sem teto
 *  vira a consulta mais cara do painel no dia em que alguém esquece o
 *  filtro. */
const TETO_DA_EXPORTACAO = 5000;

const CABECALHO = ["Quando", "Cliente", "Ação", "Entidade", "Alvo", "Autor"];

/**
 * CSV da Trilha de auditoria com o filtro da tela (`?tenant=&acao=&entidade=
 * &de=&ate=`), nos rótulos que a tela mostra para ação e entidade — a
 * planilha diz o mesmo que a lista. A página da tela (`?pagina=`) fica de
 * fora de propósito: quem exporta quer o filtro, não os 50 que estavam à
 * vista.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    await requirePlatformStaff();
    const filtro = filtroDaUrl(new URL(request.url).searchParams);

    const eventos = await database.auditLog.findMany({
      where: montarWhere(filtro),
      orderBy: { createdAt: "desc" },
      take: TETO_DA_EXPORTACAO,
      select: SELECT_EVENTO,
    });

    const linhas = eventos
      .map(paraEventoRow)
      .map((e) => [
        formatarDataHora(e.quando),
        e.tenantSlug,
        ACOES[e.action] ?? e.action,
        e.entityType ? (ENTIDADES[e.entityType] ?? e.entityType) : null,
        e.alvo,
        e.ator,
      ]);
    return respostaCsv("trilha-de-auditoria", paraCsv(CABECALHO, linhas));
  } catch (erro) {
    return respostaDeFalha(erro);
  }
}
