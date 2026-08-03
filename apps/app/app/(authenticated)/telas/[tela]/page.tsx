import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { acharTela, TELAS } from "../catalogo";
import { ScreenHost } from "../screen-host";

type TelaPageProps = {
  readonly params: Promise<{ tela: string }>;
};

export function generateStaticParams() {
  return TELAS.map((t) => ({ tela: t.slug }));
}

export async function generateMetadata({ params }: TelaPageProps) {
  const { tela } = await params;
  const encontrada = acharTela(tela);
  return { title: `${encontrada?.label ?? "Tela"} | COSMOS` };
}

export default async function TelaPage({ params }: TelaPageProps) {
  const { tela } = await params;
  const encontrada = acharTela(tela);

  if (!encontrada) {
    notFound();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-border border-b px-6 py-3">
        <Link
          className="flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
          href="/telas"
        >
          <ArrowLeftIcon className="size-4" />
          Telas
        </Link>
        <span className="font-medium text-sm">{encontrada.label}</span>
        {encontrada.origem === "demo" && (
          // O aviso fica acima da tela, não dentro dela: a tela é port literal
          // do protótipo e não deve ser editada para isso.
          <span className="rounded-full bg-amber-500/12 px-2.5 py-1 font-medium text-[11px] text-amber-700 dark:text-amber-500">
            Dados de demonstração — os números desta tela vêm do protótipo, não
            do seu workspace
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ScreenHost slug={encontrada.slug} />
      </div>
    </div>
  );
}
