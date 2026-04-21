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
        `relative flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? 'text-[var(--text-primary)] bg-[var(--bg-hover)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]/60'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-[var(--accent)]" />
          )}
          <Icon size={15} className={isActive ? 'text-[var(--accent)]' : ''} />
          <span>{tab.label}</span>
        </>
      )}
    </NavLink>
  )
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeMobile = () => setMobileOpen(false)

  return (
    <div className="min-h-screen lg:flex bg-[var(--bg-primary)]">
      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-primary)]/85 backdrop-blur-md">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-base font-bold tracking-tight">
            <span className="text-[var(--accent)]">YouTube</span> Loop
          </h1>
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="p-2 -mr-2 rounded-md hover:bg-[var(--bg-hover)] transition"
            aria-label="메뉴"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen lg:w-[220px] lg:flex-shrink-0 lg:flex-col lg:border-r lg:border-[var(--border)]">
        <div className="px-5 pt-7 pb-6">
          <h1 className="text-base font-bold tracking-tight leading-none">
            <span className="text-[var(--accent)]">YouTube</span> Loop
          </h1>
          <p className="text-[10px] text-[var(--text-secondary)] mt-2 uppercase tracking-[0.08em]">
            Circle21 · 양홍수 변호사
          </p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {TOP_TABS.map(tab => (
            <NavItem key={tab.to} tab={tab} />
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-[var(--border)]">
          <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-[0.08em]">
            YouTube Loop · v1
          </p>
        </div>
      </aside>

      {/* Mobile overlay menu */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-x-0 top-[53px] bottom-0 z-30 bg-[var(--bg-primary)] overflow-y-auto">
          <nav className="px-3 py-4 space-y-0.5">
            {TOP_TABS.map(tab => (
              <NavItem key={tab.to} tab={tab} onClick={closeMobile} />
            ))}
          </nav>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-5 py-7 lg:px-10 lg:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
