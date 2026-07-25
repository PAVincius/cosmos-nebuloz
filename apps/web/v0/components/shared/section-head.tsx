export function SectionHead({ eyebrow, dot = 'violet', a, b, desc }: {
  eyebrow: string
  dot?: string
  a: string
  b: string
  desc: string
}) {
  return (
    <div className="grid md:grid-cols-12 gap-8 mb-16">
      <div className="md:col-span-7">
        <div className="label text-muted mb-4 flex items-center gap-2">
          <span className={`dot dot-${dot}`} aria-hidden="true" />
          <span>{eyebrow}</span>
        </div>
        <h2 className="display display-tight text-[clamp(40px,5.2vw,76px)]">
          <span className="grad-text">{a}</span><br />
          <span className="accent-text">{b}</span>
        </h2>
      </div>
      <div className="md:col-span-5 self-end">
        <p className="text-[17px] leading-[1.55] text-body max-w-md">{desc}</p>
      </div>
    </div>
  )
}
