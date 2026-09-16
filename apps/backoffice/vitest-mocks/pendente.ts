import { afterEach } from "vitest";

/**
 * Promessa "pendente durante o teste" para observar o estado de envio.
 *
 * Uma promessa que nunca resolve seria mais simples, mas o React 19 entrelaça
 * as ações assíncronas de `useTransition`: uma que fica em aberto num teste
 * segura o `isPending` das transições dos testes seguintes no mesmo arquivo,
 * e o botão que deveria voltar a "Sem alterações" fica em "Salvando…" para
 * sempre. Cada pendente registrada aqui é encerrada no `afterEach`, com um
 * erro inofensivo — o componente já foi desmontado ou só mostra o erro.
 */

const abertas: Array<(valor: unknown) => void> = [];

/** Promessa que só resolve ao fim do teste corrente. */
export function pendenteAteOFim<T = never>(): Promise<T> {
  return new Promise<T>((resolve) => {
    abertas.push(resolve as (valor: unknown) => void);
  });
}

afterEach(() => {
  for (const resolver of abertas.splice(0)) {
    resolver({ ok: false, error: "encerrado pelo teste" });
  }
});
