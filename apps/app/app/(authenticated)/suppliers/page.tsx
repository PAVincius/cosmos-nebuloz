import dynamic from "next/dynamic";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { appDesign } from "@/lib/app-design";
import { getARTs } from "../../actions/arts/get-arts";
import { getSuppliers } from "../../actions/suppliers";

const SuppliersBoard = dynamic(
  () => import("./components/suppliers-board").then((m) => m.SuppliersBoard),
  {
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground text-sm">
        <div
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
        />
        <span>A carregar fornecedores…</span>
      </div>
    ),
  }
);

export const metadata = {
  title: "Fornecedores | COSMOS",
  description: "Gestão de fornecedores — Large Solution Level SAFe 6.0",
};

export default async function SuppliersPage() {
  const [suppliers, arts] = await Promise.all([getSuppliers(), getARTs()]);

  return (
    <div className={appDesign.shell}>
      <PageHeader
        subtitle="Gerencie fornecedores externos integrados à cadeia de valor SAFe"
        title="Fornecedores"
      />
      <div className={appDesign.bodyScroll}>
        <SuppliersBoard
          arts={arts.map((a: { id: string; name: string }) => ({
            id: a.id,
            name: a.name,
          }))}
          initialSuppliers={suppliers}
        />
      </div>
    </div>
  );
}
