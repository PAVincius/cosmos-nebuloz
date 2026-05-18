import dynamic from "next/dynamic";
import { getOrgId } from "@repo/auth/server";
import { Room } from "@repo/collaboration/room";
import { notFound } from "next/navigation";

const ConfidenceVote = dynamic(
  () => import("./components/confidence-vote").then((m) => m.ConfidenceVote),
  {
    loading: () => (
      <div className="flex h-64 items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground text-sm">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
        <span>A carregar votação de confiança…</span>
      </div>
    ),
  }
);

export const metadata = {
  title: "PI Planning | Votação de confiança | COSMOS",
};

export default async function PIPlanningPage() {
  const orgId = await getOrgId();
  if (!orgId) notFound();

  return (
    <div className="w-full min-w-0 space-y-8 px-6 py-10">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Votação de confiança</h1>
        <p className="text-muted-foreground">
          Cerimónia de encerramento do PI Planning — avalie a confiança do ART no plano do próximo
          Program Increment (Fist of Five).
        </p>
      </div>

      <Room
        id={`pi-planning-${orgId}`}
        authEndpoint="/api/collaboration/auth"
        fallback={
          <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-4 animate-pulse">
              <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              <p className="text-muted-foreground text-sm">A ligar à sessão…</p>
            </div>
          </div>
        }
      >
        <ConfidenceVote />
      </Room>
    </div>
  );
}
