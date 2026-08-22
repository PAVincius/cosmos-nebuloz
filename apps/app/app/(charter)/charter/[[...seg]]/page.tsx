import type { Metadata } from "next";
import { SCREENS } from "@/components/charter/screens/registry";
import { ComingSoon } from "@/components/charter/shell";
// Direto de `titles` pelo mesmo motivo do catch-all do Cosmos: `shell` é
// `"use client"` e o mapa não atravessa essa fronteira como dado.
import { TITLES } from "@/components/charter/titles";

// Rota única para toda tela /charter/<id>, mesmo padrão do Cosmos. `seg[1]` é o
// parâmetro opcional de detalhe (/charter/case/UC-118).
//
// generateMetadata existe porque, com rota única, nenhuma tela teria <title> e
// toda aba do navegador leria "localhost:3012" — o axe acusa isso em todas.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ seg?: string[] }>;
}): Promise<Metadata> {
  const { seg } = await params;
  const id = seg?.[0] ?? "dashboard";
  const [title, parent] = TITLES[id] ?? [id, "Charter"];
  return { title: `${title} | ${parent} · Charter` };
}

export default async function CharterScreenPage({
  params,
}: {
  params: Promise<{ seg?: string[] }>;
}) {
  const { seg } = await params;
  const id = seg?.[0] ?? "dashboard";
  const param = seg?.[1];
  const Screen = SCREENS[id];
  return Screen ? <Screen param={param} /> : <ComingSoon id={id} />;
}
