// registry.tsx — maps a screen id to its ported component. Screens not listed
// here fall back to <ComingSoon> in the route. Add entries as screens land.
import type { ComponentType } from "react";
import BudgetsScreen from "./budgets";
import CapacityScreen from "./capacity";
import DashboardScreen from "./dashboard";
import DecisionsScreen from "./decisions";
import DependenciesScreen from "./dependencies";
import EpicDetailScreen from "./epic-detail";
import FeatureDetailScreen from "./feature-detail";
import FlowScreen from "./flow";
import GovernanceScreen from "./governance";
import IntegrationsScreen from "./integrations";
import KanbanScreen from "./kanban";
import MeasureScreen from "./measure";
import OkrsScreen from "./okrs";
import PiPlanningScreen from "./piplanning";
import ProgramScreen from "./program";
import RisksScreen from "./risks";
import RoadmapScreen from "./roadmap";
import SettingsScreen from "./settings";
import SolutionTrainScreen from "./solution-train";
import StrategyScreen from "./strategy";
import TagsScreen from "./tags";
import TeamDetailScreen from "./team-detail";
import TeamsScreen from "./teams";
import ThemesScreen from "./themes";
import VelocityScreen from "./velocity";
import WebhooksScreen from "./webhooks";
import WorkflowsScreen from "./workflows";
import WsjfScreen from "./wsjf";

export type ScreenProps = { param?: string };

export const SCREENS: Record<string, ComponentType<ScreenProps>> = {
  dashboard: DashboardScreen,
  decisions: DecisionsScreen,
  budgets: BudgetsScreen,
  capacity: CapacityScreen,
  dependencies: DependenciesScreen,
  epic: EpicDetailScreen,
  feature: FeatureDetailScreen,
  kanban: KanbanScreen,
  measure: MeasureScreen,
  wsjf: WsjfScreen,
  teams: TeamsScreen,
  team: TeamDetailScreen,
  okrs: OkrsScreen,
  risks: RisksScreen,
  roadmap: RoadmapScreen,
  flow: FlowScreen,
  governance: GovernanceScreen,
  integrations: IntegrationsScreen,
  program: ProgramScreen,
  piplanning: PiPlanningScreen,
  themes: ThemesScreen,
  tags: TagsScreen,
  solution: SolutionTrainScreen,
  strategy: StrategyScreen,
  settings: SettingsScreen,
  velocity: VelocityScreen,
  webhooks: WebhooksScreen,
  workflows: WorkflowsScreen,
};
