"use server";

import { database } from "@repo/database";
import { requirePlatformStaff } from "@/lib/guard";
import {
  DIAS_PARA_RENOVACAO,
  DIAS_SEM_ATIVIDADE,
  diasAte,
  resumir,
  type Saude,
  type SinalDeSaude,
} from "@/lib/health";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Health e renovação por cliente.
 *
 * **Saúde é derivada, não armazenada.** Não existe campo `health` no schema de
 * propósito: um campo marcado à mão envelhece no dia em que alguém esquece de
 * atualizar, e um painel de renovação mostrando "saudável" sobre dado velho é
 * pior que um painel vazio — dá confiança onde não há informação.
 *
 * Os sinais são os que a plataforma já grava: status de módulo, data de
 * expiração, integração com erro e recência de atividade. Cada um vira uma
 * frase, nunca um número: "score 42" não diz a ninguém o que fazer em seguida.
 *
 * Isto **não** é o `Account` do schema, que é a credencial do better-auth.
 * Nome parecido, assunto nenhum em comum.
 */

const MODULO_QUEBRADO = new Set(["SUSPENDED", "CANCELED"]);

export type ContaComSaude = {
  slug: string;
  nome: string;
  plano: string;
  saude: Saude;
  sinais: SinalDeSaude[];
  /** Renovação mais próxima entre os módulos ativos. */
  renovaEm: string | null;
  diasParaRenovar: number | null;
  ultimaAtividade: string | null;
  modulos: { module: string; status: string }[];
};

/** Ordem de exibição: pior primeiro. A tela existe para achar quem precisa de
 *  um telefonema, e ordem alfabética obrigaria a varrer a lista. */
const PESO: Record<Saude, number> = {
  RISCO: 0,
  ATENCAO: 1,
  SEM_SINAL: 2,
  OK: 3,
};

/** "1 dia" / "12 dias" — o sinal é lido em voz alta numa reunião de
 *  renovação, e plural entre parênteses não se lê. */
function dias(n: number): string {
  return n === 1 ? "1 dia" : `${n} dias`;
}

/** Sinais que vêm dos módulos: status quebrado e renovação. */
function sinaisDeModulo(
  modulos: { module: string; status: string; expiresAt: Date | null }[],
  hoje: Date
): { sinais: SinalDeSaude[]; renovaEm: Date | null } {
  const sinais: SinalDeSaude[] = [];

  for (const m of modulos) {
    if (MODULO_QUEBRADO.has(m.status)) {
      sinais.push({
        nivel: "RISCO",
        texto: `Módulo ${m.module} está ${m.status === "SUSPENDED" ? "suspenso" : "cancelado"}.`,
      });
    }
  }

  // A renovação que importa é a mais próxima entre os módulos que ainda valem:
  // um módulo já cancelado não tem renovação a defender.
  const proximas = modulos
    .filter((m) => !MODULO_QUEBRADO.has(m.status) && m.expiresAt)
    .map((m) => m.expiresAt as Date)
    .sort((a, b) => a.getTime() - b.getTime());
  const renovaEm = proximas[0] ?? null;

  if (renovaEm) {
    const faltam = diasAte(renovaEm, hoje);
    if (faltam < 0) {
      sinais.push({
        nivel: "RISCO",
        texto: `Renovação venceu há ${dias(Math.abs(faltam))} e o módulo segue ativo.`,
      });
    } else if (faltam <= DIAS_PARA_RENOVACAO) {
      sinais.push({
        nivel: "ATENCAO",
        texto: `Renova em ${dias(faltam)}.`,
      });
    }
  }

  return { sinais, renovaEm };
}

/** Junta os sinais de um cliente. Fora do map porque é aqui que a decisão
 *  mora, e ela merece ser lida de uma vez. */
function avaliar(
  cliente: {
    id: string;
    slug: string;
    name: string;
    plan: string;
    modules: { module: string; status: string; expiresAt: Date | null }[];
  },
  integracoesComErro: { tenantId: string; name: string }[],
  ultima: Date | null,
  hoje: Date
): ContaComSaude {
  const { sinais, renovaEm } = sinaisDeModulo(cliente.modules, hoje);

  for (const i of integracoesComErro) {
    sinais.push({
      nivel: "ATENCAO",
      texto: `Integração ${i.name} está com erro.`,
    });
  }

  if (ultima) {
    const parado = -diasAte(ultima, hoje);
    if (parado >= DIAS_SEM_ATIVIDADE) {
      sinais.push({
        nivel: "ATENCAO",
        texto: `Sem atividade registrada há ${parado} dias.`,
      });
    }
  }

  return {
    slug: cliente.slug,
    nome: cliente.name,
    plano: cliente.plan,
    // "Tem dado" é ter módulo contratado. Cliente sem módulo nenhum não é
    // saudável — é um cliente sobre o qual não se sabe nada.
    saude: resumir(sinais, cliente.modules.length > 0),
    sinais,
    renovaEm: renovaEm ? renovaEm.toISOString() : null,
    diasParaRenovar: renovaEm ? diasAte(renovaEm, hoje) : null,
    ultimaAtividade: ultima ? ultima.toISOString() : null,
    modulos: cliente.modules.map((m) => ({
      module: m.module,
      status: m.status,
    })),
  };
}

export async function listAccountHealth(
  agora?: Date
): Promise<Result<ContaComSaude[]>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    // A data entra por parâmetro para o teste não depender do relógio de quem
    // roda — um limiar de "30 dias" fica impossível de testar sem isso.
    const hoje = agora ?? new Date();

    const [clientes, integracoes, eventos] = await Promise.all([
      database.tenant.findMany({
        where: { isSystem: false },
        orderBy: { name: "asc" },
        select: {
          id: true,
          slug: true,
          name: true,
          plan: true,
          modules: {
            select: { module: true, status: true, expiresAt: true },
          },
        },
      }),
      database.integration.findMany({
        where: { status: "ERROR" },
        select: { tenantId: true, name: true, status: true },
      }),
      // Agregação no banco, uma linha por cliente.
      //
      // A versão anterior trazia os 2000 eventos mais recentes e reduzia aqui.
      // Funcionava com a base pequena e **passava a mentir** quando ela
      // crescesse: acima de ~2000 eventos, os clientes menos ativos deixavam
      // de caber na amostra, o mapa devolvia `undefined`, e o health afirmava
      // SEM_SINAL sobre cliente ativo.
      //
      // O sintoma não seria lentidão — seria a tela dizendo com confiança o
      // oposto da verdade, sem erro, sem log, sem métrica. Alguém ligaria para
      // o cliente errado e não ligaria para o certo.
      //
      // Aumentar o `take` não resolvia: só adiava, e adiava sem aviso.
      database.auditLog.groupBy({
        by: ["tenantId"],
        _max: { createdAt: true },
      }),
    ]);

    // Agora "não veio na resposta" e "nunca teve atividade" são a mesma coisa —
    // e isso é verdade. Antes, "não coube na amostra" caía no mesmo lugar.
    const ultimaPorTenant = new Map<string, Date>();
    for (const e of eventos) {
      if (e._max.createdAt) {
        ultimaPorTenant.set(e.tenantId, e._max.createdAt);
      }
    }

    const linhas = clientes.map((c) =>
      avaliar(
        c,
        integracoes.filter((x) => x.tenantId === c.id),
        ultimaPorTenant.get(c.id) ?? null,
        hoje
      )
    );

    return linhas.sort((a, b) => PESO[a.saude] - PESO[b.saude]);
  });
}
