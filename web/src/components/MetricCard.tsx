import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { ArrowUp, ArrowDown } from 'lucide-react'

interface Props {
  label: string
  value: string
  delta?: number
  prevValue?: number
  suffix?: string
  delay?: number
  icon?: LucideIcon
}

export default function MetricCard({ label, value, delta, prevValue, suffix = '', delay = 0, icon: Icon }: Props) {
  const isPositive = delta !== undefined && delta > 0
  const hasDelta = delta !== undefined && delta !== 0
  const pct = prevValue && prevValue > 0 && delta !== undefined
    ? Math.round((delta / prevValue) * 100)
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 transition-colors hover:border-[var(--accent)]/40"
    >
      {Icon && (
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] mb-4">
          <Icon size={18} />
        </div>
      )}
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>
      <p className="text-3xl font-bold tracking-tight mt-1">
        {value}
        {suffix && <span className="text-base font-normal text-[var(--text-secondary)] ml-1">{suffix}</span>}
      </p>
      {delta !== undefined && (
        <div className="flex items-center gap-2 mt-3">
          {hasDelta && (
            <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-semibold ${
              isPositive
                ? 'bg-[var(--green-soft)] text-[var(--green)]'
                : 'bg-[var(--red-soft)] text-[var(--red)]'
            }`}>
              {isPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              {pct !== null ? `${Math.abs(pct)}%` : Math.abs(delta).toLocaleString()}
            </span>
          )}
          <span className="text-xs text-[var(--text-secondary)]">
            {hasDelta ? 'vs 지난 주' : '전주 동일'}
          </span>
        </div>
      )}
    </motion.div>
  )
}
