"use client";

import { useStorage, useMutation, useSelf } from "@repo/collaboration/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import { CheckCircleIcon, RefreshCwIcon, PlayIcon, StopCircleIcon, VoteIcon, AlertTriangleIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { LiveMap } from "@liveblocks/client";

export function ConfidenceVote() {
  const me = useSelf();
  
  // Storage synced across all clients
  const piState = useStorage((root) => root.piState) || 'NOT_STARTED';
  const piVotes = useStorage((root) => root.piVotes);
  
  const [selectedVote, setSelectedVote] = useState<number>(3);

  // Computed values
  const votesArray = piVotes ? Array.from(piVotes.values()) : [];
  const totalVotes = votesArray.length;
  const averageVote = totalVotes > 0 
    ? (votesArray.reduce((a, b) => a + b, 0) / totalVotes).toFixed(1)
    : "0.0";
    
  const hasVoted = piVotes && me ? piVotes.has(me.id) : false;

  const setPiState = useMutation(({ storage }, newState: string) => {
    storage.set("piState", newState);
    // If starting a new session, clear votes
    if (newState === 'OPEN') {
      storage.set("piVotes", new LiveMap<string, number>());
    }
  }, []);

  const submitVote = useMutation(({ storage }, vote: number) => {
    let votesMap = storage.get("piVotes");
    if (!votesMap) {
      votesMap = new LiveMap<string, number>();
      storage.set("piVotes", votesMap);
    }
    if (me?.id) {
      votesMap.set(me.id, vote);
    }
  }, [me?.id]);

  if (!me) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2Icon className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Conectando...</span>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <VoteIcon className="w-5 h-5 text-primary" />
            Confidence Vote <span className="ml-auto text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded">Live</span>
          </CardTitle>
          <CardDescription>
            Fist of Five: Vote de 1 (Sem Confiança) a 5 (Alta Confiança) no Plano do PI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center p-6 space-y-4 rounded-lg bg-muted/30 min-h-[300px] justify-center">
            <h3 className="text-lg font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Status Atual: <span className="text-primary font-bold">{piState}</span>
            </h3>
            
            {piState === 'NOT_STARTED' && (
              <p className="text-center text-sm text-muted-foreground">
                A votação ainda não foi iniciada. Quando o plano estiver revisado, o RTE deve iniciar a cerimônia.
              </p>
            )}

            {piState === 'OPEN' && (
              <div className="flex flex-col items-center space-y-4 w-full">
                {hasVoted ? (
                  <div className="flex flex-col items-center space-y-2 text-green-600 dark:text-green-500 py-6">
                    <CheckCircleIcon className="w-12 h-12" />
                    <p className="font-semibold">Seu voto foi registrado com sucesso!</p>
                    <p className="text-sm text-muted-foreground">Aguardando outros membros votarem...</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm">Selecione seu nível de confiança (1-5):</p>
                    <div className="flex gap-2 w-full justify-center">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <Button
                          key={v}
                          variant={selectedVote === v ? "default" : "outline"}
                          onClick={() => setSelectedVote(v)}
                          className="w-12 h-12 text-lg font-bold"
                        >
                          {v}
                        </Button>
                      ))}
                    </div>
                    <Button 
                      onClick={() => submitVote(selectedVote)}
                      className="w-full max-w-xs mt-4"
                    >
                      Confirmar Voto
                    </Button>
                  </>
                )}
                <div className="text-sm text-muted-foreground pt-4 border-t w-full text-center mt-4">
                  Total de votos computados na sala: <strong>{totalVotes}</strong>
                </div>
              </div>
            )}

            {piState === 'TALLYING' && (
              <div className="flex flex-col items-center space-y-4">
                <div className="grid grid-cols-2 gap-8 text-center bg-background border p-6 rounded-xl shadow-sm">
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Votos</p>
                    <p className="text-4xl font-bold">{totalVotes}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Média (Fist of 5)</p>
                    <p className="text-4xl font-bold text-primary">{averageVote}</p>
                  </div>
                </div>
                <p className="text-sm text-center max-w-md mt-4">
                  Se a média for aceitável e nenhum membro tiver restrições bloqueantes (voto 1 ou 2 sem resolução), o PI pode ser aprovado pelo RTE.
                </p>
              </div>
            )}

            {piState === 'REWORK' && (
              <div className="flex flex-col items-center space-y-2 text-destructive py-4">
                <AlertTriangleIcon className="w-12 h-12" />
                <p className="font-semibold text-lg">Plano requer ajustes (Rework)</p>
                <p className="text-sm text-center max-w-sm text-muted-foreground">
                  A votação indicou baixa confiança. O ART deve resolver as dependências e impedimentos antes de uma nova votação.
                </p>
              </div>
            )}

            {piState === 'APPROVED' && (
              <div className="flex flex-col items-center space-y-2 text-green-600 dark:text-green-500 py-4">
                <CheckCircleIcon className="w-16 h-16" />
                <h2 className="text-2xl font-bold">PI Aprovado!</h2>
                <p className="text-sm">A confiança do time foi atingida e o plano está comprometido.</p>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t p-6 bg-muted/10">
          {piState === 'NOT_STARTED' && (
            <Button onClick={() => setPiState('OPEN')} className="w-full">
              <PlayIcon className="w-4 h-4 mr-2" />
              Iniciar Cerimônia (Todos)
            </Button>
          )}

          {piState === 'OPEN' && (
            <Button variant="secondary" onClick={() => setPiState('TALLYING')} className="w-full">
              <StopCircleIcon className="w-4 h-4 mr-2" />
              Encerrar e Apurar
            </Button>
          )}

          {piState === 'TALLYING' && (
            <div className="flex gap-4 w-full">
              <Button variant="destructive" onClick={() => setPiState('REWORK')} className="w-1/2">
                <AlertTriangleIcon className="w-4 h-4 mr-2" />
                Requer Retrabalho
              </Button>
              <Button onClick={() => setPiState('APPROVED')} className="w-1/2 bg-green-600 hover:bg-green-700 text-white">
                <CheckCircleIcon className="w-4 h-4 mr-2" />
                Aprovar Plano
              </Button>
            </div>
          )}

          {piState === 'REWORK' && (
            <Button variant="outline" onClick={() => setPiState('OPEN')} className="w-full">
              <RefreshCwIcon className="w-4 h-4 mr-2" />
              Nova Votação
            </Button>
          )}
          
          {piState === 'APPROVED' && (
             <div className="w-full text-center text-sm text-muted-foreground flex justify-center">
               <span className="bg-background px-4 py-2 rounded-full border shadow-sm">
                 O ciclo de planejamento foi encerrado com sucesso.
               </span>
             </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
