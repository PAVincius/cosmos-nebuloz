import { Pendente } from "@/components/shell";

export default function Page() {
  return (
    <Pendente
      motivo="A timeline agregada precisa de diff campo-a-campo em AuditLog. Hoje o AuditLog existe, mas sem a coluna de diff que o FR-10.3 exige."
      titulo="Audit Explorer"
    />
  );
}
