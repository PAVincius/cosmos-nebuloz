import { redirect } from "next/navigation";
import { resolvePostLoginDestination } from "./_lib/resolve-post-login-destination";

// Tenant interno (isInternalTenant) cai no catálogo de produtos; os demais
// seguem direto pro produto contratado — hoje, na prática, o mesmo
// `/cosmos/dashboard` de antes desta feature, sem mudança observável.
export default async function RootPage() {
  redirect(await resolvePostLoginDestination());
}
