import { type NextRequest, NextResponse } from "next/server";
import { transitionEpicStatus } from "@/app/actions/epics/transition-status";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;

  // Explicitly whitelist client-supplied fields — userId/tenantId must NEVER come from the client
  const result = await transitionEpicStatus({
    epicId: id,
    event: body.event,
    reason: body.reason,
  });

  if (!result.ok) {
    // TransitionError sets message = code (e.g. "TERMINAL_STATE", "GUARD_FAILED")
    const errorCode = result.error;
    let status = 400;
    if (
      errorCode === "TERMINAL_STATE" ||
      errorCode === "INVALID_TRANSITION" ||
      errorCode === "GUARD_FAILED"
    ) {
      status = 422;
    } else if (errorCode === "FORBIDDEN") {
      status = 403;
    }
    return NextResponse.json(
      { ok: false, code: errorCode, error: result.error },
      { status }
    );
  }

  return NextResponse.json({ ok: true, data: result.data }, { status: 200 });
}
