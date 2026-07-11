'use client'
import { useEffect } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

const PALETTE = ['#7c6cff', '#5b8cff', '#3cc3ff'] as const

function CursorGlow() {
  const x = useMotionValue(-600), y = useMotionValue(-600)
  const sx = useSpring(x, { stiffness: 65, damping: 18 })
  const sy = useSpring(y, { stiffness: 65, damping: 18 })
  useEffect(() => {
    const move = (e: MouseEvent) => { x.set(e.clientX - 300); y.set(e.clientY - 300) }
    window.addEventListener('mousemove', move, { passive: true })
    return () => window.removeEventListener('mousemove', move)
  }, [x, y])
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed z-[3] mix-blend-screen"
      style={{ x: sx, y: sy, top: 0, left: 0, width: 600, height: 600 }}
    >
      <div style={{
        width: '100%', height: '100%',
        background: `radial-gradient(circle, ${PALETTE[0]}2e 0%, ${PALETTE[1]}12 42%, transparent 68%)`,
      }} />
    </motion.div>
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Scroll progress bar
  useEffect(() => {
    const bar = document.getElementById('progress')
    if (!bar) return
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - innerHeight
      bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`
    }
    addEventListener('scroll', onScroll, { passive: true })
    return () => removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <CursorGlow />
      {children}
    </>
  )
}
