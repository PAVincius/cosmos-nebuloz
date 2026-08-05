import Link from "next/link";
import type { ReactNode } from "react";
import { Sidebar, Topbar } from "./chrome";
import { itemDaRota } from "./nav";

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

/**
 * Tela que ainda não existe, dizendo **por que** — nunca "em breve".
 *
 * "Em breve" foi exatamente o padrão que tivemos de arrancar do Cosmos: promete
 * sem informar e não ajuda ninguém a decidir. Nomear a entidade que falta
 * transforma a ausência em roadmap legível dentro do produto.
 *
 * Título e motivo vêm de `nav.ts` pela rota, não como props. Antes o mesmo
 * texto vivia nos dois lugares, e dois lugares divergem: a sidebar diria um
 * motivo no `title` e a tela, outro.
 */
export function Pendente({ rota }: { rota: string }) {
  const item = itemDaRota(rota);
  const titulo = item?.label ?? "Tela indisponível";
  const motivo =
    item?.pendente ??
    `A rota ${rota} não está no menu. Isso é bug de navegação, não tela pendente.`;

  return <PendenteView motivo={motivo} titulo={titulo} />;
}

function PendenteView({ titulo, motivo }: { titulo: string; motivo: string }) {
  return (
    <div
      className="fade-in"
      style={{
        margin: "0 auto",
        maxWidth: 560,
        padding: 32,
        textAlign: "center",
        background: "var(--surface)",
        border: "1px dashed var(--hairline-strong)",
        borderRadius: "var(--r-xl)",
      }}
    >
      <h1
        className="display"
        style={{ fontSize: 19, fontWeight: 700, margin: "0 0 10px" }}
      >
        {titulo}
      </h1>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.65,
          color: "var(--ink-muted)",
          fontWeight: 500,
        }}
      >
        {motivo}
      </p>
      <Link
        href="/"
        style={{
          display: "inline-block",
          marginTop: 20,
          fontSize: 12.5,
          fontWeight: 700,
          color: "var(--accent-text)",
        }}
      >
        Voltar para Tenants
      </Link>
    </div>
  );
}
