/**
 * Período por intervalo (spec 2026-09-06 §1–§3).
 *
 * O usuário escolhe dias; as leituras usam os meses tocados (DRE, CAC) ou as
 * segundas-feiras contidas (caixa). Tetos recusam com erro nomeado — truncar
 * em silêncio mostraria um total de menos meses com cara de total.
 */
import { z } from "zod";
import { segundaFeira } from "./financeiro";

export type Intervalo = { de: string; ate: string };
export type Preset = {
  id: string;
  rotulo: string;
  intervalo: (hoje: Date) => Intervalo;
};

export const TETO_MESES = 12;
export const TETO_SEMANAS = 26;

export class IntervaloExcedido extends Error {
  constructor(teto: number, unidade: "meses" | "semanas") {
    super(`O intervalo passa de ${teto} ${unidade}. Escolha um período menor.`);
    this.name = "IntervaloExcedido";
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DIA_MS = 86_400_000;

export function utc(isoData: string): Date {
  return new Date(`${isoData}T00:00:00Z`);
}
export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "Hoje" no relógio de quem chama, formato ISO — valor inicial de campo de
 *  data em diálogo de criação (lançamento, título). Cópia única: morava
 *  duplicada em `lancamento-dialog.tsx` e `titulo-dialogs.tsx`. */
export function hojeIso(): string {
  return iso(new Date());
}

/** Competência ("AAAA-MM") de hoje — os 7 primeiros caracteres de `hojeIso()`. */
export function competenciaAtual(): string {
  return hojeIso().slice(0, 7);
}

function dataValida(s: string): boolean {
  return ISO.test(s) && iso(utc(s)) === s;
}

export function intervaloValido(i: unknown): i is Intervalo {
  if (typeof i !== "object" || i === null) {
    return false;
  }
  const { de, ate } = i as Record<string, unknown>;
  return (
    typeof de === "string" &&
    typeof ate === "string" &&
    dataValida(de) &&
    dataValida(ate) &&
    de <= ate
  );
}

/** Schema do intervalo para as actions (Task 5, Task 6): datas ISO e `de <= ate`. */
export const IntervaloSchema = z
  .object({ de: z.iso.date(), ate: z.iso.date() })
  .refine(intervaloValido, "Intervalo inválido.");

/** As duas peças do intervalo para as actions de escrita: `ZodEffects` (o
 *  resultado de `.refine`) não tem `.shape`, então `IntervaloSchema` sozinho
 *  não é spreadable — cada schema de escrita espalha `CAMPOS_INTERVALO` no seu
 *  próprio `z.object` e aplica `REFINE_INTERVALO` por cima (ponytail 2). */
export const CAMPOS_INTERVALO = { de: z.iso.date(), ate: z.iso.date() };
export const REFINE_INTERVALO = [
  intervaloValido,
  "Intervalo inválido.",
] as const;

export function competenciasNoIntervalo(i: Intervalo): string[] {
  const [a1, m1] = i.de.split("-").map(Number);
  const [a2, m2] = i.ate.split("-").map(Number);
  const total = (a2 - a1) * 12 + (m2 - m1) + 1;
  if (total > TETO_MESES) {
    throw new IntervaloExcedido(TETO_MESES, "meses");
  }
  return Array.from({ length: total }, (_, k) => {
    const d = new Date(Date.UTC(a1, m1 - 1 + k, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
      2,
      "0"
    )}`;
  });
}

export function segundasNoIntervalo(i: Intervalo): string[] {
  const primeira = utc(segundaFeira(utc(i.de)));
  const fim = utc(i.ate);
  const out: string[] = [];
  for (let d = primeira; d <= fim; d = new Date(d.getTime() + 7 * DIA_MS)) {
    out.push(iso(d));
    if (out.length > TETO_SEMANAS) {
      throw new IntervaloExcedido(TETO_SEMANAS, "semanas");
    }
  }
  return out;
}

function inicioDoMes(ano: number, mes0: number): string {
  return iso(new Date(Date.UTC(ano, mes0, 1)));
}
function fimDoMes(ano: number, mes0: number): string {
  return iso(new Date(Date.UTC(ano, mes0 + 1, 0)));
}

/** Primeiro e último dia de uma competência "AAAA-MM" — o link da célula do
 *  DRE para a aba Lançamentos usa isto, não uma conta de dias reimplementada. */
export function intervaloDaCompetencia(competencia: string): Intervalo {
  const [ano, mes] = competencia.split("-").map(Number);
  return {
    de: inicioDoMes(ano, mes - 1),
    ate: fimDoMes(ano, mes - 1),
  };
}

export function intervaloPadraoCompetencia(hoje: Date): Intervalo {
  const a = hoje.getUTCFullYear();
  const m = hoje.getUTCMonth();
  return { de: inicioDoMes(a, m - 2), ate: fimDoMes(a, m) };
}

export function intervaloPadraoCaixa(hoje: Date): Intervalo {
  const de = segundaFeira(hoje);
  const ate = new Date(utc(de).getTime() + (13 * 7 - 1) * DIA_MS);
  return { de, ate: iso(ate) };
}

export const PRESETS_COMPETENCIA: Preset[] = [
  {
    id: "este-mes",
    rotulo: "Este mês",
    intervalo: (h) => ({
      de: inicioDoMes(h.getUTCFullYear(), h.getUTCMonth()),
      ate: fimDoMes(h.getUTCFullYear(), h.getUTCMonth()),
    }),
  },
  {
    id: "mes-passado",
    rotulo: "Mês passado",
    intervalo: (h) => ({
      de: inicioDoMes(h.getUTCFullYear(), h.getUTCMonth() - 1),
      ate: fimDoMes(h.getUTCFullYear(), h.getUTCMonth() - 1),
    }),
  },
  {
    id: "ultimos-3-meses",
    rotulo: "Últimos 3 meses",
    intervalo: intervaloPadraoCompetencia,
  },
  {
    id: "trimestre-atual",
    rotulo: "Trimestre atual",
    intervalo: (h) => {
      const inicio = Math.floor(h.getUTCMonth() / 3) * 3;
      return {
        de: inicioDoMes(h.getUTCFullYear(), inicio),
        ate: fimDoMes(h.getUTCFullYear(), inicio + 2),
      };
    },
  },
  {
    id: "este-ano",
    rotulo: "Este ano",
    intervalo: (h) => ({
      de: inicioDoMes(h.getUTCFullYear(), 0),
      ate: fimDoMes(h.getUTCFullYear(), 11),
    }),
  },
];

export const PRESETS_CAIXA: Preset[] = [
  {
    id: "proximas-13",
    rotulo: "Próximas 13 semanas",
    intervalo: intervaloPadraoCaixa,
  },
  {
    id: "proximas-26",
    rotulo: "Próximas 26 semanas",
    intervalo: (h) => {
      const de = segundaFeira(h);
      return {
        de,
        ate: iso(new Date(utc(de).getTime() + (26 * 7 - 1) * DIA_MS)),
      };
    },
  },
  {
    id: "este-trimestre",
    rotulo: "Este trimestre",
    intervalo: (h) => {
      const inicio = Math.floor(h.getUTCMonth() / 3) * 3;
      return {
        de: inicioDoMes(h.getUTCFullYear(), inicio),
        ate: fimDoMes(h.getUTCFullYear(), inicio + 2),
      };
    },
  },
];

export function formatarDataBr(isoData: string): string {
  const [a, m, d] = isoData.split("-");
  return `${d}/${m}/${a}`;
}

export function rotuloDoIntervalo(
  i: Intervalo,
  presets: Preset[],
  hoje: Date
): string {
  const p = presets.find((x) => {
    const r = x.intervalo(hoje);
    return r.de === i.de && r.ate === i.ate;
  });
  return p ? p.rotulo : `${formatarDataBr(i.de)} – ${formatarDataBr(i.ate)}`;
}

export function lerIntervaloDaUrl(
  params: { de?: string; ate?: string },
  padrao: Intervalo
): Intervalo {
  const candidato = { de: params.de, ate: params.ate };
  return intervaloValido(candidato) ? candidato : padrao;
}
