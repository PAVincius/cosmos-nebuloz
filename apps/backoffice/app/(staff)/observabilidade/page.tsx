import { Pendente } from "@/components/shell";

export default function Page() {
  return (
    <Pendente
      motivo="Depende das entidades Integration e AccessLog. Sem elas não há falha de integração para listar nem log de acesso ao painel."
      titulo="Observabilidade"
    />
  );
}
