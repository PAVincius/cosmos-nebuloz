import type { MeridianAxis } from "@repo/database";
import type { IconName } from "@repo/design-system/cosmos/icons";

// Os cinco eixos avaliados pelo Meridian.
//
// `AXIS_IDS` é a ordem canônica e é ela — não `Object.keys(AXES)` nem a ordem
// do enum do Prisma — que o motor de scoring, o radar e o export percorrem.
// Ordem de chave de objeto não é garantida por especificação, e um scoring que
// depende dela deixa de ser determinístico sem ninguém perceber.

export const AXIS_IDS: readonly MeridianAxis[] = [
  "DATA",
  "PROCESS",
  "PEOPLE",
  "GOVERNANCE",
  "INFRASTRUCTURE",
] as const;

export type AxisMeta = {
  id: MeridianAxis;
  label: string;
  icon: IconName;
  desc: string;
};

export const AXES: Record<MeridianAxis, AxisMeta> = {
  DATA: {
    id: "DATA",
    label: "Data",
    icon: "dataset",
    desc: "Qualidade, disponibilidade e linhagem de dado",
  },
  PROCESS: {
    id: "PROCESS",
    label: "Process",
    icon: "flow",
    desc: "Processos mapeados e priorização de casos",
  },
  PEOPLE: {
    id: "PEOPLE",
    label: "People",
    icon: "users",
    desc: "Competências, papéis e capacitação",
  },
  GOVERNANCE: {
    id: "GOVERNANCE",
    label: "Governance",
    icon: "shield",
    desc: "Política, risco e supervisão de IA",
  },
  INFRASTRUCTURE: {
    id: "INFRASTRUCTURE",
    label: "Infrastructure",
    icon: "server",
    desc: "Plataforma, MLOps e segurança",
  },
};

/** Rótulo curto usado em chave de coorte e no export legível por máquina. */
export const axisSlug = (axis: MeridianAxis): string => axis.toLowerCase();
