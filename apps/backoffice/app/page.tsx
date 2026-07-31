import { requirePlatformStaff } from "@/lib/guard";

export default async function ClientsPage() {
  const staff = await requirePlatformStaff();

  return <p>Autenticado como {staff.email}.</p>;
}
