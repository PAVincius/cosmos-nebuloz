/**
 * Teto e página das leituras de lista.
 *
 * Nenhuma listagem do painel sai do banco sem `take`. Sem isso, 1000 leads
 * viravam 1000 cards arrastáveis numa tela só, e a carteira crescia até o
 * navegador reclamar — o painel não tinha nenhum lugar em que a lista parava.
 *
 * O contrato das actions é compatível com o que já existia: chamada sem
 * opções devolve a lista de sempre (agora até o teto); chamada com
 * `{ pagina }` devolve `{ itens, temMais }`, que é o que a tela precisa para
 * mostrar "Mostrar mais". `Listagem<T, O>` é o tipo que escolhe entre as duas
 * formas a partir do argumento — uma função só, sem sobrecarga (módulo
 * `"use server"` só exporta função async; assinatura de sobrecarga não é
 * uma).
 *
 * A janela pede **um a mais** que a página: é o que diz se há próxima sem uma
 * segunda consulta de contagem — teto de requisição no banco, regra do repo.
 * A linha extra nunca chega à tela; `listagem` a corta.
 *
 * Mora fora de `app/actions/` porque o módulo `"use server"` não pode exportar
 * nada que não seja função async (mesmo motivo de `lib/client-queries.ts`).
 */

export const TETO_DA_LISTA = 100;

export type OpcoesDePagina = {
  /** 1-based. Abaixo de 1 vale 1. */
  pagina?: number;
  /** Até `TETO_DA_LISTA`; acima disso é cortado, abaixo de 1 vale 1. */
  porPagina?: number;
};

export type Pagina<T> = { itens: T[]; temMais: boolean };

/** Sem opções, a lista de sempre; com `{ pagina }`, a página e se há mais. */
export type Listagem<T, O> = O extends OpcoesDePagina ? Pagina<T> : T[];

function tamanhoDaPagina(opcoes?: OpcoesDePagina): number {
  return Math.min(
    Math.max(1, opcoes?.porPagina ?? TETO_DA_LISTA),
    TETO_DA_LISTA
  );
}

/** `skip`/`take` para o `findMany`. `take` é a página mais um — ver acima. */
export function janela(opcoes?: OpcoesDePagina): {
  skip: number;
  take: number;
} {
  const porPagina = tamanhoDaPagina(opcoes);
  const pagina = Math.max(1, opcoes?.pagina ?? 1);
  return { skip: (pagina - 1) * porPagina, take: porPagina + 1 };
}

/** Corta a linha extra: os itens da página e se há próxima. */
export function cortar<T>(linhas: T[], opcoes?: OpcoesDePagina): Pagina<T> {
  const porPagina = tamanhoDaPagina(opcoes);
  return {
    itens: linhas.slice(0, porPagina),
    temMais: linhas.length > porPagina,
  };
}

/** Escolhe a forma de devolver a partir do argumento — ver `Listagem`.
 *  `O | undefined` no parâmetro: a action recebe `opcoes?: O`, e sem isso a
 *  inferência distribuía o condicional e devolvia a união das duas formas. */
export function forma<T, O extends OpcoesDePagina | undefined>(
  pagina: Pagina<T>,
  opcoes: O | undefined
): Listagem<T, O> {
  return (opcoes === undefined ? pagina.itens : pagina) as Listagem<T, O>;
}

/** `cortar` + `forma`, para a action que devolve as linhas como leu. */
export function listagem<T, O extends OpcoesDePagina | undefined>(
  linhas: T[],
  opcoes: O | undefined
): Listagem<T, O> {
  return forma(cortar(linhas, opcoes), opcoes);
}

/**
 * Relê as páginas 1..N e concatena — para a tela que já carregou três
 * páginas não voltar à primeira depois de uma escrita. Em paralelo: N é
 * pequeno (quantas vezes a pessoa clicou em "Mostrar mais"), e cada leitura
 * continua limitada ao teto.
 */
export async function paginasCarregadas<T>(
  ler: (pagina: number) => Promise<Pagina<T>>,
  paginas: number
): Promise<Pagina<T>> {
  const lidas = await Promise.all(
    Array.from({ length: Math.max(1, paginas) }, (_, i) => ler(i + 1))
  );
  return {
    itens: lidas.flatMap((p) => p.itens),
    temMais: lidas.at(-1)?.temMais ?? false,
  };
}
