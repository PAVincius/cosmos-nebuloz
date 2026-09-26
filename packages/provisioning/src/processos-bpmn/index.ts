// Definições BPMN dos processos da Nebuloz — uma por processo, no esquema
// fechado de @repo/bpmn. Cada uma cita a fonte escrita (`fonte`), cada etapa
// relevante diz de onde veio (`origem`), e o que a fonte não diz vai para
// `lacunas` em vez de virar etapa inventada.
//
// Só dados e tipos: o compilador roda no seed e nos testes, não aqui.

import type { ProcessoBpmnEntrada } from "@repo/bpmn";
import { PZ_01 } from "./pz-01-funil-de-leads";
import { PZ_02 } from "./pz-02-geracao-de-proposta";
import { PZ_08 } from "./pz-08-risco-e-vendor";
import { PZ_10 } from "./pz-10-provisionamento";
import { PZ_22 } from "./pz-22-acesso-ao-backoffice";
import { PZ_23 } from "./pz-23-resposta-a-incidente";

export const DEFINICOES_BPMN_NEBULOZ: ProcessoBpmnEntrada[] = [
  PZ_01,
  PZ_02,
  PZ_08,
  PZ_10,
  PZ_22,
  PZ_23,
];
