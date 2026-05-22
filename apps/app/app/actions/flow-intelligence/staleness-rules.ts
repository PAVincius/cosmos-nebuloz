export type StalenessState = "FRESH" | "AGING" | "STALE" | "CRITICAL";

export type StalenessInput = {
  snapshotRecordedAt: Date;
  sprintDurationDays: number;
  currentSpDelivered: number | null;
  snapshotSpDelivered: number | null;
  currentTeamCompositionHash: string | null;
  snapshotTeamCompositionHash: string | null;
  latestAssessmentAt: Date | null;
  currentFlowEfficiency: number | null;
  currentFlowPredictability: number | null;
  currentFlowLoadRatio: number | null;
  now: Date;
};

export type StalenessResult = {
  state: StalenessState;
  rules: string[];
};

const STATE_PRIORITY: Record<StalenessState, number> = {
  FRESH: 0,
  AGING: 1,
  STALE: 2,
  CRITICAL: 3,
};

function higher(a: StalenessState, b: StalenessState): StalenessState {
  return STATE_PRIORITY[a] >= STATE_PRIORITY[b] ? a : b;
}

export function computeStaleness(input: StalenessInput): StalenessResult {
  const rules: string[] = [];
  let state: StalenessState = "FRESH";

  // R1: Age
  const ageState = evaluateAgeRule(input, rules);
  state = higher(state, ageState);

  // R2: Velocity drift
  const velocityState = evaluateVelocityDriftRule(input, rules);
  state = higher(state, velocityState);

  // R3: Team composition change
  const compositionState = evaluateCompositionRule(input, rules);
  state = higher(state, compositionState);

  // R4: Assessment age
  const assessmentState = evaluateAssessmentAgeRule(input, rules);
  state = higher(state, assessmentState);

  // R5: Multi-metric threshold violations
  const multiMetricState = evaluateMultiMetricRule(input, rules);
  state = higher(state, multiMetricState);

  return { state, rules };
}

function evaluateAgeRule(
  input: StalenessInput,
  rules: string[]
): StalenessState {
  const ageDays =
    (input.now.getTime() - input.snapshotRecordedAt.getTime()) / 86_400_000;
  const ageSprints = ageDays / input.sprintDurationDays;

  if (ageSprints > 6) {
    rules.push("R1_AGE_CRITICAL");
    return "CRITICAL";
  }
  if (ageSprints > 4) {
    rules.push("R1_AGE_STALE");
    return "STALE";
  }
  if (ageSprints > 2) {
    rules.push("R1_AGE_AGING");
    return "AGING";
  }
  return "FRESH";
}

function evaluateVelocityDriftRule(
  input: StalenessInput,
  rules: string[]
): StalenessState {
  if (
    input.currentSpDelivered !== null &&
    input.snapshotSpDelivered !== null &&
    input.snapshotSpDelivered > 0
  ) {
    const ratio = input.currentSpDelivered / input.snapshotSpDelivered;
    if (ratio < 0.8) {
      rules.push("R2_VELOCITY_DRIFT");
      return "STALE";
    }
  }
  return "FRESH";
}

function evaluateCompositionRule(
  input: StalenessInput,
  rules: string[]
): StalenessState {
  if (
    input.currentTeamCompositionHash !== null &&
    input.snapshotTeamCompositionHash !== null &&
    input.currentTeamCompositionHash !== input.snapshotTeamCompositionHash
  ) {
    rules.push("R3_COMPOSITION_CHANGE");
    return "STALE";
  }
  return "FRESH";
}

function evaluateAssessmentAgeRule(
  input: StalenessInput,
  rules: string[]
): StalenessState {
  if (input.latestAssessmentAt !== null) {
    const assessmentAgeDays =
      (input.now.getTime() - input.latestAssessmentAt.getTime()) / 86_400_000;
    if (assessmentAgeDays > 90) {
      rules.push("R4_ASSESSMENT_AGE");
      return "STALE";
    }
  }
  return "FRESH";
}

function evaluateMultiMetricRule(
  input: StalenessInput,
  rules: string[]
): StalenessState {
  let breaches = 0;

  if (
    input.currentFlowEfficiency !== null &&
    input.currentFlowEfficiency < 0.4
  ) {
    breaches += 1;
  }
  if (
    input.currentFlowPredictability !== null &&
    input.currentFlowPredictability < 0.6
  ) {
    breaches += 1;
  }
  if (input.currentFlowLoadRatio !== null && input.currentFlowLoadRatio > 1.2) {
    breaches += 1;
  }

  if (breaches >= 2) {
    rules.push("R5_MULTI_METRIC");
    return "STALE";
  }
  return "FRESH";
}
