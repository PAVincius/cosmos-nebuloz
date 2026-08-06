// registry.tsx — mapeia id de tela para o componente. Ids ausentes caem em
// <ComingSoon> na rota, e a nav renderiza o item desabilitado em vez de um link
// morto. Importado só pelo layout (Server Component); o shell recebe as chaves.
import type { ComponentType } from "react";
import AuditScreen from "./audit";
import CaseDetailScreen from "./case-detail";
import CasesScreen from "./cases";
import ComplianceScreen from "./compliance";
import DashboardScreen from "./dashboard";
import OnboardingScreen from "./onboarding";
import PolicyScreen from "./policy";
import RiskScreen from "./risk";
import SettingsScreen from "./settings";
import VendorDetailScreen from "./vendor-detail";
import VendorsScreen from "./vendors";

export type ScreenProps = { param?: string };

export const SCREENS: Record<string, ComponentType<ScreenProps>> = {
  dashboard: DashboardScreen,
  policy: PolicyScreen,
  cases: CasesScreen,
  case: CaseDetailScreen,
  risk: RiskScreen,
  vendors: VendorsScreen,
  vendor: VendorDetailScreen,
  onboarding: OnboardingScreen,
  audit: AuditScreen,
  conformidade: ComplianceScreen,
  settings: SettingsScreen,
};
