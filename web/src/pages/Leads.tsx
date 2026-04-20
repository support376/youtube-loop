import { motion } from 'framer-motion'
import { Target } from 'lucide-react'

export default function Leads() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <h2 className="text-2xl font-bold">리드</h2>
      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-12 text-center">
        <Target size={40} className="text-[var(--text-secondary)] mx-auto mb-4" />
        <p className="font-semibold mb-2">리드 추적 준비 중입니다</p>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto">
          추적 장치 연결 후 활성화됩니다.
        </p>
      </div>
    </motion.div>
  )
}
