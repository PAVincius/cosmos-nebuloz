import { getOrgId } from "@repo/auth/server";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { env } from "@/env";
import { AvatarStack } from "./components/avatar-stack";
import { Cursors } from "./components/cursors";
import { Header } from "./components/header";
import { HomeDashboard } from "./components/home-dashboard";

const CollaborationProvider = dynamic(
  () =>
    import("./components/collaboration-provider").then(
      (mod) => mod.CollaborationProvider
    ),
  {
    loading: () => null,
  }
);

export const metadata: Metadata = {
  title: "Início | COSMOS",
  description: "Visão geral do portfólio SAFe, ARTs e times",
};

const App = async () => {
  const orgId = await getOrgId();

  if (!orgId) {
    notFound();
  }

  return (
    <>
      <Header page="Início" pages={["COSMOS"]}>
        {env.LIVEBLOCKS_SECRET && (
          <CollaborationProvider orgId={orgId}>
            <AvatarStack />
            <Cursors />
          </CollaborationProvider>
        )}
      </Header>
      <HomeDashboard />
    </>
  );
};

export default App;
