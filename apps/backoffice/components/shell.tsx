import type { ReactNode } from "react";
import { buscarClientes } from "@/app/actions/clientes-busca";
import { ShellChrome } from "./chrome";

/**
 * Shell do Big Bang. Server Component fino: o `children` que ele recebe já vem
 * renderizado no servidor e só atravessa o `ShellChrome`, que é cliente porque
 * a gaveta da navegação tem estado.
 *
 * O grid nomeado (`bar` / `side` / `main`) é o do protótipo, e não é enfeite:
 * com áreas nomeadas a topbar atravessa as duas colunas sem `col-span`, e a
 * sidebar rola sozinha sem arrastar o conteúdo junto. Ele vive na classe
 * `.bo-shell` do `backoffice-theme.css`, e não em `style` inline, porque
 * inline vence folha de estilo — e a media query que colapsa a coluna da
 * sidebar precisa poder sobrepor.
 */
export function Shell({
  staff,
  children,
}: {
  staff: { name: string | null; email: string; canWrite: boolean };
  children: ReactNode;
}) {
  // A busca de clientes da paleta atravessa como action: o `ShellChrome` é
  // cliente, e importá-la lá puxaria o módulo de servidor para dentro de
  // cada teste que monta o shell.
  return (
    <ShellChrome buscarClientes={buscarClientes} staff={staff}>
      {children}
    </ShellChrome>
  );
}
