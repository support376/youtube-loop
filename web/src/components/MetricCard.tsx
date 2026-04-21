import { motion } from 'framer-motion'

interface Props {
  label: string
  value: string
  delta?: number
  prevValue?: number
  suffix?: string
  delay?: number
}

export default function MetricCard({ label, value, delta, prevValue, suffix = '', delay = 0 }: Props) {
  const isPositive = delta !== undefined && delta > 0
  const pct = prevValue && prevValue > 0 && delta !== undefined
    ? Math.round((delta / prevValue) * 100)
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5"
    >
      <p className="text-sm text-[var(--text-secondary)] mb-1">{label}</p>
      <p className="text-2xl font-bold tracking-tight">{value}{suffix}</p>
      {delta !== undefined && delta !== 0 && (
        <p className={`text-sm mt-1 ${isPositive ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
          {isPositive ? '▲' : '▼'} {Math.abs(delta).toLocaleString()}
          {pct !== null && ` (${pct > 0 ? '+' : ''}${pct}%)`}
        </p>
      )}
      {delta !== undefined && delta === 0 && (
        <p className="text-sm mt-1 text-[var(--text-secondary)]">— 전주 동일</p>
      )}
    </motion.div>
  )
}
