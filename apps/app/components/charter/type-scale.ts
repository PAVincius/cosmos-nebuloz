// Escala tipográfica do Charter = os seis degraus de `cosmos.css` (--fs-*).
//
// Só `fontSize` de texto passa por aqui; ícone, largura, entreletra e
// entrelinha ficam em número. Um tamanho fora destes seis é um degrau novo —
// `__tests__/charter/type-scale.test.ts` barra literal numérico no módulo.
//
// Papéis: micro = eyebrow e carimbo mono em maiúsculas · nota = meta, hint,
// legenda · base = corpo, rótulo, tab, botão · forte = número-chave e título
// de estado vazio · titulo = título de modal · display = contagem grande.

export const FS = {
  micro: "var(--fs-micro)",
  nota: "var(--fs-nota)",
  base: "var(--fs-base)",
  forte: "var(--fs-forte)",
  titulo: "var(--fs-titulo)",
  display: "var(--fs-display)",
} as const;
