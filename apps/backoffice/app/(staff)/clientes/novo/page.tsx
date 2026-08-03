import { requirePlatformStaff } from "@/lib/guard";
import { NewClientForm } from "./form";

export default async function NewClientPage() {
  await requirePlatformStaff();

  return (
    <div className="space-y-6">
      <h1 className="font-semibold text-2xl">Novo cliente</h1>
      <NewClientForm />
    </div>
  );
}
