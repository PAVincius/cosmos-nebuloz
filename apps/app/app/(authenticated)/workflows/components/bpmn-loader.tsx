"use client";

import dynamic from "next/dynamic";

/**
 * BpmnLoader — Client Component intermediário
 *
 * O `next/dynamic` com `ssr: false` DEVE ser usado dentro de um Client Component.
 * Em Server Components (pages.tsx async), o `ssr: false` não é permitido no Next.js 15+.
 *
 * Este wrapper resolve o problema: o page.tsx (Server Component) importa este
 * componente (Client Component) que por sua vez carrega o BpmnWrapper dinamicamente.
 */
const BpmnWrapperDynamic = dynamic(
  () => import("./bpmn-wrapper").then((m) => m.BpmnWrapper),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center rounded-xl border bg-background/50 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="animate-pulse text-muted-foreground text-xs">
            Carregando motor BPMN.js corporativo...
          </p>
        </div>
      </div>
    ),
  }
);

type BpmnLoaderProps = {
  teamId: string;
  initialXml?: string;
  onSave?: (xmlContent: string) => Promise<void>;
};

export function BpmnLoader({ teamId, initialXml, onSave }: BpmnLoaderProps) {
  return (
    <BpmnWrapperDynamic
      initialXml={initialXml}
      onSave={onSave}
      teamId={teamId}
    />
  );
}
