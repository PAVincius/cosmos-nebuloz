// registry.tsx — mapeia id de tela para o componente. Ids ausentes caem em
// <ComingSoon> na rota, e a nav renderiza o item desabilitado em vez de um link
// morto. Importado só pelo layout (Server Component); o shell recebe as chaves.
import type { ComponentType } from "react";
import AssessmentDetailScreen from "./assessment-detail";
import AssessmentsScreen from "./assessments";
import BenchmarkScreen from "./benchmark";
import ConfidenceScaleScreen from "./confidence-scale";
import GapRegisterScreen from "./gap-register";
import QueueScreen from "./queue";
import RespondentPreviewScreen from "./respondent-preview";

export type ScreenProps = { param?: string };

export const SCREENS: Record<string, ComponentType<ScreenProps>> = {
  assessments: AssessmentsScreen,
  assessment: AssessmentDetailScreen,
  queue: QueueScreen,
  benchmark: BenchmarkScreen,
  registry: GapRegisterScreen,
  confidence: ConfidenceScaleScreen,
  respondent: RespondentPreviewScreen,
};
