import { useEffect, useState } from 'react'
import {
  Send, FileText, Target, MessageSquare, CheckCircle, XCircle,
  Loader2, ChevronDown, ChevronUp, ExternalLink, Trash2,
  Sparkles, ArrowRight, Copy, Check, Eye,
} from 'lucide-react'
import clsx from 'clsx'
import { apiFetch } from '../api/client'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { toast } from '../components/ui/Toast'

interface ApplicationDraft {
  id: string
  job_id: string
  resume_id: string | null
  cover_letter: string | null
  tailored_summary: string | null
  match_score: number | null
  match_analysis: string | null
  key_talking_points: Array<{ text: string }>
  status: string
  applied_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  job_title: string | null
  company_name: string | null
  job_url: string | null
}

interface Job {
  id: string
  title: string
  company_name: string | null
  status: string
  url: string | null
}

interface Resume {
  id: string
  title: string
  content: string
  is_master: boolean
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  ready: 'Ready for Review',
  approved: 'Approved',
  applied: 'Applied',
  withdrawn: 'Withdrawn',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'info',
  ready: 'warning',
  approved: 'accent',
  applied: 'gain',
  withdrawn: 'default',
}

export default function Applications() {
  const [apps, setApps] = useState<ApplicationDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  // Prepare new application
  const [showPrepModal, setShowPrepModal] = useState(false)
  const [availableJobs, setAvailableJobs] = useState<Job[]>([])
  const [selectedJobId, setSelectedJobId] = useState('')
  const [preparing, setPreparing] = useState(false)

  // Detail view
  const [activeApp, setActiveApp] = useState<ApplicationDraft | null>(null)
  const [generatingPrep, setGeneratingPrep] = useState(false)
  const [activeResume, setActiveResume] = useState<Resume | null>(null)
  const [masterResume, setMasterResume] = useState<Resume | null>(null)
  const [showCoverLetter, setShowCoverLetter] = useState(false)
  const [showResume, setShowResume] = useState(false)
  const [showComparison, setShowComparison] = useState(false)
  const [copiedCL, setCopiedCL] = useState(false)
  const [editingCL, setEditingCL] = useState(false)
  const [clInstruction, setClInstruction] = useState('')
  const [editingCLLoading, setEditingCLLoading] = useState(false)

  const fetchApps = async () => {
    try {
      const params = statusFilter ? `?status=${statusFilter}` : ''
      const data = await apiFetch<ApplicationDraft[]>(`/applications${params}`)
      setApps(data)
    } catch { /* */ }
    setLoading(false)
  }

  const fetchJobs = async () => {
    try {
      const data = await apiFetch<Job[]>('/jobs?status=new&limit=100')
      setAvailableJobs(data.concat(await apiFetch<Job[]>('/jobs?status=saved&limit=100')))
    } catch { /* */ }
  }

  useEffect(() => { fetchApps() }, [statusFilter])

  const handlePrepare = async () => {
    if (!selectedJobId) return
    setPreparing(true)
    try {
      const result = await apiFetch<ApplicationDraft>('/applications/prepare', {
        method: 'POST',
        body: JSON.stringify({ job_id: selectedJobId }),
      })
      setShowPrepModal(false)
      setSelectedJobId('')
      await fetchApps()
      setActiveApp(result)
      toast('Application prepared! Review before applying.')
    } catch (e: any) {
      toast(e?.message || 'Preparation failed')
    }
    setPreparing(false)
  }

  const handleStatusUpdate = async (appId: string, status: string) => {
    try {
      const updated = await apiFetch<ApplicationDraft>(`/applications/${appId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setApps(prev => prev.map(a => a.id === appId ? updated : a))
      if (activeApp?.id === appId) setActiveApp(updated)
      toast(`Application ${STATUS_LABELS[status]?.toLowerCase() || status}`)
    } catch { /* */ }
  }

  const handleDelete = async (appId: string) => {
    try {
      await apiFetch(`/applications/${appId}`, { method: 'DELETE' })
      setApps(prev => prev.filter(a => a.id !== appId))
      if (activeApp?.id === appId) setActiveApp(null)
      toast('Application deleted')
    } catch { /* */ }
  }

  const loadResume = async (resumeId: string) => {
    try {
      const resumes = await apiFetch<Resume[]>('/resumes')
      const r = resumes.find(r => r.id === resumeId)
      if (r) setActiveResume(r)
      const master = resumes.find(r => r.is_master)
      if (master) setMasterResume(master)
    } catch { /* */ }
  }

  const handleCopyCoverLetter = () => {
    if (!activeApp?.cover_letter) return
    navigator.clipboard.writeText(activeApp.cover_letter)
    setCopiedCL(true)
    setTimeout(() => setCopiedCL(false), 2000)
  }

  const scoreColor = (score: number | null) => {
    if (score === null) return 'text-text-tertiary'
    if (score >= 75) return 'text-gain'
    if (score >= 50) return 'text-warning'
    return 'text-loss'
  }

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-display text-text-primary">Applications</h1>
          <p className="text-body text-text-secondary mt-1">
            Prepare, review, and track job applications
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Sparkles className="w-4 h-4" />}
          onClick={() => { setShowPrepModal(true); fetchJobs() }}
        >
          Prepare Application
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 mb-6 p-0.5 bg-surface-2 rounded-lg w-fit">
        {['', 'ready', 'approved', 'applied', 'draft'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={clsx(
              'px-3 py-1.5 rounded-md text-caption transition-colors',
              statusFilter === s ? 'bg-surface-4 text-text-primary' : 'text-text-tertiary hover:text-text-secondary',
            )}
          >
            {s ? STATUS_LABELS[s] : 'All'} {s === '' && apps.length > 0 && `(${apps.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24 rounded-lg" />)}</div>
      ) : apps.length === 0 ? (
        <EmptyState
          icon={<Send className="w-10 h-10" />}
          title="No applications yet"
          description="Click 'Prepare Application' to select a job — AI will tailor your resume, write a cover letter, and analyze your match."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-6">
          {/* App list */}
          <div className="space-y-2">
            {apps.map(app => (
              <button
                key={app.id}
                onClick={() => {
                  setActiveApp(app)
                  setShowResume(false)
                  setShowCoverLetter(false)
                  if (app.resume_id) loadResume(app.resume_id)
                }}
                className={clsx(
                  'w-full text-left p-4 rounded-lg border transition-all',
                  activeApp?.id === app.id
                    ? 'bg-accent/5 border-accent/30'
                    : 'bg-surface-2 border-[rgba(255,255,255,0.06)] hover:bg-surface-3',
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-body text-text-primary font-medium truncate">{app.job_title || 'Unknown Role'}</p>
                    <p className="text-caption text-text-tertiary">{app.company_name}</p>
                  </div>
                  <Badge variant={STATUS_COLORS[app.status] || 'default'}>
                    {STATUS_LABELS[app.status] || app.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  {app.match_score !== null && (
                    <span className={clsx('text-label font-tabular font-semibold', scoreColor(app.match_score))}>
                      {Math.round(app.match_score)}% match
                    </span>
                  )}
                  <span className="text-[10px] text-text-tertiary">
                    {new Date(app.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Detail panel */}
          {activeApp && (
            <div className="bg-surface-2 rounded-xl border border-[rgba(255,255,255,0.06)]">
              {/* Header */}
              <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-heading text-text-primary">{activeApp.job_title}</h2>
                    <div className="flex items-center gap-2">
                      <p className="text-body text-text-tertiary">{activeApp.company_name}</p>
                      {activeApp.job_url && (
                        <a href={activeApp.job_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent/80">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeApp.match_score !== null && (
                      <div className={clsx('text-xl font-bold font-tabular', scoreColor(activeApp.match_score))}>
                        {Math.round(activeApp.match_score)}%
                      </div>
                    )}
                  </div>
                </div>

                {/* Match summary */}
                {activeApp.tailored_summary && (
                  <p className="text-caption text-text-secondary mt-3 p-3 bg-surface-1 rounded-lg">
                    {activeApp.tailored_summary}
                  </p>
                )}
              </div>

              {/* Actions bar */}
              <div className="px-5 py-3 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-2 flex-wrap">
                <Button variant="ghost" size="sm" icon={<Copy className="w-3.5 h-3.5" />} onClick={() => {
                  const parts = [
                    `APPLICATION: ${activeApp.job_title} at ${activeApp.company_name}`,
                    '',
                    '═══ COVER LETTER ═══',
                    activeApp.cover_letter || '(none)',
                    '',
                    '═══ TAILORED RESUME ═══',
                    activeResume?.content || '(none)',
                    '',
                    '═══ TALKING POINTS ═══',
                    ...(activeApp.key_talking_points || []).map(tp => `• ${tp.text}`),
                    '',
                    `Match Score: ${activeApp.match_score ? Math.round(activeApp.match_score) + '%' : 'N/A'}`,
                    activeApp.match_analysis || '',
                  ]
                  navigator.clipboard.writeText(parts.join('\n'))
                  toast('Full application copied to clipboard')
                }}>
                  Copy All
                </Button>
                {activeApp.status === 'ready' && (
                  <Button variant="accent" size="sm" icon={<CheckCircle className="w-3.5 h-3.5" />} onClick={() => handleStatusUpdate(activeApp.id, 'approved')}>
                    Approve
                  </Button>
                )}
                {activeApp.status === 'approved' && (
                  <Button variant="primary" size="sm" icon={<Send className="w-3.5 h-3.5" />} onClick={() => handleStatusUpdate(activeApp.id, 'applied')}>
                    Mark as Applied
                  </Button>
                )}
                <Button variant="ghost" size="sm"
                  icon={generatingPrep ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Target className="w-3.5 h-3.5" />}
                  loading={generatingPrep}
                  onClick={async () => {
                    setGeneratingPrep(true)
                    try {
                      const r = await apiFetch<{ generated: number }>(`/applications/${activeApp.id}/interview-prep`, {
                        method: 'POST', body: JSON.stringify({ count: 10 }),
                      })
                      toast(`Generated ${r.generated} interview questions — check Interview Prep`)
                    } catch { toast('Generation failed') }
                    setGeneratingPrep(false)
                  }}
                >
                  Interview Prep
                </Button>
                {activeApp.status !== 'withdrawn' && activeApp.status !== 'applied' && (
                  <Button variant="ghost" size="sm" icon={<XCircle className="w-3.5 h-3.5" />} onClick={() => handleStatusUpdate(activeApp.id, 'withdrawn')}>
                    Withdraw
                  </Button>
                )}
                <button onClick={() => handleDelete(activeApp.id)} className="ml-auto p-1.5 text-text-tertiary hover:text-loss rounded transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Content sections */}
              <div className="p-5 space-y-4">
                {/* Next Steps */}
                {activeApp.status === 'ready' && (
                  <div className="p-3 bg-accent/5 rounded-lg border border-accent/20">
                    <p className="text-label text-accent font-medium mb-2">Recommended Next Steps</p>
                    <ol className="space-y-1.5 text-caption text-text-secondary">
                      <li className="flex gap-2"><span className="text-accent font-bold">1.</span> Review the tailored resume below — make edits if needed</li>
                      <li className="flex gap-2"><span className="text-accent font-bold">2.</span> Read the cover letter — copy it for the application</li>
                      <li className="flex gap-2"><span className="text-accent font-bold">3.</span> Click "Approve" when you're satisfied</li>
                      <li className="flex gap-2"><span className="text-accent font-bold">4.</span> {activeApp.job_url ? <span>Open the <a href={activeApp.job_url} target="_blank" rel="noopener noreferrer" className="text-accent underline">job posting</a> and apply</span> : 'Apply on the company website'}</li>
                      <li className="flex gap-2"><span className="text-accent font-bold">5.</span> Come back and click "Mark as Applied" to track it</li>
                    </ol>
                  </div>
                )}

                {activeApp.status === 'approved' && activeApp.job_url && (
                  <div className="p-3 bg-gain/5 rounded-lg border border-gain/20">
                    <p className="text-label text-gain font-medium mb-2">Ready to Apply!</p>
                    <a href={activeApp.job_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="primary" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />}>
                        Open Job Posting & Apply
                      </Button>
                    </a>
                    <p className="text-[11px] text-text-tertiary mt-2">After applying, click "Mark as Applied" above to update your pipeline.</p>
                  </div>
                )}

                {/* Talking Points */}
                {activeApp.key_talking_points.length > 0 && (
                  <div>
                    <h3 className="text-label text-text-primary mb-2 flex items-center gap-2">
                      <Target className="w-3.5 h-3.5 text-accent" />
                      Key Talking Points
                    </h3>
                    <ul className="space-y-1.5">
                      {activeApp.key_talking_points.map((tp, i) => (
                        <li key={i} className="flex items-start gap-2 text-caption text-text-secondary">
                          <ArrowRight className="w-3 h-3 text-accent mt-0.5 flex-shrink-0" />
                          {tp.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Cover Letter */}
                {activeApp.cover_letter && (
                  <div>
                    <button
                      onClick={() => setShowCoverLetter(!showCoverLetter)}
                      className="w-full flex items-center justify-between text-label text-text-primary mb-2"
                    >
                      <span className="flex items-center gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-accent" />
                        Cover Letter
                      </span>
                      {showCoverLetter ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {showCoverLetter && (
                      <div className="space-y-2">
                        <div className="relative">
                          <pre className="whitespace-pre-wrap text-caption text-text-secondary bg-surface-1 rounded-lg p-4 font-sans leading-relaxed">
                            {activeApp.cover_letter}
                          </pre>
                          <button
                            onClick={handleCopyCoverLetter}
                            className="absolute top-2 right-2 p-1.5 bg-surface-2 rounded-md text-text-tertiary hover:text-text-secondary transition-colors"
                          >
                            {copiedCL ? <Check className="w-3.5 h-3.5 text-gain" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        {editingCL ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={clInstruction}
                              onChange={e => setClInstruction(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && clInstruction.trim()) {
                                  setEditingCLLoading(true)
                                  apiFetch<{ cover_letter: string }>(`/applications/${activeApp.id}/edit-cover-letter`, {
                                    method: 'POST', body: JSON.stringify({ instruction: clInstruction }),
                                  }).then(r => {
                                    setActiveApp(prev => prev ? { ...prev, cover_letter: r.cover_letter } : prev)
                                    setApps(prev => prev.map(a => a.id === activeApp.id ? { ...a, cover_letter: r.cover_letter } : a))
                                    setClInstruction('')
                                    setEditingCL(false)
                                    toast('Cover letter updated')
                                  }).catch(() => toast('Edit failed')).finally(() => setEditingCLLoading(false))
                                }
                              }}
                              placeholder="e.g., Make it shorter, more enthusiastic..."
                              className="flex-1 px-3 py-1.5 bg-surface-1 border border-[rgba(255,255,255,0.06)] rounded-lg text-caption text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50"
                              autoFocus
                            />
                            {editingCLLoading ? <Loader2 className="w-4 h-4 text-accent animate-spin mt-1.5" /> : null}
                            <button onClick={() => setEditingCL(false)} className="text-caption text-text-tertiary">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setEditingCL(true)} className="text-[11px] text-accent hover:underline">
                            Edit with AI...
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Tailored Resume */}
                {activeResume && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <button
                        onClick={() => setShowResume(!showResume)}
                        className="flex items-center gap-2 text-label text-text-primary"
                      >
                        <FileText className="w-3.5 h-3.5 text-accent" />
                        Tailored Resume
                        {showResume ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      {showResume && masterResume && (
                        <button
                          onClick={() => setShowComparison(!showComparison)}
                          className={clsx(
                            'text-[11px] px-2 py-1 rounded-md transition-colors',
                            showComparison ? 'bg-accent/10 text-accent' : 'bg-surface-3 text-text-tertiary hover:text-text-secondary',
                          )}
                        >
                          {showComparison ? 'Hide Original' : 'Compare with Master'}
                        </button>
                      )}
                    </div>
                    {showResume && (
                      showComparison && masterResume ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] text-text-tertiary mb-1 font-medium uppercase tracking-wider">Master (Original)</p>
                            <pre className="whitespace-pre-wrap text-[11px] text-text-tertiary bg-surface-1 rounded-lg p-3 font-sans leading-relaxed max-h-80 overflow-y-auto border border-[rgba(255,255,255,0.04)]">
                              {masterResume.content}
                            </pre>
                          </div>
                          <div>
                            <p className="text-[10px] text-accent mb-1 font-medium uppercase tracking-wider">Tailored (This Role)</p>
                            <pre className="whitespace-pre-wrap text-[11px] text-text-secondary bg-surface-1 rounded-lg p-3 font-sans leading-relaxed max-h-80 overflow-y-auto border border-accent/20">
                              {activeResume.content}
                            </pre>
                          </div>
                        </div>
                      ) : (
                        <pre className="whitespace-pre-wrap text-caption text-text-secondary bg-surface-1 rounded-lg p-4 font-sans leading-relaxed max-h-96 overflow-y-auto">
                          {activeResume.content}
                        </pre>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Prepare Application Modal */}
      <Modal open={showPrepModal} onClose={() => setShowPrepModal(false)} title="Prepare Application" size="md">
        <div className="space-y-4">
          <p className="text-caption text-text-tertiary">
            Select a job to prepare for. AI will tailor your resume, write a cover letter, analyze match, and generate talking points.
          </p>

          {availableJobs.length === 0 ? (
            <p className="text-body text-text-tertiary text-center py-6">
              No new/saved jobs available. Scrape jobs first from the Jobs page.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
              {availableJobs.map(job => (
                <button
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  className={clsx(
                    'w-full text-left p-3 rounded-lg border transition-colors',
                    selectedJobId === job.id
                      ? 'border-accent/30 bg-accent/5'
                      : 'border-[rgba(255,255,255,0.04)] hover:bg-white/[0.02]',
                  )}
                >
                  <p className="text-body text-text-primary font-medium">{job.title}</p>
                  <p className="text-caption text-text-tertiary">{job.company_name}</p>
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowPrepModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              icon={preparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              loading={preparing}
              disabled={!selectedJobId}
              onClick={handlePrepare}
            >
              Prepare Application
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
