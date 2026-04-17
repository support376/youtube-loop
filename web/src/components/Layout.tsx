import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, Users, Film, Brain, RefreshCw, Newspaper } from 'lucide-react'

const tabs = [
  { to: '/', label: 'Overview', icon: BarChart3 },
  { to: '/crawling', label: 'Crawling', icon: Newspaper },
  { to: '/editors', label: 'Editors', icon: Users },
  { to: '/videos', label: 'Videos', icon: Film },
  { to: '/insights', label: 'Insights', icon: Brain },
  { to: '/feedback', label: 'Feedback', icon: RefreshCw },
]

export default function Layout() {
  return (
    <div className="min-h-screen">
      {/* 헤더 */}
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg-primary)]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-[var(--accent)]">YouTube</span> Loop
          </h1>
          <span className="text-xs text-[var(--text-secondary)]">Circle21 채널 분석</span>
        </div>

        {/* 탭 네비게이션 */}
        <nav className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'text-[var(--accent)] border-b-2 border-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* 콘텐츠 */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
