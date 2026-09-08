import { Carregando } from "@/components/carregando";

/**
 * Esqueleto padrão de todas as telas do grupo `(staff)`.
 *
 * No grupo, e não copiado em cada rota, por dois motivos. Um: das quinze rotas
 * `force-dynamic`, nove têm a mesma forma — cabeçalho e cartões —, e nove
 * cópias divergem. Dois: rota nova nasce com estado de carregamento sem
 * ninguém lembrar de criá-lo. As telas cuja forma é outra sobrescrevem com um
 * `loading.tsx` próprio; o Next usa sempre o mais próximo.
 *
 * O layout do grupo resolve antes deste esqueleto, então o shell (topbar e
 * navegação) já está na tela quando ele aparece — que é exatamente o caso que
 * doía: trocar de tela pela navegação e o conteúdo anterior ficar congelado
 * sem aviso.
 */
export default function Loading() {
  return <Carregando />;
}
