'use client'
import { useRef } from 'react'
import { useInView } from 'framer-motion'

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M11 2L3 5v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V5l-8-3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M7.5 11l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function LensIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="9.5" cy="9.5" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M14.5 14.5L19 19" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="12" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="3" y="12" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="12" y="12" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.3" opacity=".4" />
    </svg>
  )
}

const items = [
  {
    number: '01',
    title: 'Sovereign AI Factory',
    description: 'Deploy models inside your perimeter. BYOK encryption, per-workspace residency, and zero data retention. Every inference is scoped, attributed, and auditable.',
    tags: ['BYOK + VPC', 'Residency', 'Zero training'],
    icon: ShieldIcon,
  },
  {
    number: '02',
    title: 'Agentic Orchestration',
    description: 'Decompose intent into a supervised DAG of typed tool-calls. The planner diffs before commit, replays on demand, and routes across models by policy.',
    tags: ['Typed retrieval', 'Diff-first', 'Multi-model'],
    icon: LensIcon,
  },
  {
    number: '03',
    title: 'Governance Engine',
    description: 'Declarative rules for who, what, where, when. SOC 2 Type II, ISO 27001, LGPD, GDPR. Every signal logged, every action attributable.',
    tags: ['Policy as code', 'Compliance', 'Audit trail'],
    icon: GridIcon,
  },
]

function ConvictionRow({ item, index }: { item: typeof items[0]; index: number }) {
  const Icon = item.icon
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-8%' })

  return (
    <div
      ref={ref}
      className="group flex flex-col lg:flex-row gap-8 lg:gap-16 py-12 lg:py-16 border-b transition-all duration-700"
      style={{
        borderColor: 'var(--c-hairline)',
        opacity: inView ? 1 : 0,
        transform: inView ? 'none' : 'translateY(16px)',
        transitionDelay: `${index * 80}ms`,
      }}
    >
      {/* Number */}
      <div className="shrink-0 w-8">
        <span className="mono text-sm" style={{ color: 'var(--nz-muted)' }}>{item.number}</span>
      </div>

      {/* Title + icon */}
      <div className="shrink-0 lg:w-56">
        <div className="flex items-center gap-3 mb-1">
          <span style={{ color: 'var(--c-violet)', opacity: 0.7 }}>
            <Icon />
          </span>
          <h3
            className="text-2xl lg:text-3xl font-display tracking-tight grad-text transition-transform duration-500 group-hover:translate-x-1"
            style={{ letterSpacing: '-0.03em' }}
          >
            {item.title}
          </h3>
        </div>
      </div>

      {/* Description + tags */}
      <div className="flex-1 flex flex-col lg:flex-row gap-8 items-start">
        <p className="flex-1 text-base leading-relaxed" style={{ color: 'var(--nz-body)' }}>
          {item.description}
        </p>

        <div className="flex flex-col gap-2 shrink-0 lg:min-w-[160px]">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="mono text-[11px] px-2.5 py-1 rounded-md border w-fit"
              style={{
                color: 'var(--nz-muted)',
                borderColor: 'var(--c-hairline)',
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Convictions() {
  return (
    <section id="platform" className="relative py-24 lg:py-32">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">

        {/* Header — alinhado com FeaturesSection */}
        <div className="mb-12 lg:mb-16">
          <div className="label mb-4 flex items-center gap-2" style={{ color: 'var(--nz-muted)' }}>
            <span className="dot dot-violet" aria-hidden="true" />
            <span>SECTION · 01 / CAPABILITIES</span>
          </div>
          <h2
            className="display display-tight text-[clamp(40px,5.2vw,76px)]"
          >
            <span className="grad-text">Sovereign AI factory.</span>
            <br />
            <span className="accent-text">Governed orchestration.</span>
          </h2>
        </div>

        {/* Divider */}
        <div className="border-t" style={{ borderColor: 'var(--c-hairline)' }} />

        {/* Rows */}
        <div>
          {items.map((item, i) => (
            <ConvictionRow key={item.number} item={item} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
