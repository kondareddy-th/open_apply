import { useEffect, useState } from 'react'
import {
  Users, Linkedin, Mail, CheckCircle, XCircle, Edit2,
  Grid3x3, List, Filter, ExternalLink,
} from 'lucide-react'
import clsx from 'clsx'
import { apiFetch } from '../api/client'
import Badge from '../components/ui/Badge'
import { SearchInput } from '../components/ui/Input'
import EmptyState from '../components/ui/EmptyState'
import { toast } from '../components/ui/Toast'

interface Contact {
  id: string
  company_name: string | null
  job_title: string | null
  name: string
  title: string | null
  linkedin_url: string | null
  email: string | null
  email_verified: boolean
  source: string | null
  created_at: string
}

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [filterSource, setFilterSource] = useState<string>('')

  const fetchContacts = async () => {
    try {
      const data = await apiFetch<Contact[]>('/contacts?limit=200')
      setContacts(data)
    } catch { /* */ }
    setLoading(false)
  }

  useEffect(() => { fetchContacts() }, [])

  const handleVerify = async (contactId: string) => {
    try {
      const result = await apiFetch<{ verified: boolean }>(`/contacts/${contactId}/verify-email`, { method: 'POST' })
      setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, email_verified: result.verified } : c)))
      toast(result.verified ? 'Email verified' : 'Email could not be verified')
    } catch { /* */ }
  }

  const handleEmailUpdate = async (contactId: string) => {
    try {
      await apiFetch(`/contacts/${contactId}`, {
        method: 'PATCH',
        body: JSON.stringify({ email: editEmail }),
      })
      setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, email: editEmail, email_verified: false } : c)))
      setEditingId(null)
    } catch { /* */ }
  }

  const filtered = contacts.filter((c) => {
    if (search) {
      const q = search.toLowerCase()
      if (!c.name.toLowerCase().includes(q) && !(c.company_name || '').toLowerCase().includes(q) && !(c.title || '').toLowerCase().includes(q)) {
        return false
      }
    }
    if (filterSource && c.source !== filterSource) return false
    return true
  })

  const sources = [...new Set(contacts.map((c) => c.source).filter(Boolean))] as string[]

  const getInitials = (name: string) => {
    const parts = name.split(' ')
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)
  }

  const initialsColors = ['bg-accent/15 text-accent', 'bg-info/15 text-info', 'bg-warning/15 text-warning', 'bg-gain/15 text-gain', 'bg-[#a855f7]/15 text-[#a855f7]']
  const getColor = (name: string) => initialsColors[name.charCodeAt(0) % initialsColors.length]

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-display text-text-primary">Contacts</h1>
          <p className="text-body text-text-secondary mt-1">{filtered.length} contacts discovered</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('grid')}
            className={clsx('p-2 rounded-md transition-colors', view === 'grid' ? 'bg-surface-3 text-text-primary' : 'text-text-tertiary hover:text-text-secondary')}
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('list')}
            className={clsx('p-2 rounded-md transition-colors', view === 'list' ? 'bg-surface-3 text-text-primary' : 'text-text-tertiary hover:text-text-secondary')}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
        {sources.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-text-tertiary" />
            <button
              onClick={() => setFilterSource('')}
              className={clsx('px-2 py-1 rounded-md text-caption transition-colors', !filterSource ? 'bg-accent/10 text-accent' : 'text-text-tertiary hover:text-text-secondary')}
            >
              All
            </button>
            {sources.map((s) => (
              <button
                key={s}
                onClick={() => setFilterSource(filterSource === s ? '' : s)}
                className={clsx('px-2 py-1 rounded-md text-caption transition-colors', filterSource === s ? 'bg-accent/10 text-accent' : 'text-text-tertiary hover:text-text-secondary')}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-40 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="w-10 h-10" />}
          title="No contacts found"
          description={contacts.length === 0 ? 'Go to Jobs and click "Find Contacts" on a position.' : 'Try adjusting your search or filters.'}
        />
      ) : view === 'grid' ? (
        /* Card Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {filtered.map((contact) => (
            <div key={contact.id} className="bg-surface-2 rounded-lg p-4 border border-[rgba(255,255,255,0.06)] card-hover">
              <div className="flex items-start gap-3">
                <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center text-label flex-shrink-0', getColor(contact.name))}>
                  {getInitials(contact.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-body text-text-primary font-medium truncate">{contact.name}</span>
                    {contact.linkedin_url && (
                      <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[#5ba3d9] hover:text-[#5ba3d9]/80 flex-shrink-0">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  {contact.title && <p className="text-caption text-text-tertiary truncate">{contact.title}</p>}
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {contact.company_name && (
                  <p className="text-caption text-text-secondary">{contact.company_name}</p>
                )}
                {contact.job_title && (
                  <p className="text-caption text-text-tertiary">For: {contact.job_title}</p>
                )}

                {/* Email row */}
                <div className="flex items-center gap-1.5 pt-1">
                  {editingId === contact.id ? (
                    <div className="flex items-center gap-1 w-full">
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="flex-1 px-2 py-1 bg-surface-3 border border-accent/30 rounded text-caption text-text-primary focus:outline-none"
                        placeholder="email@company.com"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') handleEmailUpdate(contact.id); if (e.key === 'Escape') setEditingId(null) }}
                      />
                      <button onClick={() => handleEmailUpdate(contact.id)} className="text-gain hover:text-gain/80">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-loss hover:text-loss/80">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Mail className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
                      {contact.email ? (
                        <>
                          <span className="text-caption text-text-secondary truncate">{contact.email}</span>
                          {contact.email_verified ? (
                            <CheckCircle className="w-3.5 h-3.5 text-gain flex-shrink-0" />
                          ) : (
                            <button onClick={() => handleVerify(contact.id)} className="text-caption text-accent hover:underline flex-shrink-0">
                              verify
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-caption text-text-tertiary">No email</span>
                      )}
                      <button
                        onClick={() => { setEditingId(contact.id); setEditEmail(contact.email || '') }}
                        className="text-text-tertiary hover:text-text-secondary ml-auto flex-shrink-0"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {contact.source && (
                <div className="mt-3 pt-2 border-t border-[rgba(255,255,255,0.04)]">
                  <Badge variant={contact.source}>{contact.source.replace('_', ' ')}</Badge>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-surface-2 rounded-lg border border-[rgba(255,255,255,0.06)] divide-y divide-[rgba(255,255,255,0.04)]">
          {filtered.map((contact) => (
            <div key={contact.id} className="px-4 py-3 hover:bg-white/[0.02] transition-colors flex items-center gap-4">
              <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center text-caption flex-shrink-0', getColor(contact.name))}>
                {getInitials(contact.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-body text-text-primary font-medium">{contact.name}</span>
                  {contact.linkedin_url && (
                    <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[#5ba3d9] hover:text-[#5ba3d9]/80">
                      <Linkedin className="w-3 h-3" />
                    </a>
                  )}
                  {contact.source && <Badge variant={contact.source}>{contact.source.replace('_', ' ')}</Badge>}
                </div>
                <p className="text-caption text-text-tertiary">{[contact.title, contact.company_name].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {editingId === contact.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="px-2 py-1 bg-surface-3 border border-accent/30 rounded text-caption text-text-primary w-48 focus:outline-none"
                      placeholder="email@company.com"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleEmailUpdate(contact.id); if (e.key === 'Escape') setEditingId(null) }}
                    />
                    <button onClick={() => handleEmailUpdate(contact.id)} className="text-gain"><CheckCircle className="w-4 h-4" /></button>
                    <button onClick={() => setEditingId(null)} className="text-loss"><XCircle className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <>
                    {contact.email ? (
                      <span className="text-caption text-text-secondary">{contact.email}</span>
                    ) : (
                      <span className="text-caption text-text-tertiary">No email</span>
                    )}
                    {contact.email && !contact.email_verified && (
                      <button onClick={() => handleVerify(contact.id)} className="text-caption text-accent hover:underline">verify</button>
                    )}
                    {contact.email_verified && <CheckCircle className="w-3.5 h-3.5 text-gain" />}
                    <button onClick={() => { setEditingId(contact.id); setEditEmail(contact.email || '') }} className="text-text-tertiary hover:text-text-secondary">
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
