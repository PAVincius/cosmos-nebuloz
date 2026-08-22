// Solution Train write-access guard (story-043 AC-005)

const SOLUTION_WRITE_ROLES: ReadonlySet<string> = new Set([
  "STE",
  "ENTERPRISE_ARCHITECT",
]);

export type SteGuardResult = {
  allowed: true;
};

export type SteGuardDenied = {
  allowed: false;
  code: "SOLUTION_TRAIN_ACCESS_REQUIRED";
};

export function checkSolutionWriteAccess(
  role: string
): SteGuardResult | SteGuardDenied {
  if (SOLUTION_WRITE_ROLES.has(role)) {
    return { allowed: true };
  }
  return { allowed: false, code: "SOLUTION_TRAIN_ACCESS_REQUIRED" };
}
