// Onboarding wizard state machine (story-044 AC-001, AC-002)

export const ONBOARDING_STEPS = [
  "org-setup",
  "art-setup",
  "invite-members",
  "connect-integration",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type OnboardingData = {
  orgName?: string;
  artId?: string;
  invitedEmails?: string[];
  integrationConnected?: boolean;
};

export type OnboardingState = {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  data: OnboardingData;
};

export function getDefaultState(): OnboardingState {
  return {
    currentStep: ONBOARDING_STEPS[0],
    completedSteps: [],
    data: {},
  };
}

export function markStepComplete(
  state: OnboardingState,
  step: OnboardingStep
): OnboardingState {
  const alreadyDone = state.completedSteps.includes(step);
  const completedSteps = alreadyDone
    ? state.completedSteps
    : [...state.completedSteps, step];

  const stepIdx = ONBOARDING_STEPS.indexOf(step);
  const nextStep = ONBOARDING_STEPS[stepIdx + 1] ?? step;

  return {
    ...state,
    completedSteps,
    currentStep: nextStep,
  };
}

export function isOnboardingComplete(state: OnboardingState): boolean {
  return ONBOARDING_STEPS.every((s) => state.completedSteps.includes(s));
}

export function getNextStep(state: OnboardingState): OnboardingStep | null {
  const idx = ONBOARDING_STEPS.indexOf(state.currentStep);
  return ONBOARDING_STEPS[idx + 1] ?? null;
}

export function resumeAtStep(state: OnboardingState): OnboardingStep {
  return state.currentStep;
}

export function isStepCompleted(
  state: OnboardingState,
  step: OnboardingStep
): boolean {
  return state.completedSteps.includes(step);
}
