import { Pendente } from "@/components/shell";

export default function Page() {
  return (
    <Pendente
      motivo="Depende da entidade Approval, que ainda não existe no schema. É pré-requisito de deleção de tenant, MCP writes avançadas, desconto acima de 15%, export sensível e mudança grande de plano."
      titulo="Aprovações"
    />
  );
}
