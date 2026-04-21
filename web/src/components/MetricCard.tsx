import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { ArrowUp, ArrowDown } from 'lucide-react'

type IconTone = 'blue' | 'pink' | 'green' | 'purple' | 'amber'

const ICON_TONES: Record<IconTone, string> = {
  blue: 'bg-sky-500/15 text-sky-400',
  pink: 'bg-pink-500/15 text-pink-400',
  green: 'bg-[var(--green-soft)] text-[var(--green)]',
  purple: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  amber: 'bg-amber-500/15 text-amber-400',
}

interface Props {
  label: string
  value: string
  delta?: number
  prevValue?: number
  suffix?: string
  delay?: number
  icon?: LucideIcon
  iconTone?: IconTone
}

export default function MetricCard({
  label,
  value,
  delta,
  prevValue,
  suffix = '',
  delay = 0,
  icon: Icon,
  iconTone = 'purple',
}: Props) {
  const isPositive = delta !== undefined && delta > 0
  const hasDelta = delta !== undefined && delta !== 0
  const pct = prevValue && prevValue > 0 && delta !== undefined
    ? Math.round((delta / prevValue) * 100)
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.5, delay }}
      className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 hover:border-[var(--accent)]/40 hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
    >
      {Icon && (
        <div className={`flex items-center justify-center w-10 h-10 rounded-full mb-4 ${ICON_TONES[iconTone]}`}>
          <Icon size={18} />
        </div>
      )}
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>
      <p className="text-[40px] leading-[1.1] font-bold tracking-tight mt-1">
        {value}
        {suffix && <span className="text-lg font-normal text-[var(--text-secondary)] ml-1">{suffix}</span>}
      </p>
      {delta !== undefined && (
        <div className="flex items-center gap-2 mt-3">
          {hasDelta && (
            <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold text-white ${
              isPositive ? 'bg-[var(--green)]' : 'bg-[var(--red)]'
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
