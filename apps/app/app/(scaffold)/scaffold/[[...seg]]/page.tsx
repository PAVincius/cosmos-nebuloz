import type { Metadata } from "next";
import { TITLES } from "@/components/scaffold/nav";
import { SCREENS } from "@/components/scaffold/screens/registry";

// Rota única para toda tela /scaffold/<id>, mesmo padrão do Cosmos, do Charter
// e do Meridian. `seg[1]` é o parâmetro opcional de detalhe
// (/scaffold/track/<id>).
//
// generateMetadata existe porque, com rota única, nenhuma tela teria <title> e
// toda aba do navegador leria "localhost:3012" — o axe acusa isso em todas.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ seg?: string[] }>;
}): Promise<Metadata> {
  const { seg } = await params;
  const id = seg?.[0] ?? "portfolio";
  const [title, parent] = TITLES[id] ?? [id, "Scaffold"];
  return { title: `${title} | ${parent} · Scaffold` };
}

function ComingSoon({ id }: { id: string }) {
  const [title, parent] = TITLES[id] ?? [id, "Scaffold"];
  return (
    <div className="fade-in" style={{ padding: "48px 0", maxWidth: 560 }}>
      <div
        className="mono"
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
          marginBottom: 10,
        }}
      >
        {parent}
      </div>
      <h1
        className="display"
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: "var(--ink)",
          margin: "0 0 12px",
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.65,
          color: "var(--ink-muted)",
          margin: 0,
        }}
      >
        Esta tela chega na fatia de interface. O que já está de pé é a ligação
        com o Meridian: uma lacuna promovida vira trilha com as quatro fases
        instanciadas.
      </p>
    </div>
  );
}

export default async function ScaffoldScreenPage({
  params,
}: {
  params: Promise<{ seg?: string[] }>;
}) {
  const { seg } = await params;
  const id = seg?.[0] ?? "portfolio";
  const param = seg?.[1];
  const Screen = SCREENS[id];
  return Screen ? <Screen param={param} /> : <ComingSoon id={id} />;
}
