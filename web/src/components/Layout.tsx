import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, Users, Film, Brain, RefreshCw, Newspaper } from 'lucide-react'

const leftTabs = [
  { to: '/', label: 'Overview', icon: BarChart3 },
  { to: '/editors', label: 'Editors', icon: Users },
  { to: '/videos', label: 'Videos', icon: Film },
  { to: '/insights', label: 'Insights', icon: Brain },
]

const rightTabs = [
  { to: '/crawling', label: 'Crawling', icon: Newspaper },
  { to: '/feedback', label: 'Feedback', icon: RefreshCw },
]

function TabLink({ to, label, icon: Icon }: { to: string; label: string; icon: typeof BarChart3 }) {
  return (
    <NavLink
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
  )
}

export default function Layout() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg-primary)]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-[var(--accent)]">YouTube</span> Loop
          </h1>
          <span className="text-xs text-[var(--text-secondary)]">Circle21 채널 분석</span>
        </div>

        <nav className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto scrollbar-hide items-center">
          {leftTabs.map(tab => <TabLink key={tab.to} {...tab} />)}

          {/* 구분선 */}
          <div className="h-5 w-px bg-[var(--border)] mx-2 shrink-0" />

          {rightTabs.map(tab => <TabLink key={tab.to} {...tab} />)}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
