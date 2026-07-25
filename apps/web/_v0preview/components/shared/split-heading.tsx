'use client'
import { motion } from 'framer-motion'

export function SplitHeading({
  text,
  delay = 0,
  accent = false,
}: {
  text: string
  delay?: number
  accent?: boolean
}) {
  const words = text.split(' ')
  return (
    <span className="block">
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom">
          <motion.span
            className={`inline-block ${accent ? 'accent-text' : 'grad-text'}`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: delay + i * 0.06 }}
          >
            {w}{i < words.length - 1 ? '\u00A0' : ''}
          </motion.span>
        </span>
      ))}
    </span>
  )
}
