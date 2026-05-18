/**
 * Parameters for WSJF (Weighted Shortest Job First) calculation
 */
export interface WSJFParameters {
  /** Business Value (1, 2, 3, 5, 8, 13, 20) */
  bv: number;
  /** Time Criticality (1, 2, 3, 5, 8, 13, 20) */
  tc: number;
  /** Risk Reduction / Opportunity Enablement (1, 2, 3, 5, 8, 13, 20) */
  rr: number;
  /** Job Size (1, 2, 3, 5, 8, 13, 20) */
  js: number;
}

/**
 * Calculates the Weighted Shortest Job First (WSJF) score.
 * Formula: (Business Value + Time Criticality + Risk Reduction) / Job Size
 * 
 * @param params The WSJF parameters
 * @returns The calculated WSJF score, rounded to 2 decimal places. Returns 0 if job size is invalid.
 */
export function calculateWSJF({ bv, tc, rr, js }: WSJFParameters): number {
  if (!js || js <= 0) {
    return 0; // Prevent division by zero or negative size
  }

  const costOfDelay = bv + tc + rr;
  const wsjf = costOfDelay / js;

  // Round to 2 decimal places
  return Math.round(wsjf * 100) / 100;
}
