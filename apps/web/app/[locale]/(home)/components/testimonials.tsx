"use client";

import { FadeIn, FadeInChild, FadeInGroup } from "@/components/cosmos/fade-in";
import type { Dictionary } from "@repo/internationalization";
import { motion } from "framer-motion";

type TestimonialsProps = {
  dictionary: Dictionary;
};

const QUOTES = [
  {
    quote: "Antes do Cosmos, nosso PI Planning durava 3 semanas e ainda saiamos com 20+ dependências descobertas na última hora. Agora fazemos tudo em 2 dias com visibilidade completa.",
    author: "Head de Transformação Digital",
    company: "Fintech — 800 engenheiros",
    initials: "HT",
  },
  {
    quote: "A questão do on-premise foi decisiva. Nosso jurídico havia bloqueado qualquer ferramenta de IA que mandasse dados para fora. O Cosmos resolveu isso nativamente.",
    author: "VP de Engenharia",
    company: "Banco — 2.400 colaboradores",
    initials: "VP",
  },
] as const;

export const Testimonials = ({ dictionary: _ }: TestimonialsProps) => (
  <section className="w-full py-24" style={{ background: "var(--cosmos-slate)" }}>
    <div className="mx-auto max-w-7xl px-5 md:px-20">
      <FadeIn className="mb-14">
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
          Design Partners
        </p>
        <h2
          style={{
            fontFamily: "var(--font-plex)",
            fontWeight: 600,
            fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
            color: "var(--cosmos-white)",
          }}
        >
          Quem já está construindo com Cosmos
        </h2>
      </FadeIn>

      <FadeInGroup className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {QUOTES.map((q) => (
          <FadeInChild key={q.author}>
            <motion.div
              className="flex h-full flex-col gap-6 rounded-xl p-8"
              style={{
                background: "var(--cosmos-black)",
                border: "1px solid var(--cosmos-deep)",
                borderLeft: "3px solid var(--vega)",
              }}
              whileHover={{
                y: -3,
                boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                transition: { duration: 0.2 },
              }}
            >
              {/* Quote mark */}
              <span
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: 48,
                  lineHeight: 1,
                  color: "var(--vega)",
                  opacity: 0.4,
                  marginTop: -8,
                }}
              >
                "
              </span>

              <p
                style={{
                  fontFamily: "var(--font-plex)",
                  fontSize: 16,
                  lineHeight: 1.65,
                  color: "var(--cosmos-white)",
                  flex: 1,
                }}
              >
                {q.quote}
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-2" style={{ borderTop: "1px solid var(--cosmos-deep)" }}>
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: "var(--vega-dim)",
                    border: "1px solid rgba(0,212,255,0.25)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--vega)",
                  }}
                >
                  {q.initials}
                </div>
                <div>
                  <p style={{ fontFamily: "var(--font-plex)", fontSize: 14, fontWeight: 500, color: "var(--cosmos-white)" }}>
                    {q.author}
                  </p>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--cosmos-gray-60)" }}>
                    {q.company}
                  </p>
                </div>
              </div>
            </motion.div>
          </FadeInChild>
        ))}
      </FadeInGroup>
    </div>
  </section>
);
