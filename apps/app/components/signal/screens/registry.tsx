import type { ComponentType } from "react";
import AlertsScreen from "./alerts";
import AuditScreen from "./audit";
import ConnectionsScreen from "./connections";
import EvidenceScreen from "./evidence";
import InitiativeDetailScreen from "./initiative-detail";
import InitiativesScreen from "./initiatives";
import MappingScreen from "./mapping";
import ModelsScreen from "./models";
import OverviewScreen from "./overview";
import ReportsScreen from "./reports";
import SettingsScreen from "./settings";

// Registro de telas do Signal.
//
// Importado SÓ pelo layout (Server Component). A casca é "use client" e não
// pode importar este arquivo. Só as chaves string cruzam a fronteira, via
// `screenIds`.
//
// Uma tela ausente daqui aparece na nav como item desabilitado com motivo
// ("em construção"), nunca como link morto. É por isso que o registro é a fonte
// da verdade do que existe, e não a NAV.

export type ScreenProps = { param?: string };

export const SCREENS: Record<string, ComponentType<ScreenProps>> = {
  overview: OverviewScreen,
  initiatives: InitiativesScreen,
  initiative: InitiativeDetailScreen,
  connections: ConnectionsScreen,
  mapping: MappingScreen,
  models: ModelsScreen,
  evidence: EvidenceScreen,
  alerts: AlertsScreen,
  reports: ReportsScreen,
  audit: AuditScreen,
  settings: SettingsScreen,
};
