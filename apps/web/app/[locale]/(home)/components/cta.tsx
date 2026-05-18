"use client";

import { FadeIn } from "@/components/cosmos/fade-in";
import { Button } from "@repo/design-system/components/ui/button";
import type { Dictionary } from "@repo/internationalization";
import { motion } from "framer-motion";
import Link from "next/link";
import { env } from "@/env";

type CTAProps = {
  dictionary: Dictionary;
};

export const CTA = ({ dictionary: _ }: CTAProps) => (
  <section
    className="relative w-full overflow-hidden py-32"
    style={{ background: "var(--cosmos-slate)" }}
  >
    {/* Glow accent */}
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(0,212,255,0.1) 0%, transparent 70%)",
      }}
    />

    <div className="relative mx-auto max-w-3xl px-5 text-center md:px-20">
      <FadeIn>
        <p
          className="mb-4"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--vega)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Próximo passo
        </p>
        <h2
          style={{
            fontFamily: "var(--font-plex)",
            fontWeight: 600,
            fontSize: "clamp(2rem, 4vw, 3rem)",
            lineHeight: 1.2,
            color: "var(--cosmos-white)",
          }}
        >
          Traga seu próximo PI Planning para o Cosmos.
        </h2>
        <p
          className="mx-auto mt-5 max-w-xl"
          style={{
            fontFamily: "var(--font-plex)",
            fontSize: 18,
            color: "var(--cosmos-gray-60)",
            lineHeight: 1.6,
          }}
        >
          45 minutos com um RTE. Dataset real do seu PI.
          Saímos com um plano de implementação.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4">
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
            <Button
              asChild
              style={{
                background: "var(--vega)",
                color: "var(--cosmos-black)",
                fontFamily: "var(--font-plex)",
                fontWeight: 600,
                fontSize: 16,
                padding: "16px 40px",
                borderRadius: 6,
                border: "none",
                display: "inline-flex",
                gap: 8,
              }}
            >
              <Link href="/contact">Agendar demo técnica →</Link>
            </Button>
          </motion.div>

          <p
            style={{
              fontFamily: "var(--font-plex)",
              fontSize: 13,
              color: "var(--cosmos-gray-60)",
              fontStyle: "italic",
            }}
          >
            Sem pitch de vendas. Sem deck de 50 slides. Só SAFe.
          </p>
        </div>
      </FadeIn>

      {/* Bottom stats row */}
      <FadeIn delay={0.2}>
        <div
          className="mt-16 flex flex-wrap items-center justify-center gap-8"
          style={{ borderTop: "1px solid var(--cosmos-deep)", paddingTop: 32 }}
        >
          {[
            { value: "30 dias", label: "PoC garantido" },
            { value: "R$800K+", label: "economizados por PI" },
            { value: "100%", label: "dados no seu perímetro" },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  fontSize: 24,
                  color: "var(--vega)",
                }}
              >
                {item.value}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-plex)",
                  fontSize: 12,
                  color: "var(--cosmos-gray-60)",
                  marginTop: 4,
                }}
              >
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </FadeIn>
    </div>
  </section>
);
