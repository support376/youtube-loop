import { motion } from 'framer-motion'
import { Search, Lightbulb, ShieldCheck, Target, Archive } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface AgentCard {
  id: string
  name: string
  icon: LucideIcon
  role: string
}

const AGENTS: AgentCard[] = [
  {
    id: 'research',
    name: '조사',
    icon: Search,
    role: '뉴스·커뮤니티를 훑고 이슈와 법률 포인트를 뽑아 기획 재료로 전달합니다.',
  },
  {
    id: 'planning',
    name: '기획',
    icon: Lightbulb,
    role: '가중치 기준으로 주제를 스코어링하고 기획안 카드로 정리합니다.',
  },
  {
    id: 'review',
    name: '검수',
    icon: ShieldCheck,
    role: '기획안의 법률 리스크·중복·경쟁 상황을 점검합니다.',
  },
  {
    id: 'lead',
    name: '리드',
    icon: Target,
    role: '영상·댓글에서 수임 가능성 있는 리드를 포착하고 분류합니다.',
  },
  {
    id: 'archive',
    name: '보관',
    icon: Archive,
    role: '성과·기획·리드를 장기 보존하고 주기적으로 요약합니다.',
  },
]

export default function Agents() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">에이전트</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          향후 자동화를 담당할 에이전트 구성. 아직 비활성 상태입니다.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {AGENTS.map((a, i) => {
          const Icon = a.icon
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 0.7, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center">
                    <Icon size={18} className="text-[var(--text-secondary)]" />
                  </div>
                  <h3 className="font-semibold">{a.name}</h3>
                </div>
                <span className="px-2.5 py-1 text-[10px] font-semibold rounded-full bg-[var(--bg-hover)] text-[var(--text-secondary)] uppercase tracking-wide">
                  준비 중
                </span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{a.role}</p>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
