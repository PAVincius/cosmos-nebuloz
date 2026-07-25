"use client";

import { useEffect, useRef, useState } from "react";

const features = [
  {
    number: "01",
    title: "Instant Deployment",
    description: "Push to production in seconds. Our edge network ensures your applications load instantly, anywhere in the world.",
    visual: "deploy",
  },
  {
    number: "02",
    title: "AI-Native Workflows",
    description: "Build intelligent applications with built-in AI capabilities. From inference to training, everything scales automatically.",
    visual: "ai",
  },
  {
    number: "03",
    title: "Real-time Collaboration",
    description: "Work together seamlessly. Live preview, instant feedback, and version control that actually makes sense.",
    visual: "collab",
  },
  {
    number: "04",
    title: "Enterprise Security",
    description: "Bank-grade encryption, SOC 2 compliance, and granular access controls. Your data stays yours.",
    visual: "security",
  },
];

/* Shared brand gradient defs — violet → cyan, palette-aware via CSS vars. */
function BrandDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-line`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="var(--c-violet)" />
        <stop offset="0.55" stopColor="var(--c-indigo)" />
        <stop offset="1" stopColor="var(--c-cyan)" />
      </linearGradient>
      <radialGradient id={`${id}-core`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#cfc8ff" />
        <stop offset="1" stopColor="var(--c-violet)" />
      </radialGradient>
    </defs>
  );
}

/* 01 — Instant Deployment: a core ships packets out to global edge nodes. */
function DeployVisual() {
  const nodes = [
    { x: 36, y: 54 },
    { x: 168, y: 44 },
    { x: 158, y: 120 },
    { x: 44, y: 116 },
  ];
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      <BrandDefs id="dep" />
      {/* edge orbit */}
      <ellipse
        cx="100" cy="84" rx="78" ry="44"
        fill="none" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1"
        transform="rotate(-10 100 84)"
      />
      {/* routes + traveling packets */}
      {nodes.map((n, i) => (
        <g key={i}>
          <line
            x1="100" y1="84" x2={n.x} y2={n.y}
            stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="2 4"
          />
          <circle cx={n.x} cy={n.y} r="5" fill="none" stroke={`url(#dep-line)`} strokeWidth="2">
            <animate attributeName="r" values="5;7;5" dur="2.2s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;1;0.5" dur="2.2s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
          </circle>
          <circle r="2.6" fill={`url(#dep-line)`}>
            <animateMotion
              dur="1.8s" begin={`${i * 0.45}s`} repeatCount="indefinite"
              path={`M100 84 L${n.x} ${n.y}`}
            />
            <animate attributeName="opacity" values="0;1;1;0" dur="1.8s" begin={`${i * 0.45}s`} repeatCount="indefinite" />
          </circle>
        </g>
      ))}
      {/* core */}
      <circle cx="100" cy="84" r="11" fill={`url(#dep-core)`}>
        <animate attributeName="r" values="10;12;10" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="100" cy="84" r="11" fill="none" stroke={`url(#dep-line)`} strokeWidth="1.5" opacity="0">
        <animate attributeName="r" values="11;34" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* 02 — AI-Native Workflows: neural core with orbiting satellites + sweep. */
function AIVisual() {
  const sats = [0, 1, 2, 3, 4, 5];
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      <BrandDefs id="ai" />
      {/* slow-rotating constellation */}
      <g transform="translate(100 80)">
        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="24s" repeatCount="indefinite" additive="sum" />
        {sats.map((i) => {
          const a = (i * 60) * (Math.PI / 180);
          const r = 52;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r * 0.62;
          return (
            <g key={i}>
              <line x1="0" y1="0" x2={x} y2={y} stroke="currentColor" strokeOpacity="0.16" strokeWidth="1">
                <animate attributeName="stroke-opacity" values="0.1;0.5;0.1" dur="2.4s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
              </line>
              <circle cx={x} cy={y} r="4.5" fill="none" stroke={`url(#ai-line)`} strokeWidth="2">
                <animate attributeName="r" values="4;6;4" dur="2.4s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
              </circle>
            </g>
          );
        })}
      </g>
      {/* core */}
      <circle cx="100" cy="80" r="13" fill={`url(#ai-core)`}>
        <animate attributeName="r" values="12;15;12" dur="2.2s" repeatCount="indefinite" />
      </circle>
      {/* expanding pulse */}
      <circle cx="100" cy="80" r="16" fill="none" stroke={`url(#ai-line)`} strokeWidth="1.5" opacity="0">
        <animate attributeName="r" values="16;58" dur="2.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.55;0" dur="2.6s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* 03 — Real-time Collaboration: two live cursors converge on a shared node. */
function CollabVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      <BrandDefs id="col" />
      {/* shared surface */}
      <rect x="46" y="40" width="108" height="80" rx="6" fill="none" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1.5" />
      {/* shared node */}
      <circle cx="100" cy="80" r="8" fill={`url(#col-core)`}>
        <animate attributeName="r" values="7;9;7" dur="1.6s" repeatCount="indefinite" />
      </circle>
      <circle cx="100" cy="80" r="8" fill="none" stroke={`url(#col-line)`} strokeWidth="1.4" opacity="0">
        <animate attributeName="r" values="8;26" dur="1.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0" dur="1.6s" repeatCount="indefinite" />
      </circle>
      {/* cursor A — violet, orbits in */}
      <g fill="var(--c-violet)">
        <path d="M0 0 L0 14 L4 10 L7 16 L9 15 L6 9 L11 9 Z">
          <animateMotion dur="4s" repeatCount="indefinite" path="M58 52 Q80 60 96 76 Q80 64 58 52" />
        </path>
      </g>
      {/* cursor B — cyan */}
      <g fill="var(--c-cyan)">
        <path d="M0 0 L0 14 L4 10 L7 16 L9 15 L6 9 L11 9 Z">
          <animateMotion dur="4s" begin="0.6s" repeatCount="indefinite" path="M142 108 Q116 96 104 84 Q120 96 142 108" />
        </path>
      </g>
    </svg>
  );
}

