// data.ts — formatação de data/hora do painel, sempre no mesmo fuso.
//
// Antes cada tela chamava `toLocaleString("pt-BR")` sem `timeZone`: em Server
// Component na Vercel (UTC) a trilha de auditoria saía 3h adiantada; em Client
// Component o servidor e o navegador formatavam diferente e a hidratação
// quebrava. Fixar o fuso resolve os dois de uma vez.

// Fixo porque a operação é da equipe Nebuloz no Brasil; fuso por operador é decisão futura.
export const FUSO_DO_PAINEL = "America/Sao_Paulo";

const VAZIO = "—";

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_DO_PAINEL,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const soData = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_DO_PAINEL,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const soHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_DO_PAINEL,
  hour: "2-digit",
  minute: "2-digit",
});

type Entrada = string | Date | null | undefined;

function paraDate(valor: Entrada): Date | null {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }
  const data = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

/** dd/mm/aaaa hh:mm no fuso do painel; "—" para vazio ou inválido. */
export function formatarDataHora(valor: Entrada): string {
  const data = paraDate(valor);
  // `pt-BR` separa data e hora com vírgula ("18/09/2026, 23:30"); o painel usa espaço.
  return data ? dataHora.format(data).replace(",", "") : VAZIO;
}

/** dd/mm/aaaa no fuso do painel; "—" para vazio ou inválido. */
export function formatarData(valor: Entrada): string {
  const data = paraDate(valor);
  return data ? soData.format(data) : VAZIO;
}

/** hh:mm no fuso do painel; "—" para vazio ou inválido. */
export function formatarHora(valor: Entrada): string {
  const data = paraDate(valor);
  return data ? soHora.format(data) : VAZIO;
}
