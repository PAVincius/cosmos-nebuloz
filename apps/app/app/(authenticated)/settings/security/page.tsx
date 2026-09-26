import { KeyRoundIcon } from "lucide-react";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { appDesign } from "@/lib/app-design";
import { SecurityForm } from "./security-form";

export const metadata = {
  title: "Segurança | COSMOS",
};

export default function SecuritySettingsPage() {
  return (
    <div className={appDesign.shell}>
      <PageHeader
        breadcrumb={[
          { label: "Settings", href: "/settings/workspace" },
          { label: "Segurança" },
        ]}
        stats={[
          {
            label: "Senha",
            value: "Trocar",
            icon: KeyRoundIcon,
          },
        ]}
        subtitle="Troque sua senha sem sair do produto"
        title="Segurança"
      />
      <div className={appDesign.bodyScroll}>
        <SecurityForm />
      </div>
    </div>
  );
}
