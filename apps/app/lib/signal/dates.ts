// Datas do Signal.
//
// Dois tipos de data passam pelo módulo e eles NÃO se formatam igual:
//
//   • dia de calendário — início e fim de período, janela de observação. São
//     gravados como meia-noite UTC e não têm hora. Formatados no fuso do
//     navegador (BRT = UTC−3), "1º de julho" vira "30 de junho": a tela mostra
//     um período que começa um dia antes do que o financeiro fechou.
//   • instante — quando o alerta abriu, quem mudou a régua às 14h. Esses têm
//     hora, e o fuso local é o certo.
//
// Confundir os dois é o bug mais fácil de cometer e o mais difícil de ver,
// porque só aparece em quem está a oeste de Greenwich — que é todo mundo aqui.

const DAY: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
};

/** "30 de jun. de 2026" — dia de calendário, imune ao fuso do navegador. */
export function fmtDay(d: Date | string): string {
  return new Date(d).toLocaleDateString("pt-BR", DAY);
}

/** "30/06/2026" — o mesmo dia, curto, para cadeias monoespaçadas. */
export function fmtDayShort(d: Date | string): string {
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/** "06 de jul." — dia sem ano, para listas em que o ano é óbvio. */
export function fmtDayNoYear(d: Date | string): string {
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

/** "20 de ago., 14:00" — instante, no fuso de quem lê. */
export function fmtWhen(d: Date | string): string {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
