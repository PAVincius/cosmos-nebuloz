import type { ReactNode } from "react";
import { Sidebar, Topbar } from "./chrome";

/**
 * Shell do Big Bang. Server Component: só a topbar e a sidebar são cliente,
 * porque só elas precisam de tema e de rota ativa.
 *
 * O grid nomeado (`bar` / `side` / `main`) é o do protótipo, e não é enfeite:
 * com áreas nomeadas a topbar atravessa as duas colunas sem `col-span`, e a
 * sidebar rola sozinha sem arrastar o conteúdo junto.
 */
export function Shell({
  staff,
  children,
}: {
  staff: { name: string | null; email: string; canWrite: boolean };
  children: ReactNode;
}) {
  return (
    <div
      style={{
        height: "100vh",
        display: "grid",
        gridTemplateAreas: '"bar bar" "side main"',
        gridTemplateColumns: "236px 1fr",
        gridTemplateRows: "56px 1fr",
        background: "var(--canvas)",
        color: "var(--ink)",
      }}
    >
      <Topbar staff={staff} />
      <Sidebar />
      <main
        className="scroll fade-in"
        style={{ gridArea: "main", overflowY: "auto", padding: 26 }}
      >
        <div style={{ margin: "0 auto", maxWidth: 1180 }}>{children}</div>
      </main>
    </div>
  );
}
