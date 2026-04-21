import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, Film, Users, Brain } from 'lucide-react'

const SUBTABS = [
  { to: '/performance/overview', label: 'Overview', icon: BarChart3 },
  { to: '/performance/videos', label: 'Videos', icon: Film },
  { to: '/performance/editors', label: 'Editors', icon: Users },
  { to: '/performance/insights', label: 'Insights', icon: Brain },
]

export default function PerformanceLayout() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[28px] font-bold tracking-tight leading-tight">성과</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          업로드된 영상의 조회수·참여율·편집자별 지표를 분석합니다
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
