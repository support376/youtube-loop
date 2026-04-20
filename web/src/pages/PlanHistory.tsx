import { motion } from 'framer-motion'
import { Archive } from 'lucide-react'

export default function PlanHistory() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-12 text-center"
    >
      <Archive size={40} className="text-[var(--text-secondary)] mx-auto mb-4" />
      <p className="font-semibold mb-2">기획 히스토리</p>
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto">
        승인된 기획안이 여기에 쌓입니다.
      </p>
    </motion.div>
  )
}
