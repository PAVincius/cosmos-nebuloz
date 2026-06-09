import { database } from "@repo/database";
import { log } from "@repo/observability/log";

export type SupplierDelayAlert = {
  deliverableId: string;
  supplierId: string;
  featureId: string;
  expectedDate: Date;
  daysOverdue: number;
};

export async function detectSupplierDelays(
  tenantId: string,
  asOf: Date = new Date()
): Promise<SupplierDelayAlert[]> {
  const overdue = await database.supplierDeliverable.findMany({
    where: {
      tenantId,
      expectedDate: { lt: asOf },
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
    select: {
      id: true,
      supplierId: true,
      featureId: true,
      expectedDate: true,
    },
  });

  const alerts: SupplierDelayAlert[] = overdue.map((d) => ({
    deliverableId: d.id,
    supplierId: d.supplierId,
    featureId: d.featureId,
    expectedDate: d.expectedDate,
    daysOverdue: Math.floor(
      (asOf.getTime() - d.expectedDate.getTime()) / (1000 * 60 * 60 * 24)
    ),
  }));

  if (alerts.length > 0) {
    log.error("[supplier-delay] delayed deliverables detected", {
      tenantId,
      count: alerts.length,
    });
  }

  return alerts;
}

export async function markDelayedDeliverables(
  tenantId: string,
  asOf: Date = new Date()
): Promise<number> {
  const result = await database.supplierDeliverable.updateMany({
    where: {
      tenantId,
      expectedDate: { lt: asOf },
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
    data: { status: "DELAYED" },
  });
  return result.count;
}
