import dynamic from "next/dynamic";
import { getSuppliers } from "../../actions/suppliers";
import { getARTs } from "../../actions/arts/get-arts";
import { PackageIcon } from "lucide-react";

const SuppliersBoard = dynamic(
  () => import("./components/suppliers-board").then((m) => m.SuppliersBoard),
  {
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground text-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
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
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Fornecedores</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie fornecedores externos integrados à cadeia de valor SAFe
        </p>
      </div>

      <SuppliersBoard
        initialSuppliers={suppliers}
        arts={arts.map((a: { id: string; name: string }) => ({
          id: a.id,
          name: a.name,
        }))}
      />
    </div>
  );
}