/* 04 — Enterprise Security: shield with gradient edge + scanning sweep + lock. */
function SecurityVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      <BrandDefs id="sec" />
      <clipPath id="sec-clip">
        <path d="M 100 22 L 150 42 L 150 90 Q 150 130 100 146 Q 50 130 50 90 L 50 42 Z" />
      </clipPath>
      {/* shield body */}
      <path
        d="M 100 22 L 150 42 L 150 90 Q 150 130 100 146 Q 50 130 50 90 L 50 42 Z"
        fill="currentColor" fillOpacity="0.04"
        stroke={`url(#sec-line)`} strokeWidth="2"
      />
      {/* scanning sweep */}
      <g clipPath="url(#sec-clip)">
        <rect x="46" y="20" width="108" height="14" fill={`url(#sec-line)`} opacity="0.35">
          <animate attributeName="y" values="20;128;20" dur="3.2s" repeatCount="indefinite" />
        </rect>
      </g>
      {/* lock */}
      <rect x="86" y="74" width="28" height="24" rx="3" fill={`url(#sec-line)`} />
      <path d="M 91 74 L 91 64 Q 91 54 100 54 Q 109 54 109 64 L 109 74"
        fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="100" cy="84" r="3.5" fill="#07080c" />
      <rect x="98.5" y="85" width="3" height="7" fill="#07080c" />
      {/* pulse */}
      <path
        d="M 100 22 L 150 42 L 150 90 Q 150 130 100 146 Q 50 130 50 90 L 50 42 Z"
        fill="none" stroke={`url(#sec-line)`} strokeWidth="1.5" opacity="0"
      >
        <animate attributeName="opacity" values="0;0.5;0" dur="2.6s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

function AnimatedVisual({ type }: { type: string }) {
  switch (type) {
    case "deploy":
      return <DeployVisual />;
    case "ai":
      return <AIVisual />;
    case "collab":
      return <CollabVisual />;
    case "security":
      return <SecurityVisual />;
    default:
      return <DeployVisual />;
  }
}

function FeatureCard({ feature, index }: { feature: typeof features[0]; index: number }) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.2 }
    );

    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      className={`group grad-shell h-full transition-all duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isVisible
          ? "opacity-100 translate-y-0 blur-0 scale-100"
          : "opacity-0 translate-y-8 blur-[6px] scale-[0.97]"
      }`}
      style={{ transitionDelay: `${index * 120}ms` }}
    >
      <div className="grad-shell-inner relative overflow-hidden p-7 h-full flex flex-col">
        {/* Top accent line — brightens on hover (matches platform cards) */}
        <div
          className="pointer-events-none absolute top-0 right-0 left-0 h-px opacity-[0.18] transition-opacity duration-300 group-hover:opacity-80"
          style={{ background: "linear-gradient(90deg, transparent, var(--c-violet), var(--c-cyan), transparent)" }}
        />
        {/* Radial glow on hover */}
        <div
          className="-top-16 -right-16 pointer-events-none absolute h-48 w-48 rounded-full opacity-0 transition-opacity duration-700 group-hover:opacity-100"
          style={{ background: "radial-gradient(circle, var(--c-violet), transparent 65%)" }}
        />

        {/* Visual — contained, brand-tinted */}
        <div className="mb-6 h-24 w-full text-ink">
          <AnimatedVisual type={feature.visual} />
        </div>

        <div className="label text-muted mb-2">{feature.number}</div>
        <h3 className="display grad-text mb-2 text-[22px]">{feature.title}</h3>
        <p className="text-[14px] text-body leading-[1.55]">{feature.description}</p>
      </div>
    </div>
  );
}

export function FeaturesSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="features"
      ref={sectionRef}
      className="relative py-24 lg:py-32"
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="mb-16 lg:mb-24">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
            <span className="w-8 h-px bg-foreground/30" />
            Capabilities
          </span>
          <h2
            className={`text-4xl lg:text-6xl font-display tracking-tight transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            Everything you need.
            <br />
            <span className="text-muted-foreground">Nothing you don&apos;t.</span>
          </h2>
        </div>

        {/* Features grid — matches platform card pattern */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <FeatureCard key={feature.number} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
