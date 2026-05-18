export type PortfolioEpic = {
  id: string;
  title: string;
  statusId: string;
  order: number;
  /** Média do WSJF efetivo das features (mesma regra da página do épico). */
  wsjfScore: number;
  /** Somas dos parâmetros WSJF das features (para o rodapé do card do kanban). */
  bv: number;
  tc: number;
  rr: number;
  js: number;
  featureCount: number;
};
