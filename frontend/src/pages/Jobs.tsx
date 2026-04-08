import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Briefcase, Search, ExternalLink, Users, RefreshCw, ArrowUpDown,
  CheckSquare, Square, Loader2, X, Plus, ChevronLeft, ChevronRight,
  Trash2, Columns3, List, Sparkles, Send, Bookmark, StickyNote, Save, Target,
} from 'lucide-react'
import clsx from 'clsx'
import { apiFetch } from '../api/client'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { SearchInput } from '../components/ui/Input'
import EmptyState from '../components/ui/EmptyState'
import { toast } from '../components/ui/Toast'

interface Job {
  id: string
  company_name: string | null
  title: string
  department: string | null
  location: string | null
  source: string
  url: string | null
  match_score: number | null
  status: string
  user_notes: string | null
  bookmarked: boolean
  posted_at: string | null
  scraped_at: string
  contact_count: number
}

const KANBAN_COLUMNS = ['new', 'saved', 'contacts_found', 'emailed']
const ALL_STATUSES = ['new', 'saved', 'contacts_found', 'emailed', 'expired']
const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  saved: 'Saved',
  contacts_found: 'Contacts Found',
  emailed: 'Emailed',
  expired: 'Expired',
}
const KANBAN_COLORS: Record<string, string> = {
  new: 'border-info/30',
  saved: 'border-accent/30',
  contacts_found: 'border-warning/30',
  emailed: 'border-gain/30',
}

const SOURCE_LABELS: Record<string, string> = {
  greenhouse: 'GH',
  lever: 'Lever',
  ashby: 'Ashby',
  workable: 'Wkbl',
  smartrecruiters: 'SR',
  jobvite: 'JV',
  custom: 'Custom',
}

const SOURCE_OPTIONS = [
  { id: 'greenhouse', label: 'Greenhouse' },
  { id: 'lever', label: 'Lever' },
  { id: 'ashby', label: 'Ashby' },
  { id: 'workable', label: 'Workable' },
  { id: 'smartrecruiters', label: 'SmartRecruiters' },
  { id: 'jobvite', label: 'Jobvite' },
  { id: 'custom', label: 'Custom' },
]

function timeAgo(dateStr: string | null): { text: string; color: string } | null {
  if (!dateStr) return null
  const posted = new Date(dateStr)
  const now = new Date()
  const hours = Math.floor((now.getTime() - posted.getTime()) / (1000 * 60 * 60))
  if (hours < 24) return { text: `${hours}h ago`, color: 'text-gain' }
  const days = Math.floor(hours / 24)
  if (days <= 7) return { text: `${days}d ago`, color: 'text-accent' }
  if (days <= 30) return { text: `${Math.floor(days / 7)}w ago`, color: 'text-warning' }
  return { text: `${Math.floor(days / 30)}mo ago`, color: 'text-loss' }
}

