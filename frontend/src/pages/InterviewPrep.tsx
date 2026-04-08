import { useEffect, useState } from 'react'
import {
  BookOpen, Plus, Brain, Target, Shuffle, ChevronDown, ChevronUp,
  Star, Clock, Loader2, Trash2, Sparkles,
} from 'lucide-react'
import clsx from 'clsx'
import { apiFetch } from '../api/client'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Tabs from '../components/ui/Tabs'
import { SearchInput } from '../components/ui/Input'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import Dropdown from '../components/ui/Dropdown'
import { toast } from '../components/ui/Toast'

interface Question {
  id: string
  job_id: string | null
  category: string
  question: string
  suggested_answer: string | null
  user_notes: string | null
  difficulty: string
  confidence: number
  times_practiced: number
  last_practiced_at: string | null
  created_at: string
}

interface Stats {
  total: number
  practiced: number
  avg_confidence: number
  by_category: Record<string, { total: number; avg_confidence: number }>
}

interface Job {
  id: string
  title: string
  company_name: string | null
}

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'behavioral', label: 'Behavioral' },
  { id: 'technical', label: 'Technical' },
  { id: 'system_design', label: 'System Design' },
  { id: 'company_specific', label: 'Company' },
]

const CONFIDENCE_COLORS = ['text-loss', 'text-loss', 'text-warning', 'text-warning', 'text-gain', 'text-gain']

