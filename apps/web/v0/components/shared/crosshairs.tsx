export function Crosshairs() {
  const corners = ['top-5 left-5', 'top-5 right-5', 'bottom-5 left-5', 'bottom-5 right-5']
  return (
    <div className="pointer-events-none">
      {corners.map((c, i) => (
        <div key={i} className={`absolute ${c} hidden lg:block opacity-50`}>
          <svg width="18" height="18" viewBox="0 0 22 22" className="text-white/25" aria-hidden="true">
            <path d="M0 11h22M11 0v22" stroke="currentColor" strokeWidth="0.7" />
          </svg>
        </div>
      ))}
      <div className="absolute right-5 top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-1 items-center text-white/25 text-[9px] mono">
        <span className="-rotate-90 origin-center tracking-[0.3em]">W · 122.3322</span>
      </div>
    </div>
  )
}
