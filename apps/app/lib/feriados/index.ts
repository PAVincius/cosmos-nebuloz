/**
 * Feriados nacionais brasileiros, do BrasilAPI.
 *
 * Existe porque `businessDaysBetween()` em `lib/charter/rules.ts` conta só
 * sábado e domingo, e o próprio comentário de lá registrava a lacuna: "feriado
 * não entra". Num produto de governança o SLA é promessa ao cliente — dizer
 * "vence em 2 dias" numa semana de Carnaval é errar a promessa, não arredondar.
 *
 * ESCOPO: só feriado NACIONAL. Municipal e estadual exigiriam a geografia do
 * tenant, que o schema não modela — e inventar um campo de UF para isto seria
 * modelar geografia inteira por causa de um contador de dias. Fica de fora, e
 * fica dito.
 *
 * FALHA MACIA POR OBRIGAÇÃO: qualquer erro — rede, 500, payload estranho —
 * devolve conjunto vazio, e aí o cálculo volta a ser exatamente o de hoje
 * (só fim de semana). Uma API pública de terceiro, sem SLA e sem contrato, não
 * pode derrubar a tela de SLA do Charter. Degradar é a única opção aceitável:
 * a alternativa seria um caso de uso sem prazo visível porque um serviço
 * gratuito piscou.
 *
 * LGPD: não sai dado nenhum daqui. A requisição leva um ano no path e mais
 * nada — sem CNPJ, sem e-mail, sem identificador de tenant. É a razão de este
 * ser o primeiro consumo de API externa a entrar: não gera transferência de
 * dado pessoal e portanto não abre linha nova no ROPA.
 */

const BRASIL_API = "https://brasilapi.com.br/api/feriados/v1";

/** Feriado já publicado não muda. 30 dias é conservador e ainda assim significa
 *  ~12 requisições por ano por região da Vercel. */
const REVALIDATE_SEGUNDOS = 60 * 60 * 24 * 30;

const VAZIO: ReadonlySet<string> = new Set<string>();

type FeriadoBrasilApi = { date?: unknown; name?: unknown };

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` em UTC.
 *
 *  UTC, e não horário de Brasília, porque `businessDaysBetween()` já decidiu
 *  UTC quando nasceu. Misturar os dois deslocaria o SLA em um dia para toda
 *  data perto da meia-noite — um bug que só aparece em produção, à noite. */
export function diaUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parse(payload: unknown): string[] {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload
    .map((f: FeriadoBrasilApi) => f?.date)
    .filter((d): d is string => typeof d === "string" && DATA_ISO.test(d));
}

/** Feriados de um ano, como conjunto de `YYYY-MM-DD`. Vazio se a API falhar. */
export async function feriadosDoAno(ano: number): Promise<ReadonlySet<string>> {
  try {
    const r = await fetch(`${BRASIL_API}/${ano}`, {
      next: { revalidate: REVALIDATE_SEGUNDOS, tags: ["feriados"] },
    });
    if (!r.ok) {
      return VAZIO;
    }
    return new Set(parse(await r.json()));
  } catch {
    // Silencioso de propósito: o chamador não tem o que fazer com este erro, e
    // o comportamento degradado é indistinguível do comportamento anterior.
    return VAZIO;
  }
}

/**
 * Feriados que caem entre duas datas, cobrindo a virada de ano.
 *
 * Busca por ano e não por intervalo porque é assim que a API é indexada — e
 * porque ano inteiro é o que se pode cachear por trinta dias sem pensar.
 */
export async function feriadosNoIntervalo(
  de: Date,
  ate: Date
): Promise<ReadonlySet<string>> {
  const primeiro = de.getUTCFullYear();
  const ultimo = ate.getUTCFullYear();
  if (ultimo < primeiro) {
    return VAZIO;
  }

  const anos = Array.from(
    { length: ultimo - primeiro + 1 },
    (_, i) => primeiro + i
  );
  const conjuntos = await Promise.all(anos.map(feriadosDoAno));
  return new Set(conjuntos.flatMap((c) => [...c]));
}

/**
 * A janela que todo cálculo de SLA aberto precisa: do ano passado até hoje.
 *
 * Existe para os chamadores não repetirem a mesma aritmética de datas em três
 * actions — e porque a resposta certa não é óbvia. O ano anterior entra porque
 * um caso submetido em dezembro é lido em janeiro, e sem ele o Natal sumiria da
 * conta exatamente na virada.
 */
export function feriadosAbertos(
  agora: Date = new Date()
): Promise<ReadonlySet<string>> {
  const umAnoAtras = new Date(agora);
  umAnoAtras.setUTCFullYear(umAnoAtras.getUTCFullYear() - 1);
  return feriadosNoIntervalo(umAnoAtras, agora);
}
