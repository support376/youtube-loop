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
    <div className="space-y-6">
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
