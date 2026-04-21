import { NavLink, Outlet } from 'react-router-dom'
import { Newspaper, FileEdit, RefreshCw, Archive } from 'lucide-react'

const SUBTABS = [
  { to: '/plan/crawling', label: '크롤링', icon: Newspaper },
  { to: '/plan/draft', label: '기획안', icon: FileEdit },
  { to: '/plan/feedback', label: '피드백', icon: RefreshCw },
  { to: '/plan/history', label: '기획 히스토리', icon: Archive },
]

export default function PlanLayout() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[28px] font-bold tracking-tight leading-tight">기획</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          크롤링 데이터 기반 쇼츠 기획안을 생성하고 관리합니다
        </p>
      </div>

      <div className="flex items-center gap-6 border-b border-[var(--border)] mb-8 overflow-x-auto scrollbar-hide">
        {SUBTABS.map(t => {
          const Icon = t.icon
          return (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `flex items-center gap-2 pb-3 -mb-px text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'text-[var(--accent)] border-[var(--accent)]'
                    : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
                }`
              }
            >
              <Icon size={14} />
              {t.label}
            </NavLink>
          )
        })}
      </div>

      <Outlet />
    </div>
  )
}
