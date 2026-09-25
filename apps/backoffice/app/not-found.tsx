import Link from "next/link";

export const metadata = {
  title: "Página não encontrada — Back-office Nebuloz",
};

/**
 * Não-encontrado da raiz.
 *
 * O de `(staff)/not-found.tsx` só pega o que cai dentro do grupo. Um endereço
 * que não bate com rota nenhuma — `/cliente/x`, singular, ou um link velho —
 * nunca entra no grupo e caía no 404 do Next: em inglês, sem os tokens, com
 * cara de outro produto. Aqui o layout raiz ainda envolve (fontes, tema,
 * `cosmos-root`), mas não o shell — por isso a tela é o cartão centrado do
 * sign-in, não uma página do painel.
 *
 * Só um caminho de volta: a Home. Daqui não dá para saber se há sessão; quem
 * não estiver logado é mandado ao sign-in pela própria Home.
 */
export default function NaoEncontradoRaiz() {
  return (
    <main
      className="grain bg-grid"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--canvas)",
        color: "var(--ink)",
      }}
    >
      <div
        style={{
          width: 420,
          maxWidth: "100%",
          padding: 32,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          background: "var(--surface)",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-xl)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <h1
          className="display"
          style={{ margin: 0, fontSize: "var(--fs-titulo)", fontWeight: 700 }}
        >
          Página não encontrada
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: "var(--fs-base)",
            lineHeight: 1.6,
            color: "var(--ink-muted)",
          }}
        >
          Este endereço não corresponde a nenhuma tela do painel. O link pode
          ser antigo, ou o endereço foi digitado com um caminho que não existe.
        </p>
        <Link
          href="/"
          style={{
            alignSelf: "flex-start",
            marginTop: 4,
            fontSize: "var(--fs-base)",
            fontWeight: 700,
            color: "var(--accent-text)",
          }}
        >
          Ir para a Home
        </Link>
      </div>
    </main>
  );
}
