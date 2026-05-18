"use client";

import { FadeIn } from "@/components/cosmos/fade-in";
import type { Dictionary } from "@repo/internationalization";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

type CasesProps = {
  dictionary: Dictionary;
};

const CHECK: ReactNode = <span style={{ color: "var(--aurora)", fontFamily: "var(--font-mono)" }}>✓</span>;
const CROSS: ReactNode = <span style={{ color: "var(--cosmos-mist)", fontFamily: "var(--font-mono)" }}>✗</span>;
const PARTIAL: ReactNode = <span style={{ color: "var(--helios)", fontFamily: "var(--font-mono)", fontSize: 11 }}>Parcial</span>;
const NA: ReactNode = <span style={{ color: "var(--cosmos-mist)", fontFamily: "var(--font-mono)", fontSize: 11 }}>N/A</span>;

const ROWS = [
  { label: "IA Nativa (não bolt-on)", cosmos: CHECK, jiraAlign: CROSS, planview: CROSS, sheets: CROSS },
  { label: "On-Premise / LGPD", cosmos: CHECK, jiraAlign: PARTIAL, planview: PARTIAL, sheets: NA },
  { label: "SAFe 6.0 Nativo", cosmos: CHECK, jiraAlign: PARTIAL, planview: CHECK, sheets: CROSS },
  {
    label: "Preço de entrada",
    cosmos: <span style={{ color: "var(--aurora)", fontFamily: "var(--font-mono)", fontSize: 12 }}>R$15K/ano</span>,
    jiraAlign: <span style={{ color: "var(--sirius)", fontFamily: "var(--font-mono)", fontSize: 12 }}>R$300K+/ano</span>,
    planview: <span style={{ color: "var(--sirius)", fontFamily: "var(--font-mono)", fontSize: 12 }}>R$200K+/ano</span>,
    sheets: <span style={{ color: "var(--cosmos-gray-60)", fontSize: 12 }}>"Grátis"</span>,
  },
  {
    label: "Time-to-Value",
    cosmos: <span style={{ color: "var(--aurora)", fontFamily: "var(--font-mono)", fontSize: 12 }}>30 dias</span>,
    jiraAlign: <span style={{ color: "var(--helios)", fontFamily: "var(--font-mono)", fontSize: 12 }}>6-18 meses</span>,
    planview: <span style={{ color: "var(--helios)", fontFamily: "var(--font-mono)", fontSize: 12 }}>12-24 meses</span>,
    sheets: <span style={{ color: "var(--sirius)", fontSize: 12 }}>Nunca escala</span>,
  },
  { label: "Suporte BR + LGPD", cosmos: CHECK, jiraAlign: CROSS, planview: CROSS, sheets: NA },
];

const cols = ["Cosmos", "Jira Align", "Planview", "Planilhas"] as const;

export const Cases = ({ dictionary: _ }: CasesProps) => (
  <section className="w-full py-24" style={{ background: "var(--cosmos-black)" }}>
    <div className="mx-auto max-w-7xl px-5 md:px-20">
      <FadeIn className="mb-12">
        <p
          className="mb-3"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--vega)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Comparação
        </p>
        <h2
          style={{
            fontFamily: "var(--font-plex)",
            fontWeight: 600,
            fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
            color: "var(--cosmos-white)",
          }}
        >
          Cosmos vs. as alternativas
        </h2>
      </FadeIn>

      <FadeIn delay={0.15}>
        <div className="w-full overflow-x-auto rounded-xl" style={{ border: "1px solid var(--cosmos-deep)" }}>
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr>
                <th
                  className="p-4 text-left"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--cosmos-gray-60)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    background: "var(--cosmos-slate)",
                    borderBottom: "1px solid var(--cosmos-deep)",
                  }}
                >
                  Feature
                </th>
                {cols.map((col, i) => (
                  <th
                    key={col}
                    className="p-4 text-center"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: i === 0 ? "var(--vega)" : "var(--cosmos-gray-60)",
                      background: i === 0 ? "rgba(0,212,255,0.08)" : "var(--cosmos-slate)",
                      borderBottom: i === 0 ? "none" : "1px solid var(--cosmos-deep)",
                      borderLeft: i === 0 ? "1px solid rgba(0,212,255,0.25)" : "1px solid var(--cosmos-deep)",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, ri) => (
                <motion.tr
                  key={row.label}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: ri * 0.06 }}
                >
                  <td
                    className="p-4"
                    style={{
                      fontFamily: "var(--font-plex)",
                      fontSize: 14,
                      color: "var(--cosmos-gray-40)",
                      background: ri % 2 === 0 ? "var(--cosmos-slate)" : "var(--cosmos-black)",
                      borderBottom: ri < ROWS.length - 1 ? "1px solid var(--cosmos-deep)" : "none",
                    }}
                  >
                    {row.label}
                  </td>
                  {[row.cosmos, row.jiraAlign, row.planview, row.sheets].map((cell, ci) => (
                    <td
                      key={ci}
                      className="p-4 text-center"
                      style={{
                        background:
                          ci === 0
                            ? "rgba(0,212,255,0.05)"
                            : ri % 2 === 0
                              ? "var(--cosmos-slate)"
                              : "var(--cosmos-black)",
                        borderLeft:
                          ci === 0
                            ? "1px solid rgba(0,212,255,0.2)"
                            : "1px solid var(--cosmos-deep)",
                        borderBottom: ri < ROWS.length - 1 ? "1px solid var(--cosmos-deep)" : "none",
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </FadeIn>
    </div>
  </section>
);
