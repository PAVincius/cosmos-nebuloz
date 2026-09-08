// Funil v2 — docs/superpowers/specs/2026-09-06-funil-v2-design.md §1.2/§1.3.
// Estágios (peso, teto, critérios de saída) e canais vieram do design
// (backoffice-funnel.jsx `FUNNEL_STAGES`/`LEAD_SOURCES`, backoffice-funnel-
// stage.jsx `STAGE_EXIT`), consumidos por
// apps/app/scripts/seed-empresa-nebuloz.ts como `EstagioDoFunil` e
// `CanalDeLead`.
//
// Só dados e tipos: sem import de valor de "@repo/database" (server-only).

export type EstagioSeed = {
  codigo: "LEAD" | "DISCOVERY" | "EVALUATION" | "PROPOSAL";
  pesoPercent: number;
  tetoDias: number;
  criterios: string[];
  ordem: number;
};

export const ESTAGIOS_NEBULOZ: EstagioSeed[] = [
  {
    codigo: "LEAD",
    pesoPercent: 10,
    tetoDias: 7,
    criterios: [
      "Contato respondeu e aceitou conversar",
      "Sponsor ou caminho até ele identificado",
      "Porta de entrada na Escada registrada",
    ],
    ordem: 0,
  },
  {
    codigo: "DISCOVERY",
    pesoPercent: 30,
    tetoDias: 14,
    criterios: [
      "Problema descrito na linguagem do cliente, não da Nebuloz",
      "Decisor com orçamento participou de uma reunião",
      "Baseline mínimo do processo alvo conhecido",
    ],
    ordem: 1,
  },
  {
    codigo: "EVALUATION",
    pesoPercent: 60,
    tetoDias: 21,
    criterios: [
      "Escopo fechado: serviço, módulo e assentos",
      "Capacidade simulada para a janela pedida",
      "Preço de tabela aceito como ponto de partida",
    ],
    ordem: 2,
  },
  {
    codigo: "PROPOSAL",
    pesoPercent: 80,
    tetoDias: 30,
    criterios: [
      "Proposta enviada ao decisor, não ao contato",
      "Data de decisão combinada",
      "Desfecho registrado: ganha → tenant, perdida → motivo",
    ],
    ordem: 3,
  },
];

export type CanalSeed = {
  slug: string;
  nome: string;
  cacMedioCentavos: null;
  ordem: number;
};

export const CANAIS_NEBULOZ: CanalSeed[] = [
  { slug: "indicacao", nome: "Indicação", cacMedioCentavos: null, ordem: 0 },
  { slug: "evento", nome: "Evento", cacMedioCentavos: null, ordem: 1 },
  { slug: "inbound", nome: "Inbound", cacMedioCentavos: null, ordem: 2 },
  { slug: "outbound", nome: "Outbound", cacMedioCentavos: null, ordem: 3 },
  { slug: "parceiro", nome: "Parceiro", cacMedioCentavos: null, ordem: 4 },
];
