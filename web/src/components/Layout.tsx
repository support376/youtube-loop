import { NavLink, Outlet } from 'react-router-dom'
import { Lightbulb, BarChart3, Database, Target, Bot } from 'lucide-react'

const TOP_TABS = [
  { to: '/plan', label: '기획', icon: Lightbulb },
  { to: '/performance', label: '성과', icon: BarChart3 },
  { to: '/data', label: '데이터 관리', icon: Database },
  { to: '/leads', label: '리드', icon: Target },
  { to: '/agents', label: '에이전트', icon: Bot },
]

export default function Layout() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-primary)]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-[var(--accent)]">YouTube</span> Loop
          </h1>
          <span className="text-xs text-[var(--text-secondary)]">Circle21 채널 분석</span>
        </div>

        <nav className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto scrollbar-hide items-center">
          {TOP_TABS.map(t => {
            const Icon = t.icon
            return (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                    isActive
                      ? 'text-[var(--accent)] border-b-2 border-[var(--accent)] bg-[var(--accent-soft)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                  }`
                }
              >
                <Icon size={16} />
                {t.label}
              </NavLink>
            )
          })}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
