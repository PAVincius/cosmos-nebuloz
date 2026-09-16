// modals/_shared.tsx — o que dois ou mais modais do Charter compartilham.
// Movido de modals.tsx no split em um arquivo por modal; o barrel continua
// re-exportando para que os importadores não mudem.
//
// `GatedAction` morava aqui: um <span> com `pointer-events:none` e o motivo
// no `title`. Não impedia Tab+Enter e o motivo só aparecia no hover. Cada
// modal agora usa `GatedButton` (`disabled` real) e escreve o motivo no
// rodapé.

export type DataClass = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
