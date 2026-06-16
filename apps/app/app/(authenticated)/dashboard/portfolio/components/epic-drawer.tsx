"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import type { AggregatedPortfolioEpic } from "@/lib/portfolio-aggregate";
import { EpicDrawerDependencies } from "./epic-drawer-dependencies";
import { EpicDrawerDescription } from "./epic-drawer-description";
import { EpicDrawerHypothesis } from "./epic-drawer-hypothesis";
import { EpicDrawerInvest } from "./epic-drawer-invest";
import { EpicDrawerMore } from "./epic-drawer-more";

type EpicDrawerProps = {
  epicId: string;
  epic: AggregatedPortfolioEpic | null;
  onClose: () => void;
};

export function EpicDrawer({ epicId, epic, onClose }: EpicDrawerProps) {
  if (!epic) {
    return null;
  }

  return (
    <Sheet
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open
    >
      <SheetContent
        className="flex w-full flex-col p-0 sm:max-w-2xl"
        side="right"
      >
        <SheetHeader className="border-b px-6 pt-6 pb-4">
          <SheetTitle className="font-semibold text-xl">
            {epic.title}
          </SheetTitle>
          {!!epic.themeTitle &&
            (() => {
              const tc = epic.themeColor ?? "#888";
              return (
                <span
                  className="w-fit rounded-full px-2 py-0.5 font-medium text-xs"
                  style={{
                    backgroundColor: `${tc}22`,
                    color: tc,
                    border: `1px solid ${tc}44`,
                  }}
                >
                  {epic.themeTitle}
                </span>
              );
            })()}
        </SheetHeader>

        <Tabs
          className="flex flex-1 flex-col overflow-hidden"
          defaultValue="description"
        >
          <TabsList className="!bg-transparent h-auto w-full justify-start gap-1 rounded-none border-b px-6 py-0">
            {(
              [
                { value: "description", label: "Descrição" },
                { value: "invest", label: "Análise IA" },
                { value: "hypothesis", label: "Hipótese" },
                { value: "dependencies", label: "Dependências" },
                { value: "more", label: "Mais" },
              ] as const
            ).map(({ value, label }) => (
              <TabsTrigger
                className="!rounded-none !border-x-0 !border-t-0 !border-b-transparent !text-muted-foreground !shadow-none hover:!text-foreground data-[state=active]:!border-b-primary data-[state=active]:!bg-transparent data-[state=active]:!text-foreground data-[state=active]:!shadow-none border-b-2 px-3 pt-3 pb-3 font-medium text-sm transition-colors"
                key={value}
                value={value}
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <TabsContent className="mt-0 h-full" value="description">
              <EpicDrawerDescription epic={epic} />
            </TabsContent>
            <TabsContent className="mt-0" value="invest">
              <EpicDrawerInvest epic={epic} />
            </TabsContent>
            <TabsContent className="mt-0" value="hypothesis">
              <EpicDrawerHypothesis epicId={epicId} />
            </TabsContent>
            <TabsContent className="mt-0" value="dependencies">
              <EpicDrawerDependencies epicId={epicId} />
            </TabsContent>
            <TabsContent className="mt-0" value="more">
              <EpicDrawerMore epic={epic} />
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
