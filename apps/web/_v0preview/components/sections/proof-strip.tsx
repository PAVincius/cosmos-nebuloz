const items = [
  'STRATA', 'KORE', 'ANTRA', 'NORTHWAVE', 'OBSIDIAN',
  'AXIOM·9', 'LATERAL', 'KOSMOS', 'DELTA·SYNTH', 'PIVOT', 'KERN', 'METRIC LABS',
]

export function ProofStrip() {
  return (
    <section className="relative border-b border-hairline bg-transparent">
      <div className="max-w-[1280px] mx-auto px-6 py-8 flex flex-col md:flex-row md:items-center gap-6">
        <div className="shrink-0 md:w-48">
          <div className="label text-muted mb-1">DEPLOYED AT</div>
          <div className="text-[12px] text-body">12 design-led teams</div>
        </div>
        <div className="marquee-container flex-1">
          <div className="marquee-inner">
            {[...items, ...items].map((n, i) => (
              <span
                key={i}
                className="shrink-0 inline-flex items-center px-4 py-1.5 rounded-full border border-white/[0.09] bg-white/[0.02] text-[11px] mono text-body tracking-[0.12em]"
              >
                {n}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
