import type { ComponentType } from "react";
import BaselineDetailScreen from "./baseline-detail";
import BaselinesScreen from "./baselines";
import MembersScreen from "./members";
import PortfolioScreen from "./portfolio";
import TemplatesScreen from "./templates";
import TrackDetailScreen from "./track-detail";

// Registry de telas do Scaffold.
//
// Só é importado pela rota e pelo layout (Server Components). O shell é
// "use client" e recebe apenas `screenIds: string[]`: as telas são módulos
// pesados, e arrastá-las para o bundle do cliente pela casca desfaz o ganho de
// a rota ser única. Ids ausentes caem em <ComingSoon> na rota.

export type ScreenProps = { param?: string };

export const SCREENS: Record<string, ComponentType<ScreenProps>> = {
  portfolio: PortfolioScreen,
  track: TrackDetailScreen,
  baselines: BaselinesScreen,
  baseline: BaselineDetailScreen,
  templates: TemplatesScreen,
  members: MembersScreen,
};
