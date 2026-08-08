import { CronExpressionParser } from "cron-parser";

/**
 * Decide se um relatório agendado venceu. Módulo puro de propósito: a regra
 * é aritmética de data e não deve exigir banco nem Inngest para ser testada.
 *
 * A comparação é contra o **disparo anterior**, não contra "lastRunAt + N".
 * Somar intervalo acumula deriva: uma varredura atrasada empurra o próximo
 * disparo para frente, e um relatório das 08:00 vira das 08:07 em uma semana.
 */

export type ScheduleInput = {
  cronExpression: string;
  timezone: string;
  lastRunAt: Date | null;
};

/**
 * O instante do disparo mais recente já vencido, ou `null` se a expressão ou
 * o timezone forem inválidos. Nunca lança: um relatório mal configurado não
 * pode derrubar a varredura dos outros.
 */
export function previousFireTime(
  input: Pick<ScheduleInput, "cronExpression" | "timezone">,
  now: Date
): Date | null {
  try {
    const interval = CronExpressionParser.parse(input.cronExpression, {
      currentDate: now,
      tz: input.timezone,
    });
    return interval.prev().toDate();
  } catch {
    return null;
  }
}

export function isDue(input: ScheduleInput, now: Date): boolean {
  const anterior = previousFireTime(input, now);
  if (!anterior) {
    return false;
  }
  if (!input.lastRunAt) {
    return true;
  }
  return input.lastRunAt.getTime() < anterior.getTime();
}
