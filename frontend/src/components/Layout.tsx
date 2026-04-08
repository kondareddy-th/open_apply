import { useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Briefcase, Users, Mail, BookOpen, FileText, Send } from 'lucide-react'
import clsx from 'clsx'
import Sidebar from './Sidebar'
import Toaster from './ui/Toast'
import CommandPalette from './ui/CommandPalette'

const mobileNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/jobs', icon: Briefcase, label: 'Jobs' },
  { to: '/resume', icon: FileText, label: 'Resume' },
  { to: '/applications', icon: Send, label: 'Apply' },
  { to: '/emails', icon: Mail, label: 'Emails' },
]

export default function Layout() {
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      const routes = ['/', '/jobs', '/resume', '/applications', '/contacts', '/emails', '/interview-prep', '/notes', '/concepts']
      const num = parseInt(e.key)
      if (num >= 1 && num <= routes.length) {
        e.preventDefault()
        navigate(routes[num - 1])
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [navigate])

  return (
    <div className="flex min-h-screen bg-base">
      <Sidebar />
      <main className="flex-1 md:ml-[220px] transition-all duration-300 pb-16 md:pb-0">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface-1/95 backdrop-blur-xl border-t border-[rgba(255,255,255,0.06)] md:hidden">
        <div className="flex items-center justify-around h-14 px-2">
          {mobileNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors',
                  isActive ? 'text-accent' : 'text-text-tertiary'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className="w-5 h-5" strokeWidth={isActive ? 2 : 1.5} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <Toaster />
      <CommandPalette />
    </div>
  )
}
