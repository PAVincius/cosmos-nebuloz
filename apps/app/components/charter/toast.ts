"use client";

import { toast } from "sonner";
import type { IconName } from "../cosmos/icons";
import type { Tone } from "../cosmos/kit";

// Adapta o `addToast({ tone, icon, title, sub })` do protótipo para o sonner
// que o app já usa. O protótipo tem um ToastStack próprio; reimplementá-lo
// duplicaria posicionamento, empilhamento e dismiss por um ganho estético
// pequeno — o que importa do contrato é tom + título + subtítulo.

export type CharterToast = {
  tone?: Tone;
  icon?: IconName;
  title: string;
  sub?: string;
};

/** Toasts do Charter sempre carregam o alvo no `sub` — "Registrado no Decision
 *  Log · UC-118" diz mais que "Sucesso". */
export function addToast({ tone = "accent", title, sub }: CharterToast) {
  const opts = sub ? { description: sub } : undefined;
  if (tone === "red") {
    toast.error(title, opts);
    return;
  }
  if (tone === "green") {
    toast.success(title, opts);
    return;
  }
  if (tone === "amber") {
    toast.warning(title, opts);
    return;
  }
  toast(title, opts);
}
