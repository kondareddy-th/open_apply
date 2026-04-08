import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Briefcase, Users, Mail, Settings,
  ChevronLeft, ChevronRight, Zap, Search,
  BookOpen, StickyNote, GraduationCap, FileText, Send,
} from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'

const pipelineItems = [
  { to: '/',              icon: LayoutDashboard, label: 'Dashboard',     shortcut: '1' },
  { to: '/jobs',          icon: Briefcase,       label: 'Jobs',          shortcut: '2' },
  { to: '/resume',        icon: FileText,        label: 'Resume',        shortcut: '3' },
  { to: '/applications',  icon: Send,            label: 'Applications',  shortcut: '4' },
  { to: '/contacts',      icon: Users,           label: 'Contacts',      shortcut: '5' },
  { to: '/emails',        icon: Mail,            label: 'Emails',        shortcut: '6' },
]

const prepItems = [
  { to: '/interview-prep', icon: BookOpen,      label: 'Interview Prep', shortcut: '7' },
  { to: '/notes',          icon: StickyNote,    label: 'Notes',          shortcut: '8' },
  { to: '/concepts',       icon: GraduationCap, label: 'Concepts',       shortcut: '9' },
]

function NavItem({ item, collapsed }: { item: typeof pipelineItems[0]; collapsed: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all duration-150 group relative',
          isActive
            ? 'bg-white/[0.06] text-text-primary'
            : 'text-text-tertiary hover:text-text-secondary hover:bg-white/[0.03]',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-accent rounded-r" />
          )}
          <item.icon
            className={clsx(
              'w-[16px] h-[16px] flex-shrink-0 transition-colors',
              isActive ? 'text-accent' : 'text-text-tertiary group-hover:text-text-secondary',
            )}
            strokeWidth={isActive ? 2 : 1.5}
          />
          {!collapsed && (
            <>
              <span className="flex-1 text-[13px] font-medium truncate">{item.label}</span>
              <span className="text-[10px] text-text-tertiary/50 font-mono">{item.shortcut}</span>
            </>
          )}
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-screen flex-col bg-surface-1 border-r border-[rgba(255,255,255,0.06)] z-50 transition-all duration-300 hidden md:flex',
        collapsed ? 'w-[60px]' : 'w-[220px]',
      )}
    >
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-[rgba(255,255,255,0.06)]">
        <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-accent" />
        </div>
        {!collapsed && (
          <span className="text-[15px] font-semibold tracking-tight text-text-primary">Nexus</span>
        )}
      </div>

      {!collapsed && (
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          className="mx-3 mt-3 mb-1 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-surface-2/50 border border-[rgba(255,255,255,0.04)] text-text-tertiary hover:text-text-secondary transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="flex-1 text-[12px] text-left">Search...</span>
          <kbd className="text-[10px] bg-surface-3 px-1 py-0.5 rounded">⌘K</kbd>
        </button>
      )}

      <nav className="flex-1 py-2 px-2 overflow-y-auto">
        {!collapsed && (
          <div className="px-2.5 pt-2 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary/50">Pipeline</span>
          </div>
        )}
        <div className="space-y-0.5">
          {pipelineItems.map((item) => (
            <NavItem key={item.to} item={item} collapsed={collapsed} />
          ))}
        </div>

        {!collapsed && (
          <div className="px-2.5 pt-4 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary/50">Prep</span>
          </div>
        )}
        {collapsed && <div className="my-2 mx-2 border-t border-[rgba(255,255,255,0.04)]" />}
        <div className="space-y-0.5">
          {prepItems.map((item) => (
            <NavItem key={item.to} item={item} collapsed={collapsed} />
          ))}
        </div>
      </nav>

      <div className="px-2 py-2 border-t border-[rgba(255,255,255,0.06)] space-y-0.5">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors relative',
              isActive
                ? 'bg-white/[0.06] text-text-primary'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-white/[0.03]',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-accent rounded-r" />
              )}
              <Settings className="w-[16px] h-[16px] flex-shrink-0" strokeWidth={isActive ? 2 : 1.5} />
              {!collapsed && (
                <>
                  <span className="flex-1 text-[13px] font-medium">Settings</span>
                  <span className="text-[10px] text-text-tertiary/50 font-mono">8</span>
                </>
              )}
            </>
          )}
        </NavLink>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-text-tertiary hover:text-text-secondary hover:bg-white/[0.03] transition-colors w-full"
        >
          {collapsed ? (
            <ChevronRight className="w-[16px] h-[16px]" />
          ) : (
            <>
              <ChevronLeft className="w-[16px] h-[16px]" />
              <span className="text-[12px]">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
