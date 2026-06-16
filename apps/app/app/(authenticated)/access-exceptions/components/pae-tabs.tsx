"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import type { PAERequest } from "@/app/actions/pae/schema";
import { PAERow } from "./pae-row";

type PAETabsProps = {
  requests: PAERequest[];
  currentUserId: string;
  currentUserRole: string;
};

export function PAETabs({
  requests,
  currentUserId,
  currentUserRole,
}: PAETabsProps) {
  const now = new Date();

  const pending = requests.filter((r) => r.status === "PENDING");
  const active = requests.filter(
    (r) => r.status === "APPROVED" && r.expiresAt && new Date(r.expiresAt) > now
  );
  const history = requests.filter(
    (r) =>
      r.status === "DENIED" ||
      r.status === "REVOKED" ||
      (r.status === "APPROVED" && r.expiresAt && new Date(r.expiresAt) <= now)
  );

  function canApproveReq(req: PAERequest): boolean {
    return req.requesterId !== currentUserId;
  }

  const rowProps = { currentUserId, currentUserRole };

  return (
    <Tabs defaultValue="pending">
      <TabsList>
        <TabsTrigger value="pending">
          Pendentes{pending.length > 0 ? ` (${pending.length})` : ""}
        </TabsTrigger>
        <TabsTrigger value="active">
          Ativos{active.length > 0 ? ` (${active.length})` : ""}
        </TabsTrigger>
        <TabsTrigger value="history">Histórico</TabsTrigger>
      </TabsList>

      <TabsContent className="mt-4 space-y-3" value="pending">
        {pending.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhuma solicitação pendente.
          </p>
        ) : (
          pending.map((r) => (
            <PAERow
              key={r.id}
              req={r}
              {...rowProps}
              canApprove={canApproveReq(r)}
            />
          ))
        )}
      </TabsContent>

      <TabsContent className="mt-4 space-y-3" value="active">
        {active.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum grant ativo.</p>
        ) : (
          active.map((r) => (
            <PAERow key={r.id} req={r} {...rowProps} canApprove={false} />
          ))
        )}
      </TabsContent>

      <TabsContent className="mt-4 space-y-3" value="history">
        {history.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sem histórico.</p>
        ) : (
          history.map((r) => (
            <PAERow key={r.id} req={r} {...rowProps} canApprove={false} />
          ))
        )}
      </TabsContent>
    </Tabs>
  );
}
