export function HeroShell() {
  return (
    <div className="ws-shell p-2.5 md:p-4">
      <div className="rounded-xl overflow-hidden bg-[#0a0d16] border border-white/5">
        {/* Window chrome */}
        <div className="h-9 flex items-center px-4 gap-3 border-b border-white/5 bg-white/[0.015]">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
          </div>
          <div className="flex items-center gap-2 ml-3 text-[10px] mono text-muted">
            <span>nebuloz</span>
            <span className="text-white/20">/</span>
            <span className="text-body">incident-radar</span>
          </div>
          <div className="ml-auto flex items-center gap-3 text-[10px] mono text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="dot dot-success" aria-hidden="true" /> healthy
            </span>
            <span>p95 · 184ms</span>
          </div>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-12 min-h-[280px] md:min-h-[340px]">
          {/* Sidebar */}
          <div className="hidden md:block col-span-2 border-r border-white/5 p-3">
            <div className="label text-muted px-2 mb-2 text-[9px]">MODULES</div>
            {['Incident Radar', 'Policy Engine', 'Connectors', 'Telemetry', 'Team'].map((l, i) => (
              <div
                key={l}
                className={`px-2 py-1.5 rounded-md text-[11px] mb-0.5 ${i === 0 ? 'bg-white/[0.05] text-ink' : 'text-muted'}`}
              >
                {l}
              </div>
            ))}
          </div>

          {/* Main panel */}
          <div className="col-span-12 md:col-span-7 p-4 md:p-5 border-r border-white/5">
            <div className="text-[10px] mono text-muted mb-1">RUN · #2048 · access-audit-q3</div>
            <div className="display text-[18px] md:text-[22px] mb-4 text-ink">
              8 grants flagged · 3 require rotation
            </div>
            <div className="ws-panel p-3 mb-3 font-mono text-[11px] leading-relaxed">
              <div className="text-muted mb-1">{'// policy.nz — residency enforcement'}</div>
              <div>
                <span className="text-violet">rule</span>{' '}
                <span className="text-ink">access_residency</span>{' {'}
              </div>
              <div className="pl-4">
                <span className="text-muted">when</span> grant.region{' '}
                <span className="text-cyan">{'∉'}</span> workspace.allowed_regions
              </div>
              <div className="pl-4">
                <span className="text-muted">then</span>{' '}
                <span className="text-danger">flag</span> + notify(workspace.owner)
              </div>
              <div>{'}'}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['FLAGGED', '8', 'text-warning'],
                ['ROTATE', '3', 'text-danger'],
                ['AUTO-REVOKED', '1', 'text-success'],
              ].map(([l, v, c]) => (
                <div key={l} className="ws-panel p-2.5">
                  <div className="text-[9px] mono text-muted mb-1">{l}</div>
                  <div className={`display text-[22px] ${c}`}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Telemetry panel */}
          <div className="hidden md:block col-span-3 p-4">
            <div className="label text-muted mb-2 text-[9px]">TELEMETRY</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px] mono mb-4">
              {[['tokens', '142,884'], ['latency', '184ms'], ['cost', '$0.42'], ['policy', 'strict']].map(([k, v]) => (
                <div key={k}>
                  <div className="text-muted">{k}</div>
                  <div className="text-ink">{v}</div>
                </div>
              ))}
            </div>
            <div className="label text-muted mb-2 text-[9px]">ACTIVITY</div>
            <div className="space-y-2">
              {[
                ['12s', 'Core', 'flagged 8 grants'],
                ['1m', 'Policy', 'enforced residency'],
                ['3m', 'Maria R.', 'approved rotation'],
                ['6m', 'Connector', 'synced okta'],
              ].map(([t, who, what], i) => (
                <div key={i} className="text-[10px] mono flex items-start gap-1.5">
                  <span className="text-faint w-5 shrink-0">{t}</span>
                  <span className="text-body">
                    <span className="text-ink">{who}</span> {what}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
