"use client";

import { BotaoSecundario, Campo, INPUT } from "@/components/campo";

/**
 * Busca por texto sobre uma lista que já está no cliente.
 *
 * Rótulo visível, não placeholder: placeholder some ao digitar e não é
 * rótulo para leitor de tela. "Limpar" só quando há o que limpar, e o
 * contador diz quantos sobraram de quantos — sem ele, uma busca que zera a
 * lista parece uma lista vazia.
 *
 * O valor mora na URL (`useParamState`, modo raso), não aqui: quem monta a
 * busca passa `valor`/`onMudar`, e F5 devolve a mesma lista filtrada.
 */

const ACENTOS = /[̀-ͯ]/g;

/** Caixa baixa e sem acento: "Saúde" acha "saude" e "SAUDE". */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(ACENTOS, "").toLowerCase().trim();
}

/** Algum dos campos contém o texto buscado. Busca vazia aceita tudo. */
export function contemTexto(
  campos: (string | null | undefined)[],
  busca: string
): boolean {
  const alvo = normalizar(busca);
  if (alvo === "") {
    return true;
  }
  return campos.some((c) => c && normalizar(c).includes(alvo));
}

export function Busca({
  id,
  rotulo,
  valor,
  onMudar,
  visiveis,
  total,
}: {
  id: string;
  rotulo: string;
  valor: string;
  onMudar: (valor: string) => void;
  visiveis: number;
  total: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      <div style={{ flex: "1 1 220px", maxWidth: 360 }}>
        <Campo htmlFor={id} label={rotulo}>
          <input
            id={id}
            onChange={(e) => onMudar(e.target.value)}
            style={{ ...INPUT, padding: "8px 10px" }}
            type="search"
            value={valor}
          />
        </Campo>
      </div>
      {valor ? (
        <BotaoSecundario onClick={() => onMudar("")}>Limpar</BotaoSecundario>
      ) : null}
      <output
        aria-live="polite"
        className="mono"
        style={{
          paddingBottom: 8,
          fontSize: "var(--fs-nota)",
          color: "var(--ink-faint)",
        }}
      >
        {visiveis} de {total}
      </output>
    </div>
  );
}
