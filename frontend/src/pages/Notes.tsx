import { useEffect, useState, useCallback } from 'react'
import { StickyNote, Plus, Pin, Search, Trash2, Tag, Link2 } from 'lucide-react'
import clsx from 'clsx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { apiFetch } from '../api/client'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import { toast } from '../components/ui/Toast'

interface Note {
  id: string
  job_id: string | null
  title: string
  content: string
  tags: string[]
  pinned: boolean
  created_at: string
  updated_at: string
}

const SUGGESTED_TAGS = ['interview', 'company-research', 'technical', 'behavioral', 'offer-negotiation', 'general']

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [preview, setPreview] = useState(false)
  const [saveTimeout, setSaveTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)

  const fetchNotes = async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const data = await apiFetch<Note[]>(`/notes?${params}`)
      setNotes(data)
    } catch { /* */ }
    setLoading(false)
  }

  useEffect(() => { fetchNotes() }, [])
  useEffect(() => {
    const t = setTimeout(fetchNotes, 300)
    return () => clearTimeout(t)
  }, [search])

  const selected = notes.find((n) => n.id === selectedId)

  useEffect(() => {
    if (selected) {
      setEditTitle(selected.title)
      setEditContent(selected.content)
      setEditTags(selected.tags)
    }
  }, [selectedId])

  const autoSave = useCallback(
    (title: string, content: string, tags: string[]) => {
      if (!selectedId) return
      if (saveTimeout) clearTimeout(saveTimeout)
      const t = setTimeout(async () => {
        try {
          await apiFetch(`/notes/${selectedId}`, {
            method: 'PATCH',
            body: JSON.stringify({ title, content, tags }),
          })
          setNotes((prev) =>
            prev.map((n) =>
              n.id === selectedId ? { ...n, title, content, tags, updated_at: new Date().toISOString() } : n,
            ),
          )
        } catch { /* */ }
      }, 800)
      setSaveTimeout(t)
    },
    [selectedId, saveTimeout],
  )

  const handleCreate = async () => {
    try {
      const note = await apiFetch<Note>('/notes', {
        method: 'POST',
        body: JSON.stringify({ title: 'Untitled Note', content: '', tags: [] }),
      })
      setNotes((prev) => [note, ...prev])
      setSelectedId(note.id)
      setEditTitle(note.title)
      setEditContent('')
      setEditTags([])
    } catch (e: any) {
      toast(e.message || 'Failed to create note')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/notes/${id}`, { method: 'DELETE' })
      setNotes((prev) => prev.filter((n) => n.id !== id))
      if (selectedId === id) setSelectedId(null)
      toast('Note deleted')
    } catch { /* */ }
  }

  const handlePin = async (id: string, pinned: boolean) => {
    try {
      await apiFetch(`/notes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ pinned: !pinned }),
      })
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, pinned: !pinned } : n)))
    } catch { /* */ }
  }

  const toggleTag = (tag: string) => {
    const newTags = editTags.includes(tag) ? editTags.filter((t) => t !== tag) : [...editTags, tag]
    setEditTags(newTags)
    autoSave(editTitle, editContent, newTags)
  }

  const pinnedNotes = notes.filter((n) => n.pinned)
  const unpinnedNotes = notes.filter((n) => !n.pinned)

  return (
    <div className="flex h-[calc(100vh-0px)] md:h-screen animate-fade-in">
      {/* Sidebar */}
      <div className="w-72 flex-shrink-0 bg-surface-1 border-r border-[rgba(255,255,255,0.06)] flex flex-col">
        <div className="p-3 border-b border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-heading text-text-primary">Notes</h2>
            <Button variant="ghost" size="sm" icon={<Plus className="w-4 h-4" />} onClick={handleCreate}>
              New
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes..."
              className="w-full bg-surface-2 text-body text-text-primary rounded-md border border-[rgba(255,255,255,0.06)] pl-8 pr-3 py-1.5 placeholder:text-text-tertiary focus:outline-none focus:border-accent/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-3 space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16 rounded-md" />)}</div>
          ) : notes.length === 0 ? (
            <div className="p-4 text-center text-caption text-text-tertiary">No notes yet</div>
          ) : (
            <>
              {pinnedNotes.length > 0 && (
                <>
                  <div className="px-3 pt-3 pb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary/50">Pinned</span>
                  </div>
                  {pinnedNotes.map((note) => (
                    <NoteListItem
                      key={note.id}
                      note={note}
                      selected={selectedId === note.id}
                      onClick={() => setSelectedId(note.id)}
                    />
                  ))}
                </>
              )}
              {unpinnedNotes.length > 0 && (
                <>
                  {pinnedNotes.length > 0 && (
                    <div className="px-3 pt-3 pb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary/50">All Notes</span>
                    </div>
                  )}
                  {unpinnedNotes.map((note) => (
                    <NoteListItem
                      key={note.id}
                      note={note}
                      selected={selectedId === note.id}
                      onClick={() => setSelectedId(note.id)}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            <div className="flex items-center gap-2 px-6 py-3 border-b border-[rgba(255,255,255,0.06)]">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => { setEditTitle(e.target.value); autoSave(e.target.value, editContent, editTags) }}
                className="flex-1 bg-transparent text-title text-text-primary focus:outline-none placeholder:text-text-tertiary"
                placeholder="Note title..."
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreview(!preview)}
                className={preview ? 'text-accent' : ''}
              >
                {preview ? 'Edit' : 'Preview'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Pin className={clsx('w-3.5 h-3.5', selected.pinned && 'text-accent')} />}
                onClick={() => handlePin(selected.id, selected.pinned)}
              />
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 className="w-3.5 h-3.5 text-loss" />}
                onClick={() => handleDelete(selected.id)}
              />
            </div>

            {/* Tags */}
            <div className="flex items-center gap-1.5 px-6 py-2 border-b border-[rgba(255,255,255,0.04)] flex-wrap">
              <Tag className="w-3.5 h-3.5 text-text-tertiary" />
              {SUGGESTED_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={clsx(
                    'px-2 py-0.5 rounded-md text-caption transition-colors',
                    editTags.includes(tag)
                      ? 'bg-accent/10 text-accent'
                      : 'bg-surface-3 text-text-tertiary hover:text-text-secondary',
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {preview ? (
                <div className="prose prose-invert prose-sm max-w-none p-6">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{editContent}</ReactMarkdown>
                </div>
              ) : (
                <textarea
                  value={editContent}
                  onChange={(e) => { setEditContent(e.target.value); autoSave(editTitle, e.target.value, editTags) }}
                  className="w-full h-full bg-transparent text-body text-text-primary p-6 focus:outline-none resize-none font-mono"
                  placeholder="Start writing... (supports Markdown)"
                />
              )}
            </div>
          </>
        ) : (
          <EmptyState
            icon={<StickyNote className="w-10 h-10" />}
            title="Select or create a note"
            description="Choose a note from the sidebar or create a new one."
            action={{ label: 'New Note', onClick: handleCreate }}
            className="h-full"
          />
        )}
      </div>
    </div>
  )
}

function NoteListItem({ note, selected, onClick }: { note: Note; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left px-3 py-2.5 transition-colors border-l-2',
        selected
          ? 'bg-white/[0.04] border-accent'
          : 'border-transparent hover:bg-white/[0.02]',
      )}
    >
      <div className="flex items-center gap-1.5">
        {note.pinned && <Pin className="w-3 h-3 text-accent flex-shrink-0" />}
        <p className="text-body text-text-primary truncate">{note.title}</p>
      </div>
      <p className="text-caption text-text-tertiary truncate mt-0.5">
        {note.content.slice(0, 60) || 'Empty note'}
      </p>
      {note.tags.length > 0 && (
        <div className="flex gap-1 mt-1">
          {note.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-text-tertiary">{tag}</span>
          ))}
        </div>
      )}
    </button>
  )
}
