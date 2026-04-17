import { motion } from 'framer-motion'

interface Props {
  items: { label: string; value: number; isTop3?: boolean }[]
  maxValue: number
}

export default function AnimatedBar({ items, maxValue }: Props) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-secondary)] w-[200px] truncate text-right shrink-0">
            {item.label}
          </span>
          <div className="flex-1 h-8 bg-[var(--bg-hover)] rounded-lg overflow-hidden relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(item.value / maxValue) * 100}%` }}
              transition={{ duration: 0.8, delay: i * 0.08, ease: 'easeOut' }}
              className={`h-full rounded-lg ${item.isTop3 ? 'bg-[var(--accent)]' : 'bg-[#555]'}`}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium">
              {item.value.toLocaleString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
