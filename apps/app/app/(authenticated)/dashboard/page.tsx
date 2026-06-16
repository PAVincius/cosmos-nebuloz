import type { Metadata } from "next";
import Link from "next/link";
import {
  getGlobalHomeData,
  getHomeConfig,
  getLpmHomeData,
  getPmHomeData,
  getRteHomeData,
  getSmHomeData,
} from "@/app/actions/home";
import GlobalHome from "./components/personas/global-home";
import LpmHome from "./components/personas/lpm-home";
import PmHome from "./components/personas/pm-home";
import RteHome from "./components/personas/rte-home";
import SmHome from "./components/personas/sm-home";

export const metadata: Metadata = { title: "Home | COSMOS" };

export default async function DashboardPage() {
  const configResult = await getHomeConfig();
  const config = configResult.ok
    ? configResult.data
    : { persona: "global" as const, hiddenCells: [], activeView: "" };

  let homeContent: React.ReactNode;

  switch (config.persona) {
    case "rte": {
      const result = await getRteHomeData();
      const data = result.ok
        ? result.data
        : {
            arts: [],
            risks: [],
            notifications: [],
            piObjectives: [],
            okrs: [],
          };
      homeContent = <RteHome {...data} activeView={config.activeView} />;
      break;
    }
    case "team": {
      const result = await getSmHomeData();
      const data = result.ok
        ? result.data
        : {
            team: null,
            impediments: [],
            notifications: [],
            activeSprint: null,
            teamOkrs: [],
          };
      homeContent = <SmHome {...data} activeView={config.activeView} />;
      break;
    }
    case "pm": {
      const result = await getPmHomeData();
      const data = result.ok
        ? result.data
        : { okrs: [], notifications: [], piObjectives: [] };
      homeContent = <PmHome {...data} activeView={config.activeView} />;
      break;
    }
    case "lpm": {
      const result = await getLpmHomeData();
      const data = result.ok
        ? result.data
        : { leanBudgets: [], notifications: [], arts: [], pendingEpics: [] };
      homeContent = <LpmHome {...data} activeView={config.activeView} />;
      break;
    }
    default: {
      const result = await getGlobalHomeData();
      const data = result.ok ? result.data : { arts: [], notifications: [] };
      homeContent = <GlobalHome {...data} />;
      break;
    }
  }

  return (
    <div style={{ padding: "28px 32px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: "-0.4px",
              color: "#f7f8f8",
              margin: 0,
            }}
          >
            Bom dia 👋
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "#8a8f98",
              margin: "4px 0 0",
            }}
          >
            Aqui está o resumo do seu contexto atual.
          </p>
        </div>
        <Link
          href="/profile"
          style={{
            fontSize: 12,
            color: "#5e6ad2",
            textDecoration: "none",
          }}
        >
          Trocar persona
        </Link>
      </div>

      {homeContent}
    </div>
  );
}
