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

type Assessment = { competency: string; score: number };

type Props = {
  assessments: Assessment[];
  height?: number;
};

export function CompetencyRadar({ assessments, height = 280 }: Props) {
  const grouped: Record<string, number[]> = {};
  for (const a of assessments) {
    grouped[a.competency] ??= [];
    grouped[a.competency].push(a.score);
  }

  const data = Object.keys(COMPETENCY_SHORT).map((key) => {
    const scores = grouped[key] ?? [];
    const avg =
      scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
    return {
      competency: COMPETENCY_SHORT[key],
      fullLabel: COMPETENCY_LABEL[key],
      avg: Math.round(avg * 10) / 10,
      fullMark: 5,
    };
  });

  if (assessments.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground text-sm">
        Nenhum assessment registrado.
      </p>
    );
  }

  return (
    <ResponsiveContainer height={height} width="100%">
      <RadarChart
        data={data}
        margin={{ top: 8, right: 32, bottom: 8, left: 32 }}
      >
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
          dataKey="avg"
          dot={{ r: 3, fill: "#5e6ad2" }}
          fill="#5e6ad2"
          fillOpacity={0.35}
          name="Score médio"
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
            _: string,
            props: { payload?: { fullLabel: string } }
          ) => [`${value}/5`, props.payload?.fullLabel ?? ""]}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
