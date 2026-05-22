import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { ImportWizard } from "./components/import-wizard";

export const metadata = { title: "Import from Linear | COSMOS" };

export default async function LinearImportPage() {
  const ctx = await requireTenantSession(await headers());
  return <ImportWizard tenantId={ctx.tenantId} />;
}
