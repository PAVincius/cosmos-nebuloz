import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import {
  createCopilotSession,
  listCopilotSessions,
} from "@/app/actions/safe-copilot/sessions";
import { CopilotFullscreen } from "./components/copilot-fullscreen";

export const metadata = { title: "Copilot — Cosmos" };

export default async function CopilotPage() {
  await requireTenantSession(await headers());

  const [sessions, newSession] = await Promise.all([
    listCopilotSessions(),
    createCopilotSession("global", "global"),
  ]);

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col overflow-hidden">
      <CopilotFullscreen
        initialSessionId={newSession.id}
        initialSessions={sessions}
      />
    </div>
  );
}