export default function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'kanban' | 'table'>('kanban')
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [minScoreFilter, setMinScoreFilter] = useState(0)
  const [scraping, setScraping] = useState(false)
  const [discovering, setDiscovering] = useState<string | null>(null)
  const [preparing, setPreparing] = useState<string | null>(null)
  const [bulkPreparing, setBulkPreparing] = useState(false)
  const navigate = useNavigate()
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set(['greenhouse', 'lever', 'ashby', 'workable']))
  const [showScrapeModal, setShowScrapeModal] = useState(false)
  const [scoring, setScoring] = useState(false)

  // Keyword search across boards
  const [searchKeywords, setSearchKeywords] = useState('')
  const [searchingBoards, setSearchingBoards] = useState(false)
  const [searchResults, setSearchResults] = useState<Array<{ title: string; company: string; url: string; source: string; snippet: string }>>([])
  const [showSearchResults, setShowSearchResults] = useState(false)

  // Sort
  const [sortBy, setSortBy] = useState<'scraped_at' | 'posted_at' | 'match_score'>('scraped_at')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  // Multi-select
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set())
  const [bulkDiscovering, setBulkDiscovering] = useState(false)

  // Pagination
  const PAGE_SIZE = 50
  const [currentPage, setCurrentPage] = useState(0)

  // Detail drawer
  const [detailJob, setDetailJob] = useState<Job | null>(null)
  const [editingNotes, setEditingNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [jobDescription, setJobDescription] = useState('')
  const [loadingJD, setLoadingJD] = useState(false)

  const fetchJobs = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (sourceFilter) params.set('source', sourceFilter)
      params.set('sort_by', sortBy)
      params.set('sort_dir', sortDir)
      params.set('limit', '500')
      const data = await apiFetch<Job[]>(`/jobs?${params}`)
      setJobs(data)
    } catch { /* */ }
    setLoading(false)
  }

  useEffect(() => { fetchJobs() }, [statusFilter, sourceFilter, sortBy, sortDir])
  useEffect(() => { setCurrentPage(0) }, [statusFilter, sourceFilter, searchQuery])

  const handleScrape = async () => {
    setScraping(true)
    try {
      const params = new URLSearchParams()
      if (selectedSources.size > 0 && selectedSources.size < SOURCE_OPTIONS.length) {
        params.set('sources', [...selectedSources].join(','))
      }
      const results = await apiFetch<Array<{ company: string; source: string; jobs_found: number; new_jobs: number }>>(`/jobs/scrape?${params}`, { method: 'POST' })
      const totalNew = results.reduce((sum, r) => sum + r.new_jobs, 0)
      const totalFound = results.reduce((sum, r) => sum + r.jobs_found, 0)
      toast(`Scrape complete: ${totalNew} new jobs out of ${totalFound} found across ${results.length} sources`)
      await fetchJobs()
    } catch { /* */ }
    setScraping(false)
    setShowScrapeModal(false)
  }

  const handleStatusChange = async (jobId: string, status: string) => {
    try {
      await apiFetch(`/jobs/${jobId}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status } : j)))
    } catch { /* */ }
  }

  const handleDiscover = async (jobId: string) => {
    setDiscovering(jobId)
    try {
      await apiFetch(`/contacts/discover/${jobId}`, { method: 'POST' })
      toast('Contacts found')
      await fetchJobs()
    } catch { /* */ }
    setDiscovering(null)
  }

  const handleDeleteSingle = async (jobId: string) => {
    try {
      await apiFetch(`/jobs/${jobId}`, { method: 'DELETE' })
      setJobs((prev) => prev.filter((j) => j.id !== jobId))
      toast('Job deleted')
    } catch { /* */ }
  }

  const handleBulkDiscover = async () => {
    if (selectedJobs.size === 0) return
    setBulkDiscovering(true)
    try {
      const result = await apiFetch<{ total_contacts_found: number }>('/contacts/discover-bulk', {
        method: 'POST',
        body: JSON.stringify({ job_ids: [...selectedJobs] }),
      })
      toast(`Found ${result.total_contacts_found} contacts`)
      await fetchJobs()
    } catch { /* */ }
    setBulkDiscovering(false)
  }

  const handleBulkDelete = async () => {
    if (selectedJobs.size === 0) return
    try {
      await apiFetch('/jobs/delete-bulk', { method: 'POST', body: JSON.stringify({ job_ids: [...selectedJobs] }) })
      setSelectedJobs(new Set())
      toast('Jobs deleted')
      await fetchJobs()
    } catch { /* */ }
  }

  const handleKeywordSearch = async () => {
    if (!searchKeywords.trim()) return
    setSearchingBoards(true)
    setShowSearchResults(true)
    try {
      const result = await apiFetch<{ results: typeof searchResults }>('/jobs/search', {
        method: 'POST',
        body: JSON.stringify({ keywords: searchKeywords }),
      })
      setSearchResults(result.results || [])
      if (!result.results?.length) toast('No results found')
    } catch (e: any) {
      toast(e?.message || 'Search failed')
    }
    setSearchingBoards(false)
  }

  const handleScoreAll = async () => {
    setScoring(true)
    try {
      const result = await apiFetch<{ scored: number; message?: string }>('/jobs/match', { method: 'POST' })
      if (result.scored > 0) {
        toast(`Scored ${result.scored} jobs`)
        await fetchJobs()
      } else {
        toast(result.message || 'No unscored jobs')
      }
    } catch (e: any) {
      toast(e?.message || 'Scoring failed')
    }
    setScoring(false)
  }

  const handleSaveNotes = async (jobId: string, notes: string) => {
    setSavingNotes(true)
    try {
      await apiFetch(`/jobs/${jobId}`, { method: 'PATCH', body: JSON.stringify({ user_notes: notes }) })
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, user_notes: notes } : j))
      if (detailJob?.id === jobId) setDetailJob(prev => prev ? { ...prev, user_notes: notes } : prev)
      toast('Notes saved')
    } catch { /* */ }
    setSavingNotes(false)
  }

  const handleToggleBookmark = async (jobId: string, current: boolean) => {
    try {
      await apiFetch(`/jobs/${jobId}`, { method: 'PATCH', body: JSON.stringify({ bookmarked: !current }) })
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, bookmarked: !current } : j))
      if (detailJob?.id === jobId) setDetailJob(prev => prev ? { ...prev, bookmarked: !current } : prev)
    } catch { /* */ }
  }

  const handleQuickPrepare = async (jobId: string) => {
    setPreparing(jobId)
    try {
      await apiFetch('/applications/prepare', {
        method: 'POST',
        body: JSON.stringify({ job_id: jobId }),
      })
      toast('Application prepared! Redirecting...')
      navigate('/applications')
    } catch (e: any) {
      toast(e?.message?.includes('master resume') ? 'Upload a master resume first (Resume page)' : 'Preparation failed')
    }
    setPreparing(null)
  }

  const handleBulkPrepare = async () => {
    if (selectedJobs.size === 0) return
    setBulkPreparing(true)
    let prepped = 0
    for (const jobId of selectedJobs) {
      try {
        await apiFetch('/applications/prepare', {
          method: 'POST',
          body: JSON.stringify({ job_id: jobId }),
        })
        prepped++
      } catch { /* skip failures */ }
    }
    setBulkPreparing(false)
    toast(`Prepared ${prepped} application${prepped !== 1 ? 's' : ''}`)
    if (prepped > 0) navigate('/applications')
  }

  const filtered = jobs.filter((j) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!j.title.toLowerCase().includes(q) && !(j.company_name || '').toLowerCase().includes(q)) return false
    }
    if (minScoreFilter > 0 && (j.match_score === null || j.match_score < minScoreFilter)) return false
    return true
  })

  // Client-side sort by match_score when selected
  if (sortBy === 'match_score') {
    filtered.sort((a, b) => {
      const aScore = a.match_score ?? -1
      const bScore = b.match_score ?? -1
      return sortDir === 'desc' ? bScore - aScore : aScore - bScore
    })
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginatedJobs = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  // Kanban grouping
  const kanbanData = KANBAN_COLUMNS.map((status) => ({
    status,
    jobs: filtered.filter((j) => j.status === status),
  }))

  // Source stats for the header
  const sourceCounts = jobs.reduce<Record<string, number>>((acc, j) => {
    acc[j.source] = (acc[j.source] || 0) + 1
    return acc
  }, {})

  return (
    <div className="p-6 max-w-[1400px] mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-display text-text-primary">Jobs</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-body text-text-secondary">{jobs.length} positions</p>
            <div className="flex gap-1.5">
              {Object.entries(sourceCounts).map(([src, count]) => (
                <span key={src} className="text-[10px] text-text-tertiary bg-surface-3 px-1.5 py-0.5 rounded">
                  {SOURCE_LABELS[src] || src}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-surface-2 rounded-lg p-0.5 mr-2">
            <button
              onClick={() => setView('kanban')}
              className={clsx('p-2 rounded-md transition-colors', view === 'kanban' ? 'bg-surface-4 text-text-primary' : 'text-text-tertiary')}
            >
              <Columns3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('table')}
              className={clsx('p-2 rounded-md transition-colors', view === 'table' ? 'bg-surface-4 text-text-primary' : 'text-text-tertiary')}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <Button variant="ghost" icon={scoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />} loading={scoring} onClick={handleScoreAll}>
            Score All
          </Button>
          <Button variant="accent" icon={<RefreshCw className={clsx('w-4 h-4', scraping && 'animate-spin')} />} loading={scraping} onClick={() => setShowScrapeModal(true)}>
            Scrape
          </Button>
        </div>
      </div>

      {/* Keyword Search */}
      <div className="bg-surface-2 rounded-lg p-4 border border-[rgba(255,255,255,0.06)] mb-4">
        <p className="text-label text-text-primary mb-2">Search Job Boards</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchKeywords}
            onChange={e => setSearchKeywords(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleKeywordSearch()}
            placeholder="Search keywords (e.g., AI Engineer, Product Manager, Remote)"
            className="flex-1 min-w-0 px-3 py-2 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50"
          />
          <Button variant="accent" icon={searchingBoards ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} loading={searchingBoards} onClick={handleKeywordSearch} disabled={!searchKeywords.trim()}>
            Search
          </Button>
        </div>
        <p className="text-[10px] text-text-tertiary mt-1.5">Searches Greenhouse, Lever, Ashby, Workable via web — no company setup needed</p>

        {showSearchResults && searchResults.length > 0 && (
          <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto border-t border-[rgba(255,255,255,0.06)] pt-3">
            {searchResults.map((r, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.02]">
                <Badge variant={r.source}>{SOURCE_LABELS[r.source] || r.source}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-body text-text-primary truncate">{r.title}</p>
                  <p className="text-caption text-text-tertiary">{r.company}</p>
                </div>
                {r.url && (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-text-tertiary hover:text-accent flex-shrink-0">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <SearchInput value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Filter jobs..." className="flex-1 min-w-[200px]" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 bg-surface-2 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary focus:outline-none">
          <option value="">All Statuses</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
        </select>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="px-3 py-2 bg-surface-2 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary focus:outline-none">
          <option value="">All Sources</option>
          {SOURCE_OPTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select value={minScoreFilter} onChange={(e) => setMinScoreFilter(parseInt(e.target.value))}
          className="px-3 py-2 bg-surface-2 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary focus:outline-none"
        >
          <option value={0}>Any Score</option>
          <option value={50}>50+</option>
          <option value={70}>70+</option>
          <option value={80}>80+</option>
        </select>
        <button
          onClick={() => {
            const bookmarked = jobs.filter(j => j.bookmarked).map(j => j.id)
            if (selectedJobs.size > 0 && [...selectedJobs].every(id => bookmarked.includes(id))) {
              setSelectedJobs(new Set())
            } else {
              setSelectedJobs(new Set(bookmarked))
            }
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-surface-2 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-tertiary hover:text-warning transition-colors"
          title="Select bookmarked jobs"
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span className="text-caption">{jobs.filter(j => j.bookmarked).length}</span>
        </button>

        {filtered.length > 0 && (
          <button
            onClick={() => {
              if (selectedJobs.size === filtered.length) {
                setSelectedJobs(new Set())
              } else {
                setSelectedJobs(new Set(filtered.map(j => j.id)))
              }
            }}
            className="text-caption text-text-tertiary hover:text-text-secondary"
          >
            {selectedJobs.size === filtered.length ? 'Deselect All' : 'Select All'}
          </button>
        )}
        {selectedJobs.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-caption text-accent">{selectedJobs.size} selected</span>
            <Button variant="primary" size="sm" icon={<Sparkles className="w-3.5 h-3.5" />} loading={bulkPreparing} onClick={handleBulkPrepare}>
              Prepare Apps
            </Button>
            <Button variant="accent" size="sm" icon={<Users className="w-3.5 h-3.5" />} loading={bulkDiscovering} onClick={handleBulkDiscover}>
              Find Contacts
            </Button>
            <Button variant="destructive" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={handleBulkDelete}>
              Delete
            </Button>
            <button onClick={() => setSelectedJobs(new Set())} className="text-caption text-text-tertiary hover:text-text-secondary">Clear</button>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-24 rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Briefcase className="w-10 h-10" />} title="No jobs found" description="Add companies in Settings with their ATS slugs, then click Scrape to discover positions." />
      ) : view === 'kanban' ? (
        /* KANBAN VIEW */
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
          {kanbanData.map((col) => (
            <div key={col.status} className="flex-shrink-0 w-72">
              <div className={clsx('flex items-center justify-between mb-3 pb-2 border-b-2', KANBAN_COLORS[col.status])}>
                <div className="flex items-center gap-2">
                  <Badge variant={col.status}>{STATUS_LABELS[col.status] || col.status}</Badge>
                  <span className="text-caption text-text-tertiary font-tabular">{col.jobs.length}</span>
                </div>
              </div>
              <div className="space-y-2 min-h-[200px]">
                {col.jobs.slice(0, 20).map((job) => (
                  <div
                    key={job.id}
                    onClick={() => {
                      setDetailJob(job)
                      setJobDescription('')
                      setLoadingJD(true)
                      apiFetch<{ description?: string }>(`/jobs/${job.id}`).then(j => {
                        if (j.description) setJobDescription(j.description)
                      }).catch(() => {}).finally(() => setLoadingJD(false))
                    }}
                    className={clsx(
                      'bg-surface-2 rounded-lg p-3 border card-hover cursor-pointer group',
                      job.match_score !== null && job.match_score >= 70 ? 'border-gain/30' :
                      job.match_score !== null && job.match_score >= 50 ? 'border-warning/30' :
                      'border-[rgba(255,255,255,0.06)]',
                    )}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <div className="w-7 h-7 rounded-md bg-accent/8 flex items-center justify-center text-[11px] font-medium text-accent flex-shrink-0">
                        {(job.company_name || '?')[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-body text-text-primary font-medium leading-snug">{job.title}</p>
                        <p className="text-caption text-text-tertiary truncate">{job.company_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant={job.source}>{SOURCE_LABELS[job.source] || job.source}</Badge>
                      {job.match_score !== null && (
                        <Badge variant={job.match_score >= 70 ? 'gain' : job.match_score >= 40 ? 'warning' : 'default'}>
                          {Math.round(job.match_score)}%
                        </Badge>
                      )}
                      {job.contact_count > 0 && (
                        <span className="text-[10px] text-text-tertiary flex items-center gap-0.5">
                          <Users className="w-3 h-3" /> {job.contact_count}
                        </span>
                      )}
                      {(() => {
                        const age = timeAgo(job.posted_at)
                        return age ? <span className={clsx('text-[10px]', age.color)}>{age.text}</span> : null
                      })()}
                    </div>
                  </div>
                ))}
                {col.jobs.length > 20 && (
                  <p className="text-caption text-text-tertiary text-center py-2">+{col.jobs.length - 20} more</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-caption text-text-tertiary">{filtered.length} jobs — page {currentPage + 1}/{totalPages || 1}</span>
            <div className="flex items-center gap-1 ml-auto">
              <button onClick={() => setSortBy(sortBy === 'scraped_at' ? 'posted_at' : sortBy === 'posted_at' ? 'match_score' : 'scraped_at')} className="flex items-center gap-1 px-2 py-1 rounded text-caption text-text-tertiary hover:text-text-secondary">
                <ArrowUpDown className="w-3 h-3" /> {sortBy === 'scraped_at' ? 'Added' : sortBy === 'posted_at' ? 'Posted' : 'Score'} {sortDir === 'desc' ? '↓' : '↑'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {paginatedJobs.map((job) => {
              const isSelected = selectedJobs.has(job.id)
              return (
                <div
                  key={job.id}
                  className={clsx(
                    'bg-surface-2 rounded-lg p-4 border transition-colors',
                    isSelected ? 'border-accent/30' : 'border-[rgba(255,255,255,0.06)] card-hover',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <button onClick={() => setSelectedJobs((prev) => { const n = new Set(prev); isSelected ? n.delete(job.id) : n.add(job.id); return n })} className="mt-0.5 flex-shrink-0">
                      {isSelected ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4 text-text-tertiary" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-heading text-text-primary truncate">{job.title}</h3>
                            {job.url && <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-text-tertiary hover:text-accent flex-shrink-0"><ExternalLink className="w-3.5 h-3.5" /></a>}
                          </div>
                          <div className="flex items-center gap-3 text-caption text-text-tertiary flex-wrap">
                            <span>{job.company_name}</span>
                            {job.location && <span>{job.location}</span>}
                            {(() => { const age = timeAgo(job.posted_at); return age ? <span className={age.color}>Posted {age.text}</span> : null })()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant={job.source}>{SOURCE_LABELS[job.source] || job.source}</Badge>
                          {job.match_score !== null && <Badge variant={job.match_score >= 70 ? 'gain' : job.match_score >= 40 ? 'warning' : 'default'}>{Math.round(job.match_score)}%</Badge>}
                          <Badge variant={job.status}>{job.status}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <select value={job.status} onChange={(e) => handleStatusChange(job.id, e.target.value)} className="px-2 py-1 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded text-caption text-text-secondary focus:outline-none">
                          {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
                        </select>
                        <Button variant="primary" size="sm" icon={preparing === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} loading={preparing === job.id} onClick={() => handleQuickPrepare(job.id)}>
                          Prepare
                        </Button>
                        <Button variant="ghost" size="sm" icon={<Users className="w-3.5 h-3.5" />} loading={discovering === job.id} onClick={() => handleDiscover(job.id)}>
                          Contacts ({job.contact_count})
                        </Button>
                        <button onClick={() => handleDeleteSingle(job.id)} className="ml-auto p-1 text-text-tertiary hover:text-loss rounded transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0} className="flex items-center gap-1 px-3 py-1.5 bg-surface-2 border border-[rgba(255,255,255,0.06)] rounded-lg text-caption text-text-secondary disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i).map((i) => (
                  <button key={i} onClick={() => setCurrentPage(i)} className={clsx('w-8 h-8 rounded-lg text-caption', currentPage === i ? 'bg-accent/10 text-accent' : 'text-text-tertiary hover:bg-white/[0.03]')}>
                    {i + 1}
                  </button>
                ))}
              </div>
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))} disabled={currentPage === totalPages - 1} className="flex items-center gap-1 px-3 py-1.5 bg-surface-2 border border-[rgba(255,255,255,0.06)] rounded-lg text-caption text-text-secondary disabled:opacity-30 transition-colors">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </>
      )}

      {/* DETAIL DRAWER */}
      {detailJob && (
        <div className="fixed inset-0 z-[100] flex justify-end" onClick={() => setDetailJob(null)}>
          <div className="fixed inset-0 bg-black/40" />
          <div className="relative w-full max-w-lg bg-surface-2 border-l border-[rgba(255,255,255,0.06)] shadow-2xl animate-slide-in-right overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-surface-2 border-b border-[rgba(255,255,255,0.06)] px-5 py-4 flex items-center justify-between z-10">
              <h2 className="text-heading text-text-primary truncate">{detailJob.title}</h2>
              <button onClick={() => setDetailJob(null)} className="p-1 text-text-tertiary hover:text-text-secondary"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={detailJob.status}>{detailJob.status}</Badge>
                <Badge variant={detailJob.source}>{SOURCE_LABELS[detailJob.source] || detailJob.source}</Badge>
                {detailJob.match_score !== null && <Badge variant={detailJob.match_score >= 70 ? 'gain' : 'warning'}>{Math.round(detailJob.match_score)}% match</Badge>}
              </div>
              <div className="space-y-2">
                <p className="text-body text-text-primary">{detailJob.company_name}</p>
                {detailJob.location && <p className="text-caption text-text-tertiary">{detailJob.location}</p>}
                {detailJob.department && <p className="text-caption text-text-tertiary">{detailJob.department}</p>}
                {detailJob.posted_at && <p className="text-caption text-text-tertiary">Posted {new Date(detailJob.posted_at).toLocaleDateString()}</p>}
              </div>
              <div className="flex gap-2 flex-wrap">
                <select value={detailJob.status} onChange={(e) => { handleStatusChange(detailJob.id, e.target.value); setDetailJob({ ...detailJob, status: e.target.value }) }} className="px-2 py-1 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded text-caption text-text-secondary focus:outline-none">
                  {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
                </select>
                <Button variant="primary" size="sm" icon={preparing === detailJob.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} loading={preparing === detailJob.id} onClick={() => handleQuickPrepare(detailJob.id)}>
                  Prepare Application
                </Button>
                <Button variant="accent" size="sm" icon={<Users className="w-3.5 h-3.5" />} loading={discovering === detailJob.id} onClick={() => handleDiscover(detailJob.id)}>
                  Find Contacts ({detailJob.contact_count})
                </Button>
                <button
                  onClick={() => handleToggleBookmark(detailJob.id, detailJob.bookmarked)}
                  className={clsx('p-1.5 rounded transition-colors', detailJob.bookmarked ? 'text-warning bg-warning/10' : 'text-text-tertiary hover:text-warning')}
                >
                  <Bookmark className="w-3.5 h-3.5" fill={detailJob.bookmarked ? 'currentColor' : 'none'} />
                </button>
                {detailJob.url && (
                  <a href={detailJob.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />}>Open</Button>
                  </a>
                )}
              </div>

              {/* Job Description */}
              {(jobDescription || loadingJD) && (
                <div>
                  <p className="text-label text-text-primary flex items-center gap-1.5 mb-2">
                    <Briefcase className="w-3.5 h-3.5 text-accent" />
                    Job Description
                  </p>
                  {loadingJD ? (
                    <div className="flex items-center gap-2 text-caption text-text-tertiary py-4">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap text-[11px] text-text-tertiary bg-surface-1 rounded-lg p-3 font-sans leading-relaxed max-h-64 overflow-y-auto border border-[rgba(255,255,255,0.04)]">
                      {jobDescription.slice(0, 3000)}{jobDescription.length > 3000 ? '...' : ''}
                    </pre>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-label text-text-primary flex items-center gap-1.5 mb-2">
                  <StickyNote className="w-3.5 h-3.5 text-accent" />
                  Notes — why this role?
                </label>
                <textarea
                  defaultValue={detailJob.user_notes || ''}
                  onBlur={e => {
                    const val = e.target.value
                    if (val !== (detailJob.user_notes || '')) handleSaveNotes(detailJob.id, val)
                  }}
                  rows={3}
                  placeholder="Add notes about why this role interests you, key things to mention, etc."
                  className="w-full px-3 py-2 bg-surface-1 border border-[rgba(255,255,255,0.06)] rounded-lg text-caption text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 resize-y"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCRAPE MODAL */}
      <Modal open={showScrapeModal} onClose={() => setShowScrapeModal(false)} title="Scrape All Job Boards" size="sm">
        <div className="space-y-4">
          <p className="text-caption text-text-tertiary">Select which ATS sources to scrape across all your tracked companies:</p>
          <div className="grid grid-cols-2 gap-2">
            {SOURCE_OPTIONS.map((src) => (
              <label key={src.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-white/[0.02]">
                <input type="checkbox" checked={selectedSources.has(src.id)} onChange={() => setSelectedSources((prev) => { const n = new Set(prev); n.has(src.id) ? n.delete(src.id) : n.add(src.id); return n })} className="rounded border-[rgba(255,255,255,0.2)] bg-surface-2 text-accent" />
                <span className="text-body text-text-secondary">{src.label}</span>
              </label>
            ))}
          </div>
          <Button variant="primary" onClick={handleScrape} loading={scraping} disabled={selectedSources.size === 0} className="w-full">Start Scrape</Button>
        </div>
      </Modal>
    </div>
  )
}
