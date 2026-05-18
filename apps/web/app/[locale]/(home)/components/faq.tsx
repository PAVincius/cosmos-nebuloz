"use client";

import { FadeIn, FadeInChild, FadeInGroup } from "@/components/cosmos/fade-in";
import { Button } from "@repo/design-system/components/ui/button";
import type { Dictionary } from "@repo/internationalization";
import { motion } from "framer-motion";
import Link from "next/link";

type FAQProps = {
  dictionary: Dictionary;
};

const PLANS = [
  {
    name: "Starter",
    price: "R$15.000",
    period: "/ano",
    tag: null,
    tagColor: null,
    description: "Para equipes iniciando com SAFe",
    features: [
      "1 ART / Program",
      "25 usuários ativos",
      "PI Planning Orchestration",
      "Dependency mapping por IA",
      "SaaS cloud",
      "Suporte por email",
    ],
    cta: "Começar PoC de 30 dias",
    ctaHref: "/contact",
    highlight: false,
  },
  {
    name: "Growth",
    price: "R$40.000",
    period: "/ano",
    tag: "Mais popular",
    tagColor: "var(--vega)",
    description: "Para empresas escalando ARTs",
    features: [
      "2-3 ARTs",
      "100 usuários ativos",
      "Portfolio Management",
      "AI Insights básico",
      "Integrações Jira + Azure DevOps",
      "Suporte dedicado",
    ],
    cta: "Agendar demo",
    ctaHref: "/contact",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    period: "",
    tag: null,
    tagColor: null,
    description: "Para Solution Trains e grandes portfolios",
    features: [
      "4+ ARTs / Solution Train",
      "Usuários ilimitados",
      "On-Premise / VPC dedicada",
      "SLMs customizados + LGPD audit",
      "RTE-in-residence opcional",
      "SLA 99,9%",
    ],
    cta: "Falar com especialista",
    ctaHref: "/contact",
    highlight: false,
  },
] as const;

export const FAQ = ({ dictionary: _ }: FAQProps) => (
  <section className="w-full py-24" style={{ background: "var(--cosmos-black)" }}>
    <div className="mx-auto max-w-7xl px-5 md:px-20">
      <FadeIn className="mb-14 text-center">
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
          Preços
        </p>
        <h2
          style={{
            fontFamily: "var(--font-plex)",
            fontWeight: 600,
            fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
            color: "var(--cosmos-white)",
          }}
        >
          Preços que escalam com seu sucesso
        </h2>
        <p className="mx-auto mt-4 max-w-xl" style={{ fontFamily: "var(--font-plex)", fontSize: 16, color: "var(--cosmos-gray-60)" }}>
          Comece com 1 ART. Expanda para o portfolio inteiro.
        </p>
      </FadeIn>

      <FadeInGroup className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {PLANS.map((plan) => (
          <FadeInChild key={plan.name}>
            <motion.div
              className="relative flex h-full flex-col gap-6 rounded-xl p-8"
              style={{
                background: plan.highlight ? "var(--cosmos-slate)" : "var(--cosmos-black)",
                border: plan.highlight
                  ? "1px solid rgba(0,212,255,0.45)"
                  : "1px solid var(--cosmos-deep)",
                transform: plan.highlight ? "scale(1.02)" : "scale(1)",
              }}
              whileHover={{
                y: -4,
                transition: { duration: 0.2 },
              }}
            >
              {/* Popular badge */}
              {plan.tag && (
                <div
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-3 py-1"
                  style={{
                    background: "var(--vega)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--cosmos-black)",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {plan.tag}
                </div>
              )}

              {/* Header */}
              <div>
                <h3 style={{ fontFamily: "var(--font-plex)", fontWeight: 600, fontSize: 20, color: "var(--cosmos-white)" }}>
                  {plan.name}
                </h3>
                <p className="mt-1" style={{ fontFamily: "var(--font-plex)", fontSize: 13, color: "var(--cosmos-gray-60)" }}>
                  {plan.description}
                </p>
              </div>

              {/* Price */}
              <div>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 32, color: plan.highlight ? "var(--vega)" : "var(--cosmos-white)", lineHeight: 1 }}>
                  {plan.price}
                </span>
                {plan.period && (
                  <span style={{ fontFamily: "var(--font-plex)", fontSize: 14, color: "var(--cosmos-gray-60)", marginLeft: 4 }}>
                    {plan.period}
                  </span>
                )}
              </div>

              {/* Features */}
              <ul className="flex flex-1 flex-col gap-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span style={{ color: "var(--aurora)", fontFamily: "var(--font-mono)", fontSize: 14, flexShrink: 0 }}>✓</span>
                    <span style={{ fontFamily: "var(--font-plex)", fontSize: 14, color: "var(--cosmos-gray-40)", lineHeight: 1.4 }}>{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Button
                asChild
                className="mt-auto w-full"
                style={{
                  background: plan.highlight ? "var(--vega)" : "transparent",
                  color: plan.highlight ? "var(--cosmos-black)" : "var(--vega)",
                  border: plan.highlight ? "none" : "1px solid rgba(0,212,255,0.35)",
                  fontFamily: "var(--font-plex)",
                  fontWeight: 600,
                  fontSize: 14,
                  borderRadius: 6,
                  padding: "12px 20px",
                }}
              >
                <Link href={plan.ctaHref}>{plan.cta}</Link>
              </Button>
            </motion.div>
          </FadeInChild>
        ))}
      </FadeInGroup>
    </div>
  </section>
);
