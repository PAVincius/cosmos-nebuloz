"use client";

import { Button, ErrorState, PageHeader } from "@repo/design-system/cosmos/kit";
import { captureException } from "@sentry/nextjs";
import { useEffect } from "react";

// Sem este boundary, qualquer throw dentro de uma tela do Cosmos subia até
// app/global-error.tsx, que troca o documento inteiro — o usuário perdia a
// sidebar, a topbar e o contexto de onde estava. Aqui o shell continua
// montado e só a área de conteúdo reporta a falha.
type CosmosErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function CosmosError({ error, reset }: CosmosErrorProps) {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <div>
      <PageHeader
        subtitle="A tela não conseguiu carregar. Tentar de novo recarrega só esta área — a navegação continua funcionando."
        title="Algo quebrou nesta tela"
      >
        <Button icon="refresh" onClick={reset}>
          Tentar de novo
        </Button>
      </PageHeader>
      <ErrorState
        message={
          error.digest
            ? `${error.message} (ref. ${error.digest})`
            : error.message
        }
      />
    </div>
  );
}
