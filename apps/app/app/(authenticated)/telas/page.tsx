import Link from "next/link";
import { PageHeader } from "../components/page-header";
import { TELAS } from "./catalogo";

export const metadata = {
  title: "Telas portadas | COSMOS",
  description: "Telas do protótipo de design já portadas para o app",
};

const GRUPOS = [
  "Portfólio",
  "Execução",
  "Métricas",
  "Financeiro",
  "Governança",
  "Inteligência",
  "Configuração",
];

export default function TelasPage() {
  const reais = TELAS.filter((t) => t.origem === "real").length;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        subtitle={`${TELAS.length} telas portadas do protótipo · ${reais} ligadas a dados reais`}
        title="Telas portadas"
      />
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <p className="mb-6 max-w-[70ch] text-muted-foreground text-sm">
          Estas telas vieram do protótipo de design e estavam no repositório sem
          nenhuma rota apontando para elas. As marcadas como{" "}
          <span className="font-medium text-amber-600 dark:text-amber-500">
            demonstração
          </span>{" "}
          mostram números inventados pelo protótipo — servem para avaliar o
          desenho, não para decidir nada.
        </p>

        <div className="flex flex-col gap-8">
          {GRUPOS.map((grupo) => {
            const doGrupo = TELAS.filter((t) => t.grupo === grupo);
            if (doGrupo.length === 0) {
              return null;
            }

            return (
              <section key={grupo}>
                <h2 className="mb-3 font-mono text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
                  {grupo}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {doGrupo.map((tela) => (
                    <Link
                      className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:border-[#5e6ad2] hover:bg-muted/40"
                      href={`/telas/${tela.slug}`}
                      key={tela.slug}
                    >
                      <span className="font-medium text-sm">{tela.label}</span>
                      {tela.origem === "real" ? (
                        <span className="shrink-0 rounded-full bg-emerald-500/12 px-2 py-0.5 font-mono text-[10px] text-emerald-700 uppercase tracking-wider dark:text-emerald-400">
                          dados reais
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-amber-500/12 px-2 py-0.5 font-mono text-[10px] text-amber-700 uppercase tracking-wider dark:text-amber-500">
                          demonstração
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
