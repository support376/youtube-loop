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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">성과</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1.5">
          업로드된 영상의 조회수·참여율·편집자별 지표를 분석합니다
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
