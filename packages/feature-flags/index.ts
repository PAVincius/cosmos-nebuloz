import { createFlag } from "./lib/create-flag";
import { createPlanFlag } from "./lib/create-plan-flag";

// Generic PostHog-based flag (user-level overrides)
export const showBetaFeature = createFlag("showBetaFeature");

// ── Galaxy+ ──────────────────────────────────────────────────────
export const aiCopilot = createPlanFlag("aiCopilot", "GALAXY");
export const bpmnWorkflows = createPlanFlag("bpmnWorkflows", "GALAXY");
export const realtimeCollab = createPlanFlag("realtimeCollab", "GALAXY");
export const jiraIntegration = createPlanFlag("jiraIntegration", "GALAXY");
export const wsjfAdvanced = createPlanFlag("wsjfAdvanced", "GALAXY");

// ── Nebula+ ───────────────────────────────────────────────────────
export const solutionTrain = createPlanFlag("solutionTrain", "NEBULA");
export const samlSso = createPlanFlag("samlSso", "NEBULA");
export const auditLogs = createPlanFlag("auditLogs", "NEBULA");
export const advancedAnalytics = createPlanFlag("advancedAnalytics", "NEBULA");
export const githubActionsIntegration = createPlanFlag("githubActionsIntegration", "NEBULA");

// ── Universe ──────────────────────────────────────────────────────
export const onPremise = createPlanFlag("onPremise", "UNIVERSE");
export const whiteLabel = createPlanFlag("whiteLabel", "UNIVERSE");
