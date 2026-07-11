"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { computeCompetencyMaturity } from "./maturity-utils";

const COMPETENCY_SHORT: Record<string, string> = {
  TEAM_TECHNICAL_AGILITY: "TTA",
  AGILE_PRODUCT_DELIVERY: "APD",
  ENTERPRISE_SOLUTION_DELIVERY: "ESD",
  LEAN_PORTFOLIO_MANAGEMENT: "LPM",
  ORGANIZATIONAL_AGILITY: "OA",
  CONTINUOUS_LEARNING_CULTURE: "CLC",
  LEAN_AGILE_LEADERSHIP: "LAL",
};

const COMPETENCY_LABEL: Record<string, string> = {
  TEAM_TECHNICAL_AGILITY: "Team & Technical Agility",
  AGILE_PRODUCT_DELIVERY: "Agile Product Delivery",
  ENTERPRISE_SOLUTION_DELIVERY: "Enterprise Solution Delivery",
  LEAN_PORTFOLIO_MANAGEMENT: "Lean Portfolio Management",
  ORGANIZATIONAL_AGILITY: "Organizational Agility",
  CONTINUOUS_LEARNING_CULTURE: "Continuous Learning Culture",
  LEAN_AGILE_LEADERSHIP: "Lean-Agile Leadership",
};

type Assessment = { competency: string; score: number; assessedAt: Date };

type Props = {
  assessments: Assessment[];
  height?: number;
};

export function CompetencyRadar({ assessments, height = 280 }: Props) {
  if (assessments.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground text-sm">
        Nenhum assessment registrado.
      </p>
    );
  }

  const keys = Object.keys(COMPETENCY_SHORT);
  const maturity = computeCompetencyMaturity(keys, assessments);

  const data = keys.map((key) => {
    const m = maturity[key];
    return {
      competency: COMPETENCY_SHORT[key],
      fullLabel: COMPETENCY_LABEL[key],
      avg: m.score,
      prevAvg: m.prevScore,
      fullMark: 5,
    };
  });

  return (
    <ResponsiveContainer height={height} width="100%">
      <RadarChart data={data} margin={{ top: 8, right: 32, bottom: 8, left: 32 }}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis
          dataKey="competency"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 5]}
          tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
          tickCount={6}
        />
        <Radar
          dataKey="prevAvg"
          fill="none"
          name="Ciclo anterior"
          stroke="hsl(var(--muted-foreground))"
          strokeDasharray="4 3"
          strokeWidth={1.5}
        />
        <Radar
          dataKey="avg"
          dot={{ r: 3, fill: "#5e6ad2" }}
          fill="#5e6ad2"
          fillOpacity={0.35}
          name="Ciclo atual"
          stroke="#5e6ad2"
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            fontSize: 12,
          }}
          formatter={(
            value: number,
            name: string,
            props: { payload?: { fullLabel: string } }
          ) => [`${value}/5`, `${props.payload?.fullLabel ?? ""} — ${name}`]}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
