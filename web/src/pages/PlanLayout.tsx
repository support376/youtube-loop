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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">기획</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1.5">
          크롤링 데이터 기반 쇼츠 기획안을 생성하고 관리합니다
        </p>
      </div>

      <div className="flex gap-1 items-center overflow-x-auto scrollbar-hide -mx-1 px-1">
        {SUBTABS.map(t => {
          const Icon = t.icon
          return (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`
              }
            >
              <Icon size={13} />
              {t.label}
            </NavLink>
          )
        })}
      </div>

      <Outlet />
    </div>
  )
}
