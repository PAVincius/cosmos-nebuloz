type SlaCheckResult = {
  stepId: string;
  approvalRequestId: string;
  epicId: string | null;
  tenantId: string;
  slaDeadline: Date;
  backupApproverId: string | null;
};

export function isBreached(
  slaDeadline: Date,
  asOf: Date = new Date()
): boolean {
  return slaDeadline < asOf;
}

export function hoursUntilBreach(
  slaDeadline: Date,
  asOf: Date = new Date()
): number {
  return (slaDeadline.getTime() - asOf.getTime()) / (1000 * 60 * 60);
}
