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
        : {
            arts: [],
            teamCount: 0,
            activeEpicsCount: 0,
            epicsInProgress: [],
            currentPiName: null,
            predictabilityPct: null,
            sprintVelocities: [],
            throughputDeltaPct: null,
            themeAllocation: [],
            cloudCostMtd: 0,
          };
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

  // LpmHome renders its own cosmos.html-parity PageHeader (title, meta
  // badges, CTAs) — the generic banner below would duplicate it, so it's
  // skipped only for this persona. Other personas keep the shared banner
  // unchanged (out of this task's scope).
  if (config.persona === "lpm") {
    return <div>{homeContent}</div>;
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
            className="font-display"
            style={{
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "-0.4px",
              color: "var(--ink)",
              margin: 0,
            }}
          >
            Bom dia 👋
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--ink-muted)",
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
            color: "var(--accent-c)",
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
