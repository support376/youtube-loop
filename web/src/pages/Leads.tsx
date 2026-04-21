import { motion } from 'framer-motion'
import { Target } from 'lucide-react'

export default function Leads() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="mb-8">
        <h1 className="text-[28px] font-bold tracking-tight leading-tight">리드</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          수임 연결 가능 리드를 모읍니다
        </p>
      </div>

      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-card)] p-12 text-center">
        <Target size={48} className="text-[var(--text-muted)] mx-auto mb-4" />
        <p className="text-base text-[var(--text-secondary)]">
          리드 추적 준비 중입니다
        </p>
        <p className="text-sm text-[var(--text-muted)] mt-2">
          추적 장치 연결 후 활성화됩니다
        </p>
      </div>
    </motion.div>
  )
}
