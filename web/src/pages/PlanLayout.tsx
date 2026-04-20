import { NavLink, Outlet } from 'react-router-dom'
import { Newspaper, FileEdit, RefreshCw, Archive } from 'lucide-react'
import WeightSliders from '../components/WeightSliders'

const SUBTABS = [
  { to: '/plan/crawling', label: '크롤링', icon: Newspaper },
  { to: '/plan/draft', label: '기획안', icon: FileEdit },
  { to: '/plan/feedback', label: '피드백', icon: RefreshCw },
  { to: '/plan/history', label: '기획 히스토리', icon: Archive },
]

export default function PlanLayout() {
  return (
    <div className="space-y-6">
      {/* 가중치 슬라이더 (기획 섹션 공용) */}
      <WeightSliders />

      {/* 서브탭 */}
      <div className="flex gap-1 border-b border-[var(--border)] overflow-x-auto scrollbar-hide">
        {SUBTABS.map(t => {
          const Icon = t.icon
          return (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
                  isActive
                    ? 'text-[var(--accent)] border-[var(--accent)]'
                    : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
                }`
              }
            >
              <Icon size={15} />
              {t.label}
            </NavLink>
          )
        })}
      </div>

      <Outlet />
    </div>
  )
}
