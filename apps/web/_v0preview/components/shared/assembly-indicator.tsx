'use client'
import { motion } from 'framer-motion'

export function AssemblyIndicator({ phase }: { phase: number }) {
  const labels = ['outer', 'grid', 'core', 'rings', 'dust']
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6, duration: 0.6 }}
      className="mt-8 flex items-center gap-2"
      aria-hidden="true"
    >
      <span className="text-[11px] mono text-muted uppercase tracking-wider mr-1">Build</span>
      {labels.map((l, i) => (
        <div key={l} className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full transition-all duration-500"
            style={{
              background: phase > i ? 'var(--c-violet)' : 'rgba(255,255,255,0.12)',
              boxShadow: phase > i ? '0 0 6px var(--c-violet)' : 'none',
            }}
          />
          {i < labels.length - 1 && (
            <div
              className="w-4 h-px transition-all duration-700"
              style={{ background: phase > i + 1 ? 'var(--c-violet)' : 'rgba(255,255,255,0.08)' }}
            />
          )}
        </div>
      ))}
      <span className="text-[11px] mono text-muted ml-1 capitalize">
        {phase > 0 ? labels[Math.min(phase - 1, 4)] : '—'}
      </span>
    </motion.div>
  )
}
