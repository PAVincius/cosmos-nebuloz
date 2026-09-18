import { Skel, SkeletonKpi } from "@repo/design-system/cosmos/kit";
import type { CSSProperties } from "react";

/**
 * Esqueleto de carregamento das telas do back-office.
 *
 * Existe porque não havia nenhum: quinze rotas `force-dynamic` e zero
 * `loading.tsx`. Na prática a pessoa clicava, a tela anterior congelava, e nada
 * dizia que algo estava acontecendo até o HTML novo chegar.
 *
 * Um componente só, com formas, em vez de quinze esqueletos desenhados à mão.
 * Quinze arquivos divergiriam: alguém muda o `SectionCard` e catorze esqueletos
 * continuam com a geometria antiga, cada um mentindo um pouco.
 *
 * As medidas não são estéticas — são as do `kit.tsx`. Se o esqueleto tem outra
 * altura que o conteúdo real, a tela pula quando os dados chegam, e um pulo é
 * pior que a espera: a pessoa já tinha mirado o clique.
 */

/** Geometria do `PageHeader` do kit. */
const CABECALHO: CSSProperties = {
  marginBottom: 22,
  padding: "22px 26px 24px",
  borderRadius: "var(--r-lg)",
  border: "1px solid var(--hairline)",
  boxShadow: "var(--card-shadow)",
  background:
    "linear-gradient(180deg, var(--surface-3), var(--surface-2) 60%, var(--surface))",
};

/** Geometria do `SectionCard` do kit. */
const CARTAO: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-lg)",
  boxShadow: "var(--card-shadow)",
  overflow: "hidden",
};

const CABECA_DO_CARTAO: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "13px 18px",
  borderBottom: "1px solid var(--hairline)",
};

const CORPO_DO_CARTAO: CSSProperties = { padding: 18 };

/**
 * A forma do corpo. Não é enfeite: é o que decide se a tela pula ou não quando
 * os dados chegam. Uma tela de KPIs que carrega com esqueleto de cartão salta
 * a altura inteira da grade.
 */
export type FormaDoCorpo = "cartoes" | "kpis" | "tabela" | "documento";

/** Chaves fixas para as repetições. O índice serviria — nada aqui reordena —,
 *  mas a regra que proíbe índice como chave existe justamente para não depender
 *  de "nada reordena", e uma lista de nomes custa menos que uma exceção. */
const PLACAS = [
  "um",
  "dois",
  "tres",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
] as const;

function Cartao({ linhas = 3 }: { linhas?: number }) {
  return (
    <div style={CARTAO}>
      <div style={CABECA_DO_CARTAO}>
        <Skel h={16} r={6} w={16} />
        <Skel h={13} w={150} />
      </div>
      <div
        style={{
          ...CORPO_DO_CARTAO,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {PLACAS.slice(0, linhas).map((placa, i) => (
          // Larguras decrescentes: um bloco de linhas iguais lê como tabela,
          // não como texto. A última é curta como um último parágrafo é.
          <Skel
            h={12}
            key={placa}
            w={i === linhas - 1 ? "45%" : `${92 - i * 7}%`}
          />
        ))}
      </div>
    </div>
  );
}

function Kpis() {
  return (
    <div
      style={{
        display: "grid",
        gap: "var(--gap)",
        gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
      }}
    >
      {["a", "b", "c", "d"].map((k) => (
        <SkeletonKpi key={k} />
      ))}
    </div>
  );
}

function Tabela({ linhas = 8 }: { linhas?: number }) {
  return (
    <div style={CARTAO}>
      <div style={CABECA_DO_CARTAO}>
        <Skel h={13} w={130} />
      </div>
      {PLACAS.slice(0, linhas).map((placa, i) => (
        <div
          key={placa}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "12px 18px",
            borderBottom:
              i === linhas - 1 ? "none" : "1px solid var(--hairline)",
          }}
        >
          <Skel h={11} w={92} />
          <Skel h={11} w="32%" />
          <div style={{ flex: 1 }} />
          <Skel h={18} r={99} w={74} />
        </div>
      ))}
    </div>
  );
}

/** O gerador de proposta: formulário à esquerda, documento à direita. */
function Documento() {
  return (
    <div className="bo-duas-colunas" style={{ gap: "var(--gap)" }}>
      <Cartao linhas={6} />
      <Cartao linhas={9} />
    </div>
  );
}

function Corpo({ forma }: { forma: FormaDoCorpo }) {
  if (forma === "kpis") {
    return (
      <>
        <Kpis />
        <Cartao linhas={4} />
      </>
    );
  }
  if (forma === "tabela") {
    return <Tabela />;
  }
  if (forma === "documento") {
    return <Documento />;
  }
  return (
    <>
      <Cartao />
      <Cartao linhas={2} />
    </>
  );
}

export function Carregando({ corpo = "cartoes" }: { corpo?: FormaDoCorpo }) {
  return (
    // `<output>` traz `role="status"` de fábrica, e com rótulo a troca de tela
    // deixa de ser silenciosa para quem usa leitor de tela — sem isso a região
    // muda e nada é anunciado. O desenho em si é decorativo e fica fora da
    // árvore de acessibilidade.
    <output
      aria-busy="true"
      aria-label="Carregando"
      style={{ display: "flex", flexDirection: "column", gap: 18 }}
    >
      {/* Duas linhas de subtítulo, não uma: medido contra um `PageHeader` real,
          o esqueleto de uma linha ficava 24px mais curto e a tela pulava esse
          tanto quando os dados chegavam. Os subtítulos do back-office são
          frases longas que quebram em duas na largura de conteúdo. */}
      <div aria-hidden="true" style={CABECALHO}>
        <Skel h={10} w={110} />
        <Skel h={21} style={{ marginTop: 13 }} w={260} />
        <Skel h={12} style={{ marginTop: 14 }} w="82%" />
        <Skel h={12} style={{ marginTop: 8 }} w="54%" />
      </div>
      <div
        aria-hidden="true"
        style={{ display: "flex", flexDirection: "column", gap: 18 }}
      >
        <Corpo forma={corpo} />
      </div>
    </output>
  );
}
