// registry.tsx — maps a screen id to its ported component. Screens not listed
// here fall back to <ComingSoon> in the route. Add entries as screens land.
import type { ComponentType } from "react";
import DashboardScreen from "./dashboard";
import EpicDetailScreen from "./epic-detail";
import FlowScreen from "./flow";
import KanbanScreen from "./kanban";
import OkrsScreen from "./okrs";
import PiPlanningScreen from "./piplanning";
import ProgramScreen from "./program";
import RisksScreen from "./risks";
import TeamsScreen from "./teams";
import WsjfScreen from "./wsjf";

export type ScreenProps = { param?: string };

export const SCREENS: Record<string, ComponentType<ScreenProps>> = {
  dashboard: DashboardScreen,
  epic: EpicDetailScreen,
  kanban: KanbanScreen,
  wsjf: WsjfScreen,
  teams: TeamsScreen,
  okrs: OkrsScreen,
  risks: RisksScreen,
  flow: FlowScreen,
  program: ProgramScreen,
  piplanning: PiPlanningScreen,
};
