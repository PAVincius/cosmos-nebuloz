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
          {!!epic.themeTitle && (
            <span
              className="w-fit rounded-full px-2 py-0.5 font-medium text-xs"
              style={{
                backgroundColor: `${epic.themeColor}22`,
                color: epic.themeColor ?? undefined,
                border: `1px solid ${epic.themeColor}44`,
              }}
            >
              {epic.themeTitle}
            </span>
          )}
        </SheetHeader>

        <Tabs
          className="flex flex-1 flex-col overflow-hidden"
          defaultValue="description"
        >
          <TabsList className="h-auto w-full justify-start rounded-none border-b bg-transparent px-6 py-0">
            <TabsTrigger
              className="rounded-none border-transparent border-b-2 pt-3 pb-3 data-[state=active]:border-primary"
              value="description"
            >
              Descrição
            </TabsTrigger>
            <TabsTrigger
              className="rounded-none border-transparent border-b-2 pt-3 pb-3 data-[state=active]:border-primary"
              value="invest"
            >
              Análise IA
            </TabsTrigger>
            <TabsTrigger
              className="rounded-none border-transparent border-b-2 pt-3 pb-3 data-[state=active]:border-primary"
              value="dependencies"
            >
              Dependências
            </TabsTrigger>
            <TabsTrigger
              className="rounded-none border-transparent border-b-2 pt-3 pb-3 data-[state=active]:border-primary"
              value="more"
            >
              Mais
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <TabsContent className="mt-0 h-full" value="description">
              <EpicDrawerDescription epic={epic} />
            </TabsContent>
            <TabsContent className="mt-0" value="invest">
              <EpicDrawerInvest epic={epic} />
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
