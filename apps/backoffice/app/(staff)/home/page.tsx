import { redirect } from "next/navigation";

/**
 * `/home` foi a Home até a crítica rodada 5, quando ela passou para a raiz.
 * Fica como redirect porque há link velho colado em ticket e em favorito — e
 * link de outras telas que ainda aponta para cá. A query vai junto: um link
 * com filtro não pode chegar sem ele.
 */
export default async function HomeAntiga({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const consulta = new URLSearchParams();
  for (const [chave, valor] of Object.entries(await searchParams)) {
    for (const um of [valor].flat()) {
      if (um !== undefined) {
        consulta.append(chave, um);
      }
    }
  }
  const texto = consulta.toString();
  redirect(texto ? `/?${texto}` : "/");
}
