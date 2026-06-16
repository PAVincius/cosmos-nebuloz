import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { listPAERequests } from "@/app/actions/pae/index";
import type { PAERequest } from "@/app/actions/pae/schema";
import { PageHeader } from "../components/page-header";
import { PAETabs } from "./components/pae-tabs";

export const metadata = {
  title: "Exceções de Acesso | COSMOS",
  description: "Gerencie solicitações e grants de acesso temporário",
};

export default async function AccessExceptionsPage() {
  const ctx = await requireTenantSession(await headers());
  const result = await listPAERequests();
  const requests: PAERequest[] = result.ok ? result.data : [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        subtitle="Solicitações de acesso temporário além do seu cargo"
        title="Exceções de Acesso"
      />
      <PAETabs
        currentUserId={ctx.userId}
        currentUserRole={ctx.role}
        requests={requests}
      />
    </div>
  );
}
