import { motion } from 'framer-motion'

interface Props {
  label: string
  value: string
  delta?: number
  suffix?: string
}

export default function MetricCard({ label, value, delta, suffix = '' }: Props) {
  const isPositive = delta !== undefined && delta > 0
  const isNegative = delta !== undefined && delta < 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5"
    >
      <p className="text-sm text-[var(--text-secondary)] mb-1">{label}</p>
      <p className="text-2xl font-bold tracking-tight">{value}{suffix}</p>
      {delta !== undefined && delta !== 0 && (
        <p className={`text-sm mt-1 ${isPositive ? 'text-[var(--green)]' : 'text-[var(--accent)]'}`}>
          {isPositive ? '▲' : '▼'} {Math.abs(delta).toLocaleString()} 전주 대비
        </p>
      )}
      {delta === 0 && (
        <p className="text-sm mt-1 text-[var(--text-secondary)]">— 전주 동일</p>
      )}
    </motion.div>
  )
}
