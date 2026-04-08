import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command } from 'cmdk'
import {
  LayoutDashboard, Briefcase, Users, Mail, Settings,
  BookOpen, StickyNote, GraduationCap, Search,
} from 'lucide-react'
import clsx from 'clsx'

const pages = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, group: 'Pipeline' },
  { name: 'Jobs', path: '/jobs', icon: Briefcase, group: 'Pipeline' },
  { name: 'Contacts', path: '/contacts', icon: Users, group: 'Pipeline' },
  { name: 'Emails', path: '/emails', icon: Mail, group: 'Pipeline' },
  { name: 'Interview Prep', path: '/interview-prep', icon: BookOpen, group: 'Prep' },
  { name: 'Notes', path: '/notes', icon: StickyNote, group: 'Prep' },
  { name: 'Concepts', path: '/concepts', icon: GraduationCap, group: 'Prep' },
  { name: 'Settings', path: '/settings', icon: Settings, group: 'System' },
]

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200]" onClick={() => setOpen(false)}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <Command
          className="bg-surface-2 rounded-xl border border-[rgba(255,255,255,0.08)] shadow-2xl overflow-hidden animate-fade-in"
          label="Command Palette"
        >
          <div className="flex items-center gap-2 px-4 border-b border-[rgba(255,255,255,0.06)]">
            <Search className="w-4 h-4 text-text-tertiary" />
            <Command.Input
              placeholder="Search pages..."
              className="flex-1 bg-transparent py-3 text-body text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
            <kbd className="text-[10px] text-text-tertiary bg-surface-3 px-1.5 py-0.5 rounded">ESC</kbd>
          </div>
          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-body text-text-tertiary">
              No results found.
            </Command.Empty>
            {['Pipeline', 'Prep', 'System'].map((group) => (
              <Command.Group key={group} heading={group} className="mb-1">
                <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-text-tertiary">{group}</div>
                {pages.filter((p) => p.group === group).map((page) => (
                  <Command.Item
                    key={page.path}
                    value={page.name}
                    onSelect={() => { navigate(page.path); setOpen(false) }}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors',
                      'text-text-secondary data-[selected=true]:bg-white/[0.06] data-[selected=true]:text-text-primary',
                    )}
                  >
                    <page.icon className="w-4 h-4" />
                    <span className="text-body">{page.name}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
