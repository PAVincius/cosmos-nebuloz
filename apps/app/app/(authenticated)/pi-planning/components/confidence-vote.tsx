"use client";

import { LiveMap } from "@liveblocks/client";
import { useMutation, useSelf, useStorage } from "@repo/collaboration/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  Loader2Icon,
  PlayIcon,
  RefreshCwIcon,
  StopCircleIcon,
  VoteIcon,
} from "lucide-react";
import { useState } from "react";

export function ConfidenceVote() {
  const me = useSelf();

  // Storage synced across all clients
  const piState = useStorage((root) => root.piState) || "NOT_STARTED";
  const piVotes = useStorage((root) => root.piVotes);

  const [selectedVote, setSelectedVote] = useState<number>(3);

  // Computed values
  const votesArray = piVotes ? Array.from(piVotes.values()) : [];
  const totalVotes = votesArray.length;
  const averageVote =
    totalVotes > 0
      ? (votesArray.reduce((a, b) => a + b, 0) / totalVotes).toFixed(1)
      : "0.0";

  const hasVoted = piVotes && me ? piVotes.has(me.id) : false;

  const setPiState = useMutation(({ storage }, newState: string) => {
    storage.set("piState", newState);
    // If starting a new session, clear votes
    if (newState === "OPEN") {
      storage.set("piVotes", new LiveMap<string, number>());
    }
  }, []);

  const submitVote = useMutation(
    ({ storage }, vote: number) => {
      let votesMap = storage.get("piVotes");
      if (!votesMap) {
        votesMap = new LiveMap<string, number>();
        storage.set("piVotes", votesMap);
      }
      if (me?.id) {
        votesMap.set(me.id, vote);
      }
    },
    [me?.id]
  );

  if (!me) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Conectando...</span>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <VoteIcon className="h-5 w-5 text-primary" />
            Confidence Vote{" "}
            <span className="ml-auto rounded bg-muted px-2 py-1 font-normal text-muted-foreground text-xs">
              Live
            </span>
          </CardTitle>
          <CardDescription>
            Fist of Five: Vote de 1 (Sem Confiança) a 5 (Alta Confiança) no
            Plano do PI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-[300px] flex-col items-center justify-center space-y-4 rounded-lg bg-muted/30 p-6">
            <h3 className="mb-2 font-medium text-lg text-muted-foreground uppercase tracking-wider">
              Status Atual:{" "}
              <span className="font-bold text-primary">{piState}</span>
            </h3>

            {piState === "NOT_STARTED" && (
              <p className="text-center text-muted-foreground text-sm">
                A votação ainda não foi iniciada. Quando o plano estiver
                revisado, o RTE deve iniciar a cerimônia.
              </p>
            )}

            {piState === "OPEN" && (
              <div className="flex w-full flex-col items-center space-y-4">
                {hasVoted ? (
                  <div className="flex flex-col items-center space-y-2 py-6 text-green-600 dark:text-green-500">
                    <CheckCircleIcon className="h-12 w-12" />
                    <p className="font-semibold">
                      Seu voto foi registrado com sucesso!
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Aguardando outros membros votarem...
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm">
                      Selecione seu nível de confiança (1-5):
                    </p>
                    <div className="flex w-full justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <Button
                          className="h-12 w-12 font-bold text-lg"
                          key={v}
                          onClick={() => setSelectedVote(v)}
                          variant={selectedVote === v ? "default" : "outline"}
                        >
                          {v}
                        </Button>
                      ))}
                    </div>
                    <Button
                      className="mt-4 w-full max-w-xs"
                      onClick={() => submitVote(selectedVote)}
                    >
                      Confirmar Voto
                    </Button>
                  </>
                )}
                <div className="mt-4 w-full border-t pt-4 text-center text-muted-foreground text-sm">
                  Total de votos computados na sala:{" "}
                  <strong>{totalVotes}</strong>
                </div>
              </div>
            )}

            {piState === "TALLYING" && (
              <div className="flex flex-col items-center space-y-4">
                <div className="grid grid-cols-2 gap-8 rounded-xl border bg-background p-6 text-center shadow-sm">
                  <div>
                    <p className="text-muted-foreground text-sm">
                      Total de Votos
                    </p>
                    <p className="font-bold text-4xl">{totalVotes}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      Média (Fist of 5)
                    </p>
                    <p className="font-bold text-4xl text-primary">
                      {averageVote}
                    </p>
                  </div>
                </div>
                <p className="mt-4 max-w-md text-center text-sm">
                  Se a média for aceitável e nenhum membro tiver restrições
                  bloqueantes (voto 1 ou 2 sem resolução), o PI pode ser
                  aprovado pelo RTE.
                </p>
              </div>
            )}

            {piState === "REWORK" && (
              <div className="flex flex-col items-center space-y-2 py-4 text-destructive">
                <AlertTriangleIcon className="h-12 w-12" />
                <p className="font-semibold text-lg">
                  Plano requer ajustes (Rework)
                </p>
                <p className="max-w-sm text-center text-muted-foreground text-sm">
                  A votação indicou baixa confiança. O ART deve resolver as
                  dependências e impedimentos antes de uma nova votação.
                </p>
              </div>
            )}

            {piState === "APPROVED" && (
              <div className="flex flex-col items-center space-y-2 py-4 text-green-600 dark:text-green-500">
                <CheckCircleIcon className="h-16 w-16" />
                <h2 className="font-bold text-2xl">PI Aprovado!</h2>
                <p className="text-sm">
                  A confiança do time foi atingida e o plano está comprometido.
                </p>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t bg-muted/10 p-6">
          {piState === "NOT_STARTED" && (
            <Button className="w-full" onClick={() => setPiState("OPEN")}>
              <PlayIcon className="mr-2 h-4 w-4" />
              Iniciar Cerimônia (Todos)
            </Button>
          )}

          {piState === "OPEN" && (
            <Button
              className="w-full"
              onClick={() => setPiState("TALLYING")}
              variant="secondary"
            >
              <StopCircleIcon className="mr-2 h-4 w-4" />
              Encerrar e Apurar
            </Button>
          )}

          {piState === "TALLYING" && (
            <div className="flex w-full gap-4">
              <Button
                className="w-1/2"
                onClick={() => setPiState("REWORK")}
                variant="destructive"
              >
                <AlertTriangleIcon className="mr-2 h-4 w-4" />
                Requer Retrabalho
              </Button>
              <Button
                className="w-1/2 bg-green-600 text-white hover:bg-green-700"
                onClick={() => setPiState("APPROVED")}
              >
                <CheckCircleIcon className="mr-2 h-4 w-4" />
                Aprovar Plano
              </Button>
            </div>
          )}

          {piState === "REWORK" && (
            <Button
              className="w-full"
              onClick={() => setPiState("OPEN")}
              variant="outline"
            >
              <RefreshCwIcon className="mr-2 h-4 w-4" />
              Nova Votação
            </Button>
          )}

          {piState === "APPROVED" && (
            <div className="flex w-full justify-center text-center text-muted-foreground text-sm">
              <span className="rounded-full border bg-background px-4 py-2 shadow-sm">
                O ciclo de planejamento foi encerrado com sucesso.
              </span>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
