import type { Metadata } from "next";
import { SCREENS } from "@/components/meridian/screens/registry";
import { ComingSoon, TITLES } from "@/components/meridian/shell";

// Rota única para toda tela /meridian/<id>, mesmo padrão do Cosmos e do
// Charter. `seg[1]` é o parâmetro opcional de detalhe (/meridian/assessment/<id>).
//
// generateMetadata existe porque, com rota única, nenhuma tela teria <title> e
// toda aba do navegador leria "localhost:3012" — o axe acusa isso em todas.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ seg?: string[] }>;
}): Promise<Metadata> {
  const { seg } = await params;
  const id = seg?.[0] ?? "assessments";
  const [title, parent] = TITLES[id] ?? [id, "Meridian"];
  return { title: `${title} | ${parent} · Meridian` };
}

export default async function MeridianScreenPage({
  params,
}: {
  params: Promise<{ seg?: string[] }>;
}) {
  const { seg } = await params;
  const id = seg?.[0] ?? "assessments";
  const param = seg?.[1];
  const Screen = SCREENS[id];
  return Screen ? <Screen param={param} /> : <ComingSoon id={id} />;
}
