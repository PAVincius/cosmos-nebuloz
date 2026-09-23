export type Produto =
  | "meridian"
  | "charter"
  | "scaffold"
  | "cosmos"
  | "backoffice"
  | "plataforma"
  | "signal";

export type Destino = Produto | "compartilhado";

/** Nó do graph.json do graphify. Só os campos que este módulo lê; o resto
 *  passa adiante intacto. */
export type No = {
  id: string;
  source_file: string;
  community?: number | string;
  label?: string;
  [k: string]: unknown;
};

/** Aresta. A chave no arquivo é `links`, não `edges` — verificado. */
export type Aresta = {
  source: string;
  target: string;
  relation?: string;
  [k: string]: unknown;
};

export type Grafo = {
  nodes: No[];
  links: Aresta[];
  directed?: boolean;
  [k: string]: unknown;
};

export type Roteamento = { destino: Destino; motivo: string };
