import { useEffect, useState } from 'react'
import { Mail, Send, Check, Edit2, X, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { apiFetch } from '../api/client'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Tabs from '../components/ui/Tabs'
import EmptyState from '../components/ui/EmptyState'
import { toast } from '../components/ui/Toast'

interface Email {
  id: string
  contact_name: string | null
  contact_email: string | null
  job_title: string | null
  company_name: string | null
  subject: string
  body: string
  status: string
  sent_at: string | null
  replied_at: string | null
  created_at: string
}

const TAB_OPTIONS = [
  { id: 'draft', label: 'Drafts' },
  { id: 'approved', label: 'Approved' },
  { id: 'sent', label: 'Sent' },
  { id: 'replied', label: 'Replied' },
]

export default function Emails() {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('draft')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody] = useState('')

  const fetchEmails = async () => {
    try {
      const data = await apiFetch<Email[]>(`/emails?status=${activeTab}&limit=100`)
      setEmails(data)
      if (data.length > 0 && (!selectedId || !data.find((e) => e.id === selectedId))) {
        setSelectedId(data[0].id)
      }
      if (data.length === 0) setSelectedId(null)
    } catch { /* */ }
    setLoading(false)
  }

  useEffect(() => {
    setLoading(true)
    setEditing(false)
    fetchEmails()
  }, [activeTab])

  const selected = emails.find((e) => e.id === selectedId)

  const handleApprove = async (emailId: string) => {
    try {
      await apiFetch(`/emails/${emailId}/approve`, { method: 'POST' })
      toast('Email approved')
      setEmails((prev) => prev.filter((e) => e.id !== emailId))
      setSelectedId(null)
    } catch { /* */ }
  }

  const handleSend = async (emailId: string) => {
    try {
      await apiFetch(`/emails/${emailId}/send`, { method: 'POST' })
      toast('Email sent')
      setEmails((prev) => prev.filter((e) => e.id !== emailId))
      setSelectedId(null)
    } catch (e: any) {
      toast(e.message || 'Failed to send')
    }
  }

  const handleSave = async () => {
    if (!selectedId) return
    try {
      await apiFetch(`/emails/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({ subject: editSubject, body: editBody }),
      })
      setEmails((prev) => prev.map((e) => (e.id === selectedId ? { ...e, subject: editSubject, body: editBody } : e)))
      setEditing(false)
      toast('Changes saved')
    } catch { /* */ }
  }

  const handleDelete = async (emailId: string) => {
    try {
      await apiFetch(`/emails/${emailId}`, { method: 'DELETE' })
      setEmails((prev) => prev.filter((e) => e.id !== emailId))
      if (selectedId === emailId) setSelectedId(null)
      toast('Email deleted')
    } catch { /* */ }
  }

  const startEdit = () => {
    if (!selected) return
    setEditSubject(selected.subject)
    setEditBody(selected.body)
    setEditing(true)
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="flex h-[calc(100vh-0px)] md:h-screen animate-fade-in">
      {/* Left Panel: Email List */}
      <div className="w-80 flex-shrink-0 bg-surface-1 border-r border-[rgba(255,255,255,0.06)] flex flex-col">
        <div className="p-3 border-b border-[rgba(255,255,255,0.06)]">
          <h2 className="text-heading text-text-primary mb-3">Emails</h2>
          <Tabs tabs={TAB_OPTIONS} active={activeTab} onChange={setActiveTab} />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-3 space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-20 rounded-md" />)}</div>
          ) : emails.length === 0 ? (
            <div className="p-4 text-center text-caption text-text-tertiary">
              No {activeTab} emails
            </div>
          ) : (
            emails.map((email) => (
              <button
                key={email.id}
                onClick={() => { setSelectedId(email.id); setEditing(false) }}
                className={clsx(
                  'w-full text-left px-3 py-3 border-l-2 transition-colors',
                  selectedId === email.id
                    ? 'bg-white/[0.04] border-accent'
                    : 'border-transparent hover:bg-white/[0.02]',
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-body text-text-primary font-medium truncate">{email.contact_name || 'Unknown'}</span>
                  <span className="text-[10px] text-text-tertiary flex-shrink-0">{formatDate(email.created_at)}</span>
                </div>
                <p className="text-caption text-text-secondary truncate">{email.subject}</p>
                <p className="text-caption text-text-tertiary truncate mt-0.5">{email.company_name}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Panel: Email Detail */}
      <div className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-body text-text-primary font-medium">{selected.contact_name}</span>
                  {selected.contact_email && (
                    <span className="text-caption text-text-tertiary">&lt;{selected.contact_email}&gt;</span>
                  )}
                </div>
                <Badge variant={selected.status}>{selected.status}</Badge>
              </div>
              <p className="text-caption text-text-tertiary">
                {[selected.company_name, selected.job_title].filter(Boolean).join(' · ')}
              </p>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-label text-text-secondary mb-1">Subject</label>
                    <input
                      type="text"
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-1 border border-[rgba(255,255,255,0.06)] rounded-md text-body text-text-primary focus:outline-none focus:border-accent/50"
                    />
                  </div>
                  <div>
                    <label className="block text-label text-text-secondary mb-1">Body</label>
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={14}
                      className="w-full px-3 py-2 bg-surface-1 border border-[rgba(255,255,255,0.06)] rounded-md text-body text-text-primary focus:outline-none focus:border-accent/50 resize-y font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-surface-2 rounded-xl p-5 border border-[rgba(255,255,255,0.06)]">
                  <h3 className="text-heading text-text-primary mb-4">{selected.subject}</h3>
                  <p className="text-body text-text-secondary whitespace-pre-wrap leading-relaxed">{selected.body}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 py-3 border-t border-[rgba(255,255,255,0.06)] flex items-center gap-2">
              {editing ? (
                <>
                  <Button variant="primary" icon={<Check className="w-4 h-4" />} onClick={handleSave}>Save</Button>
                  <Button variant="ghost" icon={<X className="w-4 h-4" />} onClick={() => setEditing(false)}>Cancel</Button>
                </>
              ) : (
                <>
                  {selected.status === 'draft' && (
                    <>
                      <Button variant="ghost" icon={<Edit2 className="w-4 h-4" />} onClick={startEdit}>Edit</Button>
                      <Button variant="primary" icon={<Check className="w-4 h-4" />} onClick={() => handleApprove(selected.id)}>Approve</Button>
                    </>
                  )}
                  {selected.status === 'approved' && (
                    <Button variant="primary" icon={<Send className="w-4 h-4" />} onClick={() => handleSend(selected.id)}>Send</Button>
                  )}
                  {selected.sent_at && (
                    <span className="text-caption text-text-tertiary">
                      Sent {new Date(selected.sent_at).toLocaleDateString()}
                    </span>
                  )}
                  {selected.replied_at && (
                    <span className="text-caption text-gain">
                      Replied {new Date(selected.replied_at).toLocaleDateString()}
                    </span>
                  )}
                  <div className="ml-auto">
                    <Button variant="ghost" size="sm" icon={<Trash2 className="w-3.5 h-3.5 text-loss" />} onClick={() => handleDelete(selected.id)} />
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <EmptyState
            icon={<Mail className="w-10 h-10" />}
            title="Select an email"
            description={emails.length === 0 ? `No ${activeTab} emails. Draft emails from the Contacts page.` : 'Choose an email from the list to preview.'}
            className="h-full"
          />
        )}
      </div>
    </div>
  )
}
