import type { ProcessoBpmnEntrada } from "../esquema";

/** Processo pequeno mas completo: duas raias, uma decisão, uma junção. */
export function processoMinimo(): ProcessoBpmnEntrada {
  return {
    codigo: "PZ-99",
    nome: "Processo de teste",
    fonte: [{ arquivo: "docs/teste.md", secao: "§1" }],
    lacunas: [],
    pool: "Nebuloz",
    raias: [
      { id: "Raia_comercial", nome: "Comercial" },
      { id: "Raia_sistema", nome: "Back-office" },
    ],
    nos: [
      {
        id: "Inicio",
        tipo: "inicio",
        nome: "Pedido chega",
        raia: "Raia_comercial",
      },
      {
        id: "Analisar",
        tipo: "tarefaUsuario",
        nome: "Analisar pedido",
        raia: "Raia_comercial",
        origem: "docs/teste.md §1",
      },
      {
        id: "Decisao",
        tipo: "gatewayExclusivo",
        nome: "Aprovado?",
        raia: "Raia_comercial",
      },
      {
        id: "Gravar",
        tipo: "tarefaServico",
        nome: "Gravar aprovação",
        raia: "Raia_sistema",
      },
      {
        id: "Avisar",
        tipo: "tarefaManual",
        nome: "Avisar recusa",
        raia: "Raia_comercial",
      },
      {
        id: "Juntar",
        tipo: "gatewayExclusivo",
        nome: "",
        raia: "Raia_comercial",
      },
      {
        id: "Fim",
        tipo: "fim",
        nome: "Pedido tratado",
        raia: "Raia_comercial",
      },
    ],
    fluxos: [
      { de: "Inicio", para: "Analisar" },
      { de: "Analisar", para: "Decisao" },
      { de: "Decisao", para: "Gravar", condicao: "sim" },
      { de: "Decisao", para: "Avisar", condicao: "não" },
      { de: "Gravar", para: "Juntar" },
      { de: "Avisar", para: "Juntar" },
      { de: "Juntar", para: "Fim" },
    ],
  };
}
