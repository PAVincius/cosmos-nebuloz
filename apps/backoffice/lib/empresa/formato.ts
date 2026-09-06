import type { EstadoDpa } from "./fornecedores";

export function formatarData(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

export const ROTULO_ESTADO: Record<EstadoDpa, string> = {
  EMBUTIDO: "Embutido",
  A_ASSINAR: "A assinar",
  ASSINADO: "Assinado",
  SEM_DOCUMENTO: "Sem documento",
};

/** Um sinal quente por tela (canvas de 5 set): só "bloqueia venda" é âmbar;
 *  os estados são azul/neutro/verde. */
export const TOM_ESTADO: Record<EstadoDpa, "blue" | "neutral" | "green"> = {
  EMBUTIDO: "blue",
  A_ASSINAR: "blue",
  ASSINADO: "green",
  SEM_DOCUMENTO: "neutral",
};
