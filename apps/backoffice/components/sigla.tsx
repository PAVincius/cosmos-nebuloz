/**
 * Sigla com o significado ao alcance: `<abbr title>` sempre, e a expansão
 * escrita ao lado na primeira vez que a tela usa a sigla.
 *
 * ACV, MRR, ARR e DPA apareciam nos rótulos de KPI sem expansão em lugar
 * nenhum. O `GlossaryTip` do kit não serve aqui: só conhece termos SAFe e só
 * abre no mouse — quem navega por teclado nunca o veria. `title` sozinho tem
 * o mesmo defeito; por isso a expansão visível na primeira ocorrência, e o
 * `title` fica para as seguintes.
 */
export function Sigla({
  sigla,
  significado,
  expandida = false,
}: {
  sigla: string;
  significado: string;
  /** Escreve o significado ao lado — para a primeira ocorrência na tela. */
  expandida?: boolean;
}) {
  return (
    <>
      <abbr style={{ textDecoration: "none" }} title={significado}>
        {sigla}
      </abbr>
      {expandida ? ` (${significado})` : null}
    </>
  );
}
