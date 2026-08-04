// Carregador da config de colunas do Portfolio Kanban. Módulo comum, sem
// "use server": de um arquivo "use server" só se exporta função async, então o
// helper privado que existia em index.ts não podia ser reusado pelo board do
// Cosmos. Extrair aqui é o que permite os dois lados lerem a MESMA config —
// sem isso, o limite de WIP configurado numa tela seria ignorado pela outra.
import { database } from "@repo/database";
import {
  DEFAULT_PORTFOLIO_COLUMNS,
  type KanbanColumnConfig,
  type KanbanConfig,
  KanbanConfigSchema,
} from "./schema";

export const METADATA_KEY = "portfolioKanban";

export type TenantMetadata = {
  [METADATA_KEY]?: KanbanConfig;
  [k: string]: unknown;
};

/** Papéis que podem estourar o limite de WIP — sempre com justificativa. */
export const WIP_OVERRIDE_ROLES = new Set(["ADMIN", "STE", "RTE", "PO", "SM"]);

export function mergeWithDefaults(
  stored?: KanbanColumnConfig[]
): KanbanColumnConfig[] {
  if (!stored || stored.length === 0) {
    return DEFAULT_PORTFOLIO_COLUMNS;
  }
  const byId = new Map(stored.map((c) => [c.id, c]));
  return DEFAULT_PORTFOLIO_COLUMNS.map((d) => byId.get(d.id) ?? d);
}

export async function loadKanbanConfig(
  tenantId: string
): Promise<KanbanConfig> {
  const tenant = await database.tenant.findFirst({
    where: { id: tenantId },
    select: { metadata: true },
  });
  const meta = (tenant?.metadata as TenantMetadata | null) ?? {};
  const stored = meta[METADATA_KEY];
  const parsed = stored ? KanbanConfigSchema.safeParse(stored) : null;
  return {
    columns: parsed?.success
      ? mergeWithDefaults(parsed.data.columns)
      : DEFAULT_PORTFOLIO_COLUMNS,
  };
}
