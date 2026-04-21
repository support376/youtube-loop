import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Lightbulb, BarChart3, Database, Target, Bot, Menu, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface NavTab {
  to: string
  label: string
  icon: LucideIcon
}

const TOP_TABS: NavTab[] = [
  { to: '/plan', label: '기획', icon: Lightbulb },
  { to: '/performance', label: '성과', icon: BarChart3 },
  { to: '/data', label: '데이터 관리', icon: Database },
  { to: '/leads', label: '리드', icon: Target },
  { to: '/agents', label: '에이전트', icon: Bot },
]

function NavItem({ tab, onClick }: { tab: NavTab; onClick?: () => void }) {
  const Icon = tab.icon
  return (
    <NavLink
      to={tab.to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-[var(--accent)] text-white'
            : 'text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)]'
        }`
      }
    >
      <Icon size={20} />
      <span>{tab.label}</span>
    </NavLink>
  )
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeMobile = () => setMobileOpen(false)

  return (
    <div className="min-h-screen lg:flex bg-[var(--bg-body)]">
      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-sidebar)]/90 backdrop-blur-md">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-base font-bold tracking-tight text-[var(--text-primary)]">
            YouTube Loop
          </h1>
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="p-2 -mr-2 rounded-md hover:bg-white/[0.04] transition"
            aria-label="메뉴"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen lg:w-[240px] lg:flex-shrink-0 lg:flex-col lg:bg-[var(--bg-sidebar)]">
        <div className="px-6 pt-6 pb-6">
          <h1 className="text-base font-bold tracking-tight leading-none text-[var(--text-primary)]">
            YouTube Loop
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-2 uppercase tracking-[0.08em]">
            Circle21 · 양홍수 변호사
          </p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {TOP_TABS.map(tab => (
            <NavItem key={tab.to} tab={tab} />
          ))}
        </nav>
        <div className="px-6 py-4">
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.08em]">
            YouTube Loop · v1
          </p>
        </div>
      </aside>

      {/* Mobile overlay menu */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-x-0 top-[53px] bottom-0 z-30 bg-[var(--bg-sidebar)] overflow-y-auto">
          <nav className="px-3 py-4 space-y-1">
            {TOP_TABS.map(tab => (
              <NavItem key={tab.to} tab={tab} onClick={closeMobile} />
            ))}
          </nav>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 bg-[var(--bg-content)]">
        <div className="max-w-6xl mx-auto px-5 py-6 lg:px-10 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
