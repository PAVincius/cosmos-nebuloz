import { notFound } from "next/navigation";
import { getApprovalRequest } from "@/app/actions/governance";
import { listLeanBudgets } from "@/app/actions/lean-budget";
import { ApprovalDetail } from "./components/approval-detail";

type Props = { params: Promise<{ requestId: string }> };

export default async function ApprovalRequestPage({ params }: Props) {
  const { requestId } = await params;
  const [reqResult, budgetsResult] = await Promise.all([
    getApprovalRequest(requestId),
    listLeanBudgets(),
  ]);

  if (!reqResult.ok) {
    notFound();
  }

  const budgets = budgetsResult.ok ? budgetsResult.data : [];

  return (
    <div className="p-6">
      <ApprovalDetail budgets={budgets} request={reqResult.data} />
    </div>
  );
}