export default function InterviewPrep() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [practiceMode, setPracticeMode] = useState(false)
  const [practiceIndex, setPracticeIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [showGenerate, setShowGenerate] = useState(false)
  const [showAddManual, setShowAddManual] = useState(false)
  const [newQuestion, setNewQuestion] = useState({ question: '', category: 'behavioral', difficulty: 'medium' })

  const fetchQuestions = async () => {
    try {
      const params = new URLSearchParams()
      if (category !== 'all') params.set('category', category)
      if (selectedJobId) params.set('job_id', selectedJobId)
      const data = await apiFetch<Question[]>(`/interview-prep/questions?${params}`)
      setQuestions(data)
    } catch { /* */ }
    setLoading(false)
  }

  const fetchStats = async () => {
    try {
      const data = await apiFetch<Stats>('/interview-prep/stats')
      setStats(data)
    } catch { /* */ }
  }

  const fetchJobs = async () => {
    try {
      const data = await apiFetch<Job[]>('/jobs?status=interested&limit=50')
      setJobs(data)
    } catch { /* */ }
  }

  useEffect(() => { fetchJobs() }, [])
  useEffect(() => { fetchQuestions(); fetchStats() }, [category, selectedJobId])

  const handleGenerate = async (jobId: string) => {
    setGenerating(true)
    setShowGenerate(false)
    try {
      await apiFetch(`/interview-prep/generate/${jobId}`, { method: 'POST' })
      toast('Questions generated successfully')
      await fetchQuestions()
      await fetchStats()
    } catch (e: any) {
      toast(e.message || 'Failed to generate questions')
    }
    setGenerating(false)
  }

  const handleConfidence = async (id: string, confidence: number) => {
    try {
      await apiFetch(`/interview-prep/questions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ confidence }),
      })
      setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, confidence } : q)))
    } catch { /* */ }
  }

  const handlePractice = async (id: string) => {
    try {
      await apiFetch(`/interview-prep/questions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ mark_practiced: true }),
      })
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === id ? { ...q, times_practiced: q.times_practiced + 1, last_practiced_at: new Date().toISOString() } : q,
        ),
      )
      toast('Marked as practiced')
      await fetchStats()
    } catch { /* */ }
  }

  const handleSaveNotes = async (id: string, notes: string) => {
    try {
      await apiFetch(`/interview-prep/questions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ user_notes: notes }),
      })
      setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, user_notes: notes } : q)))
    } catch { /* */ }
  }

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/interview-prep/questions/${id}`, { method: 'DELETE' })
      setQuestions((prev) => prev.filter((q) => q.id !== id))
      toast('Question deleted')
      await fetchStats()
    } catch { /* */ }
  }

  const handleAddManual = async () => {
    if (!newQuestion.question.trim()) return
    try {
      await apiFetch('/interview-prep/questions', {
        method: 'POST',
        body: JSON.stringify({
          ...newQuestion,
          job_id: selectedJobId || null,
        }),
      })
      toast('Question added')
      setShowAddManual(false)
      setNewQuestion({ question: '', category: 'behavioral', difficulty: 'medium' })
      await fetchQuestions()
      await fetchStats()
    } catch (e: any) {
      toast(e.message || 'Failed to add question')
    }
  }

  const filtered = questions.filter((q) =>
    !search || q.question.toLowerCase().includes(search.toLowerCase()),
  )

  const readinessScore = stats ? Math.round((stats.avg_confidence / 5) * 100) : 0

  // Practice mode
  if (practiceMode && filtered.length > 0) {
    const shuffled = [...filtered].sort(() => Math.random() - 0.5)
    const current = shuffled[practiceIndex % shuffled.length]
    return (
      <div className="p-6 max-w-3xl mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-display text-text-primary">Practice Mode</h1>
          <Button variant="ghost" onClick={() => setPracticeMode(false)}>Exit Practice</Button>
        </div>
        <div className="bg-surface-2 rounded-xl p-8 border border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-2 mb-4">
            <Badge variant={current.category}>{current.category.replace('_', ' ')}</Badge>
            <Badge variant={current.difficulty}>{current.difficulty}</Badge>
            <span className="text-caption text-text-tertiary ml-auto">
              {(practiceIndex % shuffled.length) + 1} / {shuffled.length}
            </span>
          </div>
          <p className="text-title text-text-primary mb-6">{current.question}</p>
          {showAnswer ? (
            <div className="space-y-4">
              {current.suggested_answer && (
                <div className="bg-surface-3 rounded-lg p-4">
                  <p className="text-caption text-text-tertiary mb-1">Suggested Answer</p>
                  <p className="text-body text-text-secondary whitespace-pre-wrap">{current.suggested_answer}</p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-label text-text-secondary">Rate confidence:</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => handleConfidence(current.id, n)}
                    className="p-1"
                  >
                    <Star
                      className={clsx('w-5 h-5', n <= current.confidence ? CONFIDENCE_COLORS[current.confidence] : 'text-text-tertiary')}
                      fill={n <= current.confidence ? 'currentColor' : 'none'}
                    />
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="accent"
                  onClick={() => { handlePractice(current.id); setShowAnswer(false); setPracticeIndex((i) => i + 1) }}
                >
                  Next Question
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setShowAnswer(true)}>Reveal Answer</Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-display text-text-primary">Interview Prep</h1>
          <p className="text-body text-text-secondary mt-1">Practice questions and track your readiness</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" icon={<Shuffle className="w-4 h-4" />} onClick={() => { setPracticeMode(true); setPracticeIndex(0); setShowAnswer(false) }} disabled={filtered.length === 0}>
            Practice
          </Button>
          <Button variant="ghost" icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddManual(true)}>
            Add
          </Button>
          <Button variant="accent" icon={<Sparkles className="w-4 h-4" />} loading={generating} onClick={() => setShowGenerate(true)}>
            Generate
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 stagger">
          <div className="bg-surface-2 rounded-lg p-4 border border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-accent" />
              <span className="text-caption text-text-tertiary">Readiness</span>
            </div>
            <p className={clsx('text-title font-tabular', readinessScore >= 60 ? 'text-gain' : readinessScore >= 30 ? 'text-warning' : 'text-loss')}>
              {readinessScore}%
            </p>
          </div>
          <div className="bg-surface-2 rounded-lg p-4 border border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-info" />
              <span className="text-caption text-text-tertiary">Total</span>
            </div>
            <p className="text-title text-text-primary font-tabular">{stats.total}</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-4 border border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-2 mb-1">
              <Brain className="w-4 h-4 text-gain" />
              <span className="text-caption text-text-tertiary">Practiced</span>
            </div>
            <p className="text-title text-text-primary font-tabular">{stats.practiced}</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-4 border border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4 text-warning" />
              <span className="text-caption text-text-tertiary">Avg Confidence</span>
            </div>
            <p className="text-title text-text-primary font-tabular">{stats.avg_confidence.toFixed(1)}/5</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Tabs tabs={CATEGORIES} active={category} onChange={setCategory} />
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} className="w-60" />
        <Dropdown
          options={[{ value: '', label: 'All Jobs' }, ...jobs.map((j) => ({ value: j.id, label: `${j.title} @ ${j.company_name || '?'}` }))]}
          value={selectedJobId}
          onChange={setSelectedJobId}
          placeholder="Filter by job..."
          className="w-60"
          size="sm"
        />
      </div>

      {/* Questions */}
      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-20 rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-10 h-10" />}
          title="No questions yet"
          description="Generate interview questions for a specific job or add them manually."
          action={{ label: 'Generate Questions', onClick: () => setShowGenerate(true) }}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((q) => (
            <div
              key={q.id}
              className={clsx(
                'bg-surface-2 rounded-lg border border-[rgba(255,255,255,0.06)] transition-all',
                expandedId === q.id ? 'ring-1 ring-accent/20' : 'card-hover',
              )}
            >
              <button
                onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                className="w-full flex items-start gap-3 p-4 text-left"
              >
                <div className={clsx(
                  'w-2 h-2 rounded-full mt-2 flex-shrink-0',
                  q.confidence >= 4 ? 'bg-gain' : q.confidence >= 2 ? 'bg-warning' : 'bg-loss',
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-body text-text-primary">{q.question}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant={q.category}>{q.category.replace('_', ' ')}</Badge>
                    <Badge variant={q.difficulty}>{q.difficulty}</Badge>
                    {q.times_practiced > 0 && (
                      <span className="text-caption text-text-tertiary flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {q.times_practiced}x
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={clsx('w-3.5 h-3.5', n <= q.confidence ? CONFIDENCE_COLORS[q.confidence] : 'text-text-tertiary/30')}
                      fill={n <= q.confidence ? 'currentColor' : 'none'}
                    />
                  ))}
                  {expandedId === q.id ? <ChevronUp className="w-4 h-4 text-text-tertiary ml-2" /> : <ChevronDown className="w-4 h-4 text-text-tertiary ml-2" />}
                </div>
              </button>

              {expandedId === q.id && (
                <div className="px-4 pb-4 pt-0 border-t border-[rgba(255,255,255,0.04)] mt-0 space-y-4">
                  {q.suggested_answer && (
                    <div className="bg-surface-3 rounded-lg p-3 mt-3">
                      <p className="text-caption text-text-tertiary mb-1">AI Suggested Answer</p>
                      <p className="text-body text-text-secondary whitespace-pre-wrap">{q.suggested_answer}</p>
                    </div>
                  )}
                  <div className="mt-3">
                    <p className="text-caption text-text-tertiary mb-1">Your Notes</p>
                    <textarea
                      className="w-full bg-surface-1 text-body text-text-primary rounded-md border border-[rgba(255,255,255,0.06)] px-3 py-2 min-h-[80px] focus:outline-none focus:border-accent/50"
                      placeholder="Write your practice answer or notes..."
                      defaultValue={q.user_notes || ''}
                      onBlur={(e) => handleSaveNotes(q.id, e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-label text-text-secondary">Confidence:</span>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => handleConfidence(q.id, n)} className="p-0.5">
                        <Star
                          className={clsx('w-5 h-5', n <= q.confidence ? CONFIDENCE_COLORS[q.confidence] : 'text-text-tertiary/30')}
                          fill={n <= q.confidence ? 'currentColor' : 'none'}
                        />
                      </button>
                    ))}
                    <div className="ml-auto flex gap-2">
                      <Button variant="ghost" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => handleDelete(q.id)}>
                        Delete
                      </Button>
                      <Button variant="accent" size="sm" onClick={() => handlePractice(q.id)}>
                        Mark Practiced
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Generate Modal */}
      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Interview Questions" size="sm">
        <p className="text-body text-text-secondary mb-4">
          Select a job to generate tailored interview questions using AI.
        </p>
        <div className="space-y-3">
          {jobs.length === 0 ? (
            <p className="text-body text-text-tertiary">No jobs marked as "interested" yet. Update job statuses first.</p>
          ) : (
            jobs.map((job) => (
              <button
                key={job.id}
                onClick={() => handleGenerate(job.id)}
                disabled={generating}
                className="w-full flex items-center gap-3 p-3 bg-surface-3 rounded-lg border border-[rgba(255,255,255,0.06)] hover:bg-surface-4 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent text-label">
                  {(job.company_name || '?')[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body text-text-primary truncate">{job.title}</p>
                  <p className="text-caption text-text-tertiary">{job.company_name}</p>
                </div>
                {generating ? <Loader2 className="w-4 h-4 animate-spin text-text-tertiary" /> : <Sparkles className="w-4 h-4 text-accent" />}
              </button>
            ))
          )}
        </div>
      </Modal>

      {/* Add Manual Modal */}
      <Modal open={showAddManual} onClose={() => setShowAddManual(false)} title="Add Question" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-label text-text-secondary mb-1">Question</label>
            <textarea
              className="w-full bg-surface-1 text-body text-text-primary rounded-md border border-[rgba(255,255,255,0.06)] px-3 py-2 min-h-[80px] focus:outline-none focus:border-accent/50"
              placeholder="Enter the interview question..."
              value={newQuestion.question}
              onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
            />
          </div>
          <div className="flex gap-3">
            <Dropdown
              options={CATEGORIES.filter((c) => c.id !== 'all').map((c) => ({ value: c.id, label: c.label }))}
              value={newQuestion.category}
              onChange={(v) => setNewQuestion({ ...newQuestion, category: v })}
              className="flex-1"
              size="sm"
            />
            <Dropdown
              options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]}
              value={newQuestion.difficulty}
              onChange={(v) => setNewQuestion({ ...newQuestion, difficulty: v })}
              className="flex-1"
              size="sm"
            />
          </div>
          <Button variant="primary" onClick={handleAddManual} className="w-full">Add Question</Button>
        </div>
      </Modal>
    </div>
  )
}
