import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { ArrowUp, ArrowDown } from 'lucide-react'

type IconTone = 'blue' | 'pink' | 'green' | 'purple' | 'amber'

const ICON_TONES: Record<IconTone, string> = {
  blue: 'bg-[rgba(59,130,246,0.2)] text-[#3B82F6]',
  pink: 'bg-[rgba(236,72,153,0.2)] text-[#EC4899]',
  green: 'bg-[rgba(34,197,94,0.2)] text-[#22C55E]',
  purple: 'bg-[rgba(139,92,246,0.2)] text-[#8B5CF6]',
  amber: 'bg-[rgba(251,191,36,0.2)] text-[#FBBF24]',
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
      className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-card)] p-6 transition-colors hover:border-[var(--border-card-hover)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)]"
    >
      {Icon && (
        <div className={`flex items-center justify-center w-11 h-11 rounded-full ${ICON_TONES[iconTone]}`}>
          <Icon size={20} />
        </div>
      )}
      <p className="text-[13px] text-[var(--text-secondary)] mt-4">{label}</p>
      <p className="text-[36px] leading-[1.1] font-bold tracking-tight mt-1 text-[var(--text-primary)]">
        {value}
        {suffix && <span className="text-lg font-normal text-[var(--text-secondary)] ml-1">{suffix}</span>}
      </p>
      {delta !== undefined && (
        <div className="flex items-center gap-2 mt-3">
          {hasDelta && (
            <span className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              isPositive
                ? 'bg-[var(--green-bg)] text-[var(--green)]'
                : 'bg-[var(--red-bg)] text-[var(--red)]'
            }`}>
              {isPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              {pct !== null ? `${Math.abs(pct)}%` : Math.abs(delta).toLocaleString()}
            </span>
          )}
          <span className="text-xs text-[var(--text-muted)]">
            {hasDelta ? '전주 대비' : '전주 동일'}
          </span>
        </div>
      )}
    </motion.div>
  )
}
