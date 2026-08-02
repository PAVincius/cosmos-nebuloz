import { ShieldCheckIcon } from "lucide-react";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { listCustomRoles } from "@/app/actions/settings/custom-roles";
import { appDesign } from "@/lib/app-design";
import { RolesClient } from "./roles-client";

export const metadata = {
  title: "Custom Roles | COSMOS",
};

export default async function CustomRolesPage() {
  const result = await listCustomRoles();
  const roles = result.ok ? result.data : [];

  return (
    <div className={appDesign.shell}>
      <PageHeader
        breadcrumb={[
          { label: "Settings", href: "/settings/workspace" },
          { label: "Roles Customizadas" },
        ]}
        stats={[
          {
            label: "Roles",
            value: roles.length,
            icon: ShieldCheckIcon,
          },
        ]}
        subtitle="Crie roles com conjuntos de permissões granulares para casos de uso específicos"
        title="Roles Customizadas"
      />
      <div className={appDesign.bodyScroll}>
        <RolesClient roles={roles} />
      </div>
    </div>
  );
}
