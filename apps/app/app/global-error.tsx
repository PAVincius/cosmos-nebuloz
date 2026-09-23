"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { fonts } from "@repo/design-system/lib/fonts";
import { captureException } from "@sentry/nextjs";
import type NextError from "next/error";
import { useEffect } from "react";

type GlobalErrorProperties = {
  readonly error: NextError & { digest?: string };
  readonly reset: () => void;
};

const GlobalError = ({ error, reset }: GlobalErrorProperties) => {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <html className={fonts} lang="pt-BR">
      <body>
        <h1>Algo quebrou</h1>
        <Button onClick={() => reset()}>Tentar de novo</Button>
      </body>
    </html>
  );
};

export default GlobalError;
