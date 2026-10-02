// Prazo do assessment: um dia do calendário de Brasília.
//
// O `<input type="date">` entrega "2026-11-01" e o servidor gravava essa string
// como meia-noite UTC, que em Brasília é 21h de 31/10: a tela mostrava um dia a
// menos e o link do respondente (que expira no deadline) morria 21h antes do que
// o consultor combinou. O prazo "01/11" vale até o fim de 01/11 em Brasília, e a
// exibição é sempre em Brasília, qualquer que seja o fuso do navegador.

export const FUSO_BRASILIA = "America/Sao_Paulo";

const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Brasília é UTC-3 o ano todo desde 2019 (o horário de verão acabou), então o
 *  deslocamento fixo basta. */
const OFFSET = "-03:00";

/** O último instante do dia, em Brasília, de uma data "AAAA-MM-DD". */
export function prazoDoDia(isoDate: string): Date {
  const parts = DIA.exec(isoDate);
  const d = new Date(`${isoDate}T23:59:59.999${OFFSET}`);
  const volta = Number.isNaN(d.getTime())
    ? null
    : new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_BRASILIA }).format(d);
  // A ida e volta pega "2026-02-30", que alguns motores rolam para março.
  if (!parts || volta !== isoDate) {
    throw new Error(`Prazo inválido: ${isoDate}`);
  }
  return d;
}

/** Entrada do formulário: "AAAA-MM-DD" vira o fim do dia em Brasília; qualquer
 *  outra coisa (ISO com hora, Date) segue como antes. Inválido vira Invalid
 *  Date, para o schema recusar com mensagem. */
export function prazoDeEntrada(v: string | Date): Date {
  if (typeof v === "string" && DIA.test(v)) {
    try {
      return prazoDoDia(v);
    } catch {
      return new Date(Number.NaN);
    }
  }
  return new Date(v);
}

/** "01/11/2026" — o dia de Brasília, não o do navegador. */
export const formatarPrazo = (d: Date | string): string =>
  new Date(d).toLocaleDateString("pt-BR", { timeZone: FUSO_BRASILIA });
