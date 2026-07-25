"use client";

import type { Dictionary } from "@repo/internationalization";
import { AnimatedCounter } from "@/components/cosmos/animated-counter";
import { ConicBorderCard } from "@/components/cosmos/conic-border";
import { FadeIn, FadeInChild, FadeInGroup } from "@/components/cosmos/fade-in";

type StatsProps = { dictionary: Dictionary };

const STATS = [
  {
    value: 80,
    prefix: "",
    suffix: "%",
    label: "dos PIs chegam atrasados no primeiro ano de SAFe",
    color: "var(--accent)",
  },
  {
    value: 800,
    prefix: "R$",
    suffix: "K+",
    label: "custo médio em horas de executivo por ciclo de PI",
    color: "var(--violet)",
  },
  {
    value: 30,
    prefix: "",
    suffix: "+",
    label: "dependências críticas descobertas na reunião, não antes",
    color: "var(--warning)",
  },
] as const;

export const Stats = ({ dictionary: _ }: StatsProps) => (
  <section className="w-full py-24" style={{ background: "var(--bg)" }}>
    <div className="mx-auto max-w-7xl px-5 md:px-20">
      <FadeIn className="mb-14 max-w-2xl">
        <p
          className="mb-3"
          style={{
            fontFamily: "monospace",
            fontSize: 11,
            color: "var(--accent)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          O Problema
        </p>
        <h2
          style={{
            fontWeight: 600,
            fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
            color: "var(--text)",
          }}
        >
          Seu PI Planning consome 3 semanas.{" "}
          <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
            E ninguém vê as dependências até ser tarde demais.
          </span>
        </h2>
      </FadeIn>

      <FadeInGroup className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STATS.map((stat) => (
          <FadeInChild key={stat.label}>
            <ConicBorderCard radius="var(--radius-xl)">
              <div
                className="flex h-full flex-col gap-3 rounded-[20px] p-8"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 1px 0 rgba(255,255,255,0.05) inset",
                }}
              >
                <AnimatedCounter
                  prefix={stat.prefix}
                  style={{
                    fontFamily: "monospace",
                    fontWeight: 700,
                    fontSize: "clamp(2.5rem, 4vw, 4rem)",
                    lineHeight: 1.1,
                    letterSpacing: "-0.02em",
                    color: stat.color,
                    display: "block",
                  }}
                  suffix={stat.suffix}
                  value={stat.value}
                />
                <p
                  style={{
                    fontSize: 14,
                    color: "var(--text-faint)",
                    lineHeight: 1.5,
                  }}
                >
                  {stat.label}
                </p>
              </div>
            </ConicBorderCard>
          </FadeInChild>
        ))}
      </FadeInGroup>
    </div>
  </section>
);
