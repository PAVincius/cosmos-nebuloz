import { ShieldIcon } from "lucide-react";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { getSSOConfig } from "@/app/actions/settings/sso";
import { appDesign } from "@/lib/app-design";
import { SSOConfigForm } from "./sso-config-form";

export const metadata = {
  title: "SSO / SAML | COSMOS",
};

export default async function SSOSettingsPage() {
  const result = await getSSOConfig();
  const config = result.ok ? result.data : null;

  return (
    <div className={appDesign.shell}>
      <PageHeader
        breadcrumb={[
          { label: "Settings", href: "/settings/workspace" },
          { label: "SSO / SAML" },
        ]}
        stats={[
          {
            label: "SSO",
            value: config?.enabled ? "Ativado" : "Desativado",
            icon: ShieldIcon,
          },
        ]}
        subtitle="Configure Single Sign-On via SAML 2.0 para autenticação corporativa"
        title="SSO / SAML"
      />
      <div className={appDesign.bodyScroll}>
        <SSOConfigForm initial={config} />
      </div>
    </div>
  );
}
