import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Sparkles, Save, Plus, Trash2, Edit2, Upload,
  ChevronDown, ChevronUp, Clock, Star, Send, Loader2,
  Wand2, Target, Copy, Check, Search, ArrowRight,
} from 'lucide-react'
import clsx from 'clsx'
import { apiFetch } from '../api/client'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { toast } from '../components/ui/Toast'

interface Resume {
  id: string
  title: string
  content: string
  is_master: boolean
  parent_id: string | null
  job_id: string | null
  version: number
  edit_history: Array<{ prompt: string; timestamp: string; changes_summary: string }>
  created_at: string
  updated_at: string
}

export default function ResumePage() {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [loading, setLoading] = useState(true)
  const [activeResume, setActiveResume] = useState<Resume | null>(null)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')

  // NLP edit
  const [showNlpEdit, setShowNlpEdit] = useState(false)
  const [nlpInstruction, setNlpInstruction] = useState('')
  const [nlpProcessing, setNlpProcessing] = useState(false)

  // Create/import
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createMode, setCreateMode] = useState<'write' | 'paste'>('paste')
  const [pasteContent, setPasteContent] = useState('')
  const [createTitle, setCreateTitle] = useState('Master Resume')
  const [isMaster, setIsMaster] = useState(true)
  const [parsing, setParsing] = useState(false)

  // History
  const [showHistory, setShowHistory] = useState(false)

  // Copy state
  const [copied, setCopied] = useState(false)

  // Templates
  const TEMPLATES = [
    { name: 'Software Engineer', content: `# Your Name\n\n**Software Engineer** | San Francisco, CA | email@example.com | (555) 000-0000\n\n## Professional Summary\nSoftware engineer with X years of experience building scalable web applications. Expertise in [your stack]. Passionate about [your focus area].\n\n## Experience\n### Senior Software Engineer — Company Name\n*Jan 2022 — Present* | San Francisco, CA\n- Led development of [project], resulting in [quantifiable impact]\n- Architected [system] handling [scale metric]\n- Mentored team of [N] engineers on [topic]\n\n### Software Engineer — Previous Company\n*Jun 2019 — Dec 2021* | New York, NY\n- Built [feature] that [impact]\n- Reduced [metric] by [percentage] through [action]\n- Collaborated with [team] to deliver [project]\n\n## Education\n### B.S. Computer Science — University Name\n*2019*\n\n## Skills\nPython, TypeScript, React, Node.js, PostgreSQL, AWS, Docker, Kubernetes` },
    { name: 'Product Manager', content: `# Your Name\n\n**Product Manager** | New York, NY | email@example.com | (555) 000-0000\n\n## Professional Summary\nProduct manager with X years of experience driving 0-to-1 products. Track record of [key achievement]. Expert in [domain].\n\n## Experience\n### Senior Product Manager — Company Name\n*Mar 2021 — Present* | New York, NY\n- Defined product strategy for [product], growing [metric] by [X]%\n- Led cross-functional team of [N] to ship [feature] in [timeline]\n- Conducted [N]+ user interviews to validate [hypothesis]\n\n### Product Manager — Previous Company\n*Jan 2019 — Feb 2021*\n- Owned roadmap for [product area] serving [N] users\n- Launched [feature] that drove [revenue/engagement metric]\n\n## Education\n### MBA — Business School\n*2019*\n\n## Skills\nProduct Strategy, User Research, SQL, Figma, A/B Testing, Agile/Scrum` },
    { name: 'Data / ML Engineer', content: `# Your Name\n\n**ML Engineer** | Remote | email@example.com | (555) 000-0000\n\n## Professional Summary\nML engineer with X years of experience deploying production AI systems. Expertise in [NLP/CV/RecSys]. Built systems processing [scale].\n\n## Experience\n### Senior ML Engineer — Company Name\n*2022 — Present*\n- Designed and deployed [model type] serving [QPS] requests\n- Reduced inference latency from [X]ms to [Y]ms through [optimization]\n- Built [pipeline] processing [volume] of data daily\n\n### ML Engineer — Previous Company\n*2020 — 2022*\n- Developed [model] achieving [metric] on [benchmark]\n- Built end-to-end ML pipeline: data ingestion → training → serving\n\n## Education\n### M.S. Computer Science — University\n*2020*\n\n## Skills\nPython, PyTorch, TensorFlow, LLMs, RAG, Vector Databases, AWS SageMaker, MLflow` },
  ]

  // AI Suggestions
  const [suggestions, setSuggestions] = useState<Array<{ category: string; title: string; description: string; priority: string }>>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [overallScore, setOverallScore] = useState<number | null>(null)

  // Tailor for job
  const [showTailorModal, setShowTailorModal] = useState(false)
  const [tailorJobs, setTailorJobs] = useState<Array<{ id: string; title: string; company_name: string }>>([])
  const [selectedTailorJob, setSelectedTailorJob] = useState('')
  const [tailoring, setTailoring] = useState(false)

  // Role matching
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [matchResults, setMatchResults] = useState<Array<{ id: string; title: string; company_name: string; location: string | null; match_score: number; match_reasoning: string }>>([])
  const [matching, setMatching] = useState(false)
  const [sampleJd, setSampleJd] = useState('')
  const navigate = useNavigate()

  const fetchResumes = async () => {
    try {
      const data = await apiFetch<Resume[]>('/resumes')
      setResumes(data)
      if (data.length > 0 && !activeResume) {
        const master = data.find(r => r.is_master)
        setActiveResume(master || data[0])
      }
    } catch { /* */ }
    setLoading(false)
  }

  useEffect(() => { fetchResumes() }, [])

  const handleSaveEdit = async () => {
    if (!activeResume) return
    try {
      const updated = await apiFetch<Resume>(`/resumes/${activeResume.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: activeResume.title,
          content: editContent,
          is_master: activeResume.is_master,
        }),
      })
      setActiveResume(updated)
      setEditing(false)
      setResumes(prev => prev.map(r => r.id === updated.id ? updated : r))
      toast('Resume saved')
    } catch { toast('Failed to save') }
  }

  const handleNlpEdit = async () => {
    if (!activeResume || !nlpInstruction.trim()) return
    setNlpProcessing(true)
    try {
      const updated = await apiFetch<Resume>(`/resumes/${activeResume.id}/edit`, {
        method: 'POST',
        body: JSON.stringify({ instruction: nlpInstruction }),
      })
      setActiveResume(updated)
      setResumes(prev => prev.map(r => r.id === updated.id ? updated : r))
      setNlpInstruction('')
      setShowNlpEdit(false)
      toast('Resume updated by AI')
    } catch (e: any) {
      toast(e?.message || 'AI edit failed')
    }
    setNlpProcessing(false)
  }

  const handleCreate = async () => {
    if (!pasteContent.trim()) return

    if (createMode === 'paste') {
      // Parse the raw text through Claude
      setParsing(true)
      try {
        const parsed = await apiFetch<{ resume: string; detected_name: string }>('/resumes/parse', {
          method: 'POST',
          body: JSON.stringify({ text: pasteContent }),
        })
        const resume = await apiFetch<Resume>('/resumes', {
          method: 'POST',
          body: JSON.stringify({
            title: createTitle || `Resume - ${parsed.detected_name || 'Untitled'}`,
            content: parsed.resume,
            is_master: isMaster,
          }),
        })
        setActiveResume(resume)
        await fetchResumes()
        setShowCreateModal(false)
        setPasteContent('')
        toast('Resume created')
      } catch (e: any) {
        toast(e?.message || 'Failed to parse resume')
      }
      setParsing(false)
    } else {
      try {
        const resume = await apiFetch<Resume>('/resumes', {
          method: 'POST',
          body: JSON.stringify({
            title: createTitle,
            content: pasteContent,
            is_master: isMaster,
          }),
        })
        setActiveResume(resume)
        await fetchResumes()
        setShowCreateModal(false)
        setPasteContent('')
        toast('Resume created')
      } catch { toast('Failed to create') }
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/resumes/${id}`, { method: 'DELETE' })
      setResumes(prev => prev.filter(r => r.id !== id))
      if (activeResume?.id === id) {
        setActiveResume(resumes.find(r => r.id !== id) || null)
      }
      toast('Resume deleted')
    } catch { /* */ }
  }

  const handleGetSuggestions = async () => {
    if (!activeResume) return
    setSuggestionsLoading(true)
    setShowSuggestions(true)
    try {
      const result = await apiFetch<{ suggestions: typeof suggestions; overall_score: number; summary: string }>(`/resumes/${activeResume.id}/suggestions`, { method: 'POST' })
      setSuggestions(result.suggestions || [])
      setOverallScore(result.overall_score)
    } catch { toast('Failed to get suggestions') }
    setSuggestionsLoading(false)
  }

  const handleTailor = async () => {
    if (!activeResume || !selectedTailorJob) return
    setTailoring(true)
    try {
      const tailored = await apiFetch<Resume>(`/resumes/${activeResume.id}/tailor`, {
        method: 'POST',
        body: JSON.stringify({ job_id: selectedTailorJob }),
      })
      setActiveResume(tailored)
      await fetchResumes()
      setShowTailorModal(false)
      setSelectedTailorJob('')
      toast('Tailored resume created!')
    } catch (e: any) {
      toast(e?.message || 'Tailoring failed')
    }
    setTailoring(false)
  }

  const fetchTailorJobs = async () => {
    try {
      const jobs = await apiFetch<Array<{ id: string; title: string; company_name: string }>>('/jobs?limit=50')
      setTailorJobs(jobs)
    } catch { /* */ }
  }

  const handleFindRoles = async () => {
    setMatching(true)
    setMatchResults([])
    try {
      const result = await apiFetch<{ results: typeof matchResults }>('/resumes/find-roles', {
        method: 'POST',
        body: JSON.stringify({ use_resume: true, sample_jd: sampleJd || null }),
      })
      setMatchResults(result.results || [])
      if (result.results?.length === 0) toast('No matching jobs found. Scrape more jobs first.')
    } catch (e: any) {
      toast(e?.message || 'Matching failed')
    }
    setMatching(false)
  }

  const handleCopy = () => {
    if (!activeResume) return
    navigator.clipboard.writeText(activeResume.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-display text-text-primary">Resume</h1>
          <p className="text-body text-text-secondary mt-1">
            {resumes.length} resume{resumes.length !== 1 ? 's' : ''} — edit with natural language, tailor per role
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeResume && (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={<Target className="w-3.5 h-3.5" />}
                onClick={() => { setShowTailorModal(true); fetchTailorJobs() }}
              >
                Tailor for Job
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Search className="w-3.5 h-3.5" />}
                onClick={() => setShowMatchModal(true)}
              >
                Find Roles
              </Button>
              <Button
                variant="accent"
                size="sm"
                icon={<Wand2 className="w-3.5 h-3.5" />}
                onClick={() => setShowNlpEdit(true)}
              >
                AI Edit
              </Button>
            </>
          )}
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
            New Resume
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24 rounded-lg" />)}</div>
      ) : resumes.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-10 h-10" />}
          title="No resume yet"
          description="Paste your resume text and AI will format it into clean markdown. Or write one from scratch."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          {/* Resume list sidebar */}
          <div className="space-y-2">
            {resumes.map(r => (
              <button
                key={r.id}
                onClick={() => { setActiveResume(r); setEditing(false) }}
                className={clsx(
                  'w-full text-left p-3 rounded-lg border transition-all',
                  activeResume?.id === r.id
                    ? 'bg-accent/5 border-accent/30'
                    : 'bg-surface-2 border-[rgba(255,255,255,0.06)] hover:bg-surface-3',
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  {r.is_master && <Star className="w-3 h-3 text-warning flex-shrink-0" />}
                  <span className="text-body text-text-primary font-medium truncate">{r.title}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
                  <span>v{r.version}</span>
                  <span>{r.content.split(/\s+/).length} words</span>
                  <span>{new Date(r.updated_at).toLocaleDateString()}</span>
                  {r.job_id && <Badge variant="accent" className="text-[9px] px-1 py-0">Tailored</Badge>}
                </div>
              </button>
            ))}
          </div>

          {/* Active resume */}
          {activeResume && (
            <div className="bg-surface-2 rounded-xl border border-[rgba(255,255,255,0.06)]">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(255,255,255,0.06)]">
                <div className="flex items-center gap-3">
                  <h2 className="text-heading text-text-primary">{activeResume.title}</h2>
                  {activeResume.is_master && <Badge variant="warning" dot>Master</Badge>}
                  <span className="text-caption text-text-tertiary">v{activeResume.version}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    onClick={handleCopy}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  {editing ? (
                    <>
                      <Button variant="accent" size="sm" icon={<Save className="w-3.5 h-3.5" />} onClick={handleSaveEdit}>Save</Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                    </>
                  ) : (
                    <Button variant="ghost" size="sm" icon={<Edit2 className="w-3.5 h-3.5" />} onClick={() => { setEditContent(activeResume.content); setEditing(true) }}>
                      Edit
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" icon={suggestionsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} loading={suggestionsLoading} onClick={handleGetSuggestions}>
                    Suggestions
                  </Button>
                  {activeResume.edit_history.length > 0 && (
                    <Button variant="ghost" size="sm" icon={<Clock className="w-3.5 h-3.5" />} onClick={() => setShowHistory(!showHistory)}>
                      History ({activeResume.edit_history.length})
                    </Button>
                  )}
                  {!activeResume.is_master && (
                    <button onClick={() => handleDelete(activeResume.id)} className="p-1.5 text-text-tertiary hover:text-loss rounded transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* History panel */}
              {showHistory && activeResume.edit_history.length > 0 && (
                <div className="px-5 py-3 border-b border-[rgba(255,255,255,0.06)] bg-surface-1/50">
                  <p className="text-label text-text-primary mb-2">Edit History</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {[...activeResume.edit_history].reverse().map((entry, i) => (
                      <div key={i} className="flex items-start gap-2 text-caption">
                        <Sparkles className="w-3 h-3 text-accent mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-text-secondary">"{entry.prompt}"</p>
                          <p className="text-text-tertiary">{entry.changes_summary}</p>
                          <p className="text-[10px] text-text-tertiary/60">{new Date(entry.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Suggestions Panel */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="px-5 py-3 border-b border-[rgba(255,255,255,0.06)] bg-surface-1/50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-label text-text-primary flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-accent" />
                      AI Suggestions
                      {overallScore !== null && (
                        <span className={clsx(
                          'text-caption font-tabular font-bold ml-2',
                          overallScore >= 80 ? 'text-gain' : overallScore >= 60 ? 'text-warning' : 'text-loss',
                        )}>
                          {overallScore}/100
                        </span>
                      )}
                    </p>
                    <button onClick={() => setShowSuggestions(false)} className="text-caption text-text-tertiary hover:text-text-secondary">Hide</button>
                  </div>
                  <div className="space-y-2">
                    {suggestions.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-caption">
                        <span className={clsx(
                          'px-1.5 py-0 rounded text-[9px] font-medium mt-0.5 flex-shrink-0',
                          s.priority === 'high' ? 'bg-loss/10 text-loss' : s.priority === 'medium' ? 'bg-warning/10 text-warning' : 'bg-surface-3 text-text-tertiary',
                        )}>
                          {s.priority}
                        </span>
                        <div>
                          <p className="text-text-secondary font-medium">{s.title}</p>
                          <p className="text-text-tertiary">{s.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="p-5">
                {editing ? (
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    className="w-full min-h-[500px] px-4 py-3 bg-surface-1 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary font-mono text-[13px] leading-relaxed resize-y focus:outline-none focus:border-accent/50"
                  />
                ) : (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-body text-text-primary font-sans leading-relaxed bg-transparent p-0 border-0">
                      {activeResume.content}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* NLP Edit Modal */}
      <Modal open={showNlpEdit} onClose={() => setShowNlpEdit(false)} title="Edit Resume with AI" size="md">
        <div className="space-y-4">
          <p className="text-caption text-text-tertiary">
            Describe what you want to change in natural language. AI will apply the edits while preserving your content.
          </p>
          <div className="space-y-2">
            <textarea
              value={nlpInstruction}
              onChange={e => setNlpInstruction(e.target.value)}
              rows={3}
              placeholder="e.g., Make my experience bullets more concise and add quantifiable metrics where possible"
              className="w-full px-3 py-2 bg-surface-1 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 resize-y"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleNlpEdit() }}
            />
            <div className="flex flex-wrap gap-1.5">
              {[
                'Make it more concise',
                'Add more action verbs',
                'Quantify achievements',
                'Strengthen the summary',
                'Reorder by relevance',
                'Fix formatting',
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => setNlpInstruction(suggestion)}
                  className="px-2 py-1 rounded-md text-[11px] bg-surface-3 text-text-tertiary hover:text-text-secondary hover:bg-surface-4 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowNlpEdit(false)}>Cancel</Button>
            <Button
              variant="primary"
              icon={nlpProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              loading={nlpProcessing}
              disabled={!nlpInstruction.trim()}
              onClick={handleNlpEdit}
            >
              Apply Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Tailor for Job Modal */}
      <Modal open={showTailorModal} onClose={() => setShowTailorModal(false)} title="Tailor Resume for a Job" size="md">
        <div className="space-y-4">
          <p className="text-caption text-text-tertiary">
            Select a job — AI will create a tailored copy of your resume optimized for that role's keywords and requirements.
          </p>
          {tailorJobs.length === 0 ? (
            <p className="text-body text-text-tertiary text-center py-6">No jobs available. Scrape jobs first.</p>
          ) : (
            <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
              {tailorJobs.map(job => (
                <button
                  key={job.id}
                  onClick={() => setSelectedTailorJob(job.id)}
                  className={clsx(
                    'w-full text-left p-3 rounded-lg border transition-colors',
                    selectedTailorJob === job.id ? 'border-accent/30 bg-accent/5' : 'border-[rgba(255,255,255,0.04)] hover:bg-white/[0.02]',
                  )}
                >
                  <p className="text-body text-text-primary font-medium">{job.title}</p>
                  <p className="text-caption text-text-tertiary">{job.company_name}</p>
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowTailorModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              icon={tailoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              loading={tailoring}
              disabled={!selectedTailorJob}
              onClick={handleTailor}
            >
              Tailor Resume
            </Button>
          </div>
        </div>
      </Modal>

      {/* Find Matching Roles Modal */}
      <Modal open={showMatchModal} onClose={() => setShowMatchModal(false)} title="Find Matching Roles" size="lg">
        <div className="space-y-4">
          <p className="text-caption text-text-tertiary">
            AI will score your scraped jobs against your master resume. Optionally paste a sample JD to find similar roles.
          </p>
          <textarea
            value={sampleJd}
            onChange={e => setSampleJd(e.target.value)}
            rows={3}
            placeholder="(Optional) Paste a sample job description to find similar roles..."
            className="w-full px-3 py-2 bg-surface-1 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 resize-y"
          />
          <Button
            variant="primary"
            icon={matching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            loading={matching}
            onClick={handleFindRoles}
            className="w-full"
          >
            {matching ? 'Analyzing jobs...' : 'Find Best Matches'}
          </Button>

          {matchResults.length > 0 && (
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {matchResults.map((job, i) => (
                <div key={job.id || i} className="flex items-center gap-3 p-3 bg-surface-1 rounded-lg border border-[rgba(255,255,255,0.04)]">
                  <div className={clsx(
                    'w-10 h-10 rounded-lg flex items-center justify-center text-label font-bold font-tabular flex-shrink-0',
                    job.match_score >= 75 ? 'bg-gain/10 text-gain' : job.match_score >= 50 ? 'bg-warning/10 text-warning' : 'bg-surface-3 text-text-tertiary',
                  )}>
                    {Math.round(job.match_score)}%
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body text-text-primary font-medium truncate">{job.title}</p>
                    <p className="text-caption text-text-tertiary">{job.company_name}{job.location ? ` — ${job.location}` : ''}</p>
                    <p className="text-[11px] text-text-tertiary mt-0.5">{job.match_reasoning}</p>
                  </div>
                  <Button variant="accent" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />} onClick={() => { setShowMatchModal(false); navigate('/jobs') }}>
                    View
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Create Resume Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Add Resume" size="lg">
        <div className="space-y-4">
          <div className="flex gap-1 p-0.5 bg-surface-3 rounded-lg w-fit">
            <button
              onClick={() => setCreateMode('paste')}
              className={clsx(
                'px-3 py-1.5 rounded-md text-caption transition-colors',
                createMode === 'paste' ? 'bg-surface-2 text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary',
              )}
            >
              Paste & Parse
            </button>
            <button
              onClick={() => setCreateMode('write')}
              className={clsx(
                'px-3 py-1.5 rounded-md text-caption transition-colors',
                createMode === 'write' ? 'bg-surface-2 text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary',
              )}
            >
              Write Markdown
            </button>
          </div>

          <input
            type="text"
            value={createTitle}
            onChange={e => setCreateTitle(e.target.value)}
            placeholder="Resume title"
            className="w-full px-3 py-2 bg-surface-1 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50"
          />

          {createMode === 'write' && !pasteContent && (
            <div>
              <p className="text-caption text-text-tertiary mb-2">Start from a template:</p>
              <div className="flex gap-2 mb-3">
                {TEMPLATES.map(t => (
                  <button
                    key={t.name}
                    onClick={() => setPasteContent(t.content)}
                    className="px-3 py-1.5 bg-surface-3 rounded-lg text-caption text-text-secondary hover:bg-accent/5 hover:text-accent border border-transparent hover:border-accent/30 transition-all"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <textarea
            value={pasteContent}
            onChange={e => setPasteContent(e.target.value)}
            rows={12}
            placeholder={createMode === 'paste'
              ? 'Paste your resume text here (from PDF, LinkedIn, etc.) — AI will parse it into clean markdown'
              : 'Write your resume in markdown format...'
            }
            className="w-full px-3 py-2 bg-surface-1 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 resize-y font-mono text-[13px]"
          />

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isMaster}
              onChange={e => setIsMaster(e.target.checked)}
              className="rounded border-[rgba(255,255,255,0.2)] bg-surface-2 text-accent"
            />
            <span className="text-body text-text-secondary">Set as master resume (base for all tailored versions)</span>
          </label>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              icon={parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              loading={parsing}
              disabled={!pasteContent.trim()}
              onClick={handleCreate}
            >
              {createMode === 'paste' ? 'Parse & Create' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
