import type { Metadata } from "next";
import { SCREENS } from "@/components/signal/screens/registry";
import { ComingSoon, TITLES } from "@/components/signal/shell";

// Rota única para toda tela /signal/<id>, mesmo padrão do Cosmos, do Charter e
// do Meridian. `seg[1]` é o parâmetro opcional de detalhe
// (/signal/initiative/IN-014).
//
// generateMetadata existe porque, com rota única, nenhuma tela teria <title> e
// toda aba do navegador leria "localhost:3012" — o axe acusa isso em todas.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ seg?: string[] }>;
}): Promise<Metadata> {
  const { seg } = await params;
  const id = seg?.[0] ?? "overview";
  const [title, parent] = TITLES[id] ?? [id, "Signal"];
  return { title: `${title} | ${parent} · Signal` };
}

export default async function SignalScreenPage({
  params,
}: {
  params: Promise<{ seg?: string[] }>;
}) {
  const { seg } = await params;
  const id = seg?.[0] ?? "overview";
  const param = seg?.[1];
  const Screen = SCREENS[id];
  return Screen ? <Screen param={param} /> : <ComingSoon id={id} />;
}
