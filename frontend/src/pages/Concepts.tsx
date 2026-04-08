import { useEffect, useState } from 'react'
import {
  GraduationCap, Plus, Sparkles, ChevronDown, ChevronUp,
  Star, RotateCcw, Loader2, Trash2,
} from 'lucide-react'
import clsx from 'clsx'
import { apiFetch } from '../api/client'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { SearchInput } from '../components/ui/Input'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import Dropdown from '../components/ui/Dropdown'
import { toast } from '../components/ui/Toast'

interface Concept {
  id: string
  topic: string
  concept: string
  explanation: string | null
  examples: string | null
  confidence: number
  last_reviewed_at: string | null
  review_count: number
  created_at: string
}

interface TopicSummary {
  topic: string
  count: number
  avg_confidence: number
}

const CONFIDENCE_COLORS = ['text-loss', 'text-loss', 'text-warning', 'text-warning', 'text-gain', 'text-gain']

export default function Concepts() {
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [topics, setTopics] = useState<TopicSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedTopic, setSelectedTopic] = useState<string>('')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showGenerate, setShowGenerate] = useState(false)
  const [generateTopic, setGenerateTopic] = useState('')
  const [showAddManual, setShowAddManual] = useState(false)
  const [newConcept, setNewConcept] = useState({ topic: '', concept: '', explanation: '' })

  const fetchConcepts = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedTopic) params.set('topic', selectedTopic)
      const data = await apiFetch<Concept[]>(`/concepts?${params}`)
      setConcepts(data)
    } catch { /* */ }
    setLoading(false)
  }

  const fetchTopics = async () => {
    try {
      const data = await apiFetch<TopicSummary[]>('/concepts/topics')
      setTopics(data)
    } catch { /* */ }
  }

  useEffect(() => { fetchTopics() }, [])
  useEffect(() => { fetchConcepts() }, [selectedTopic])

  const handleGenerate = async () => {
    if (!generateTopic.trim()) return
    setGenerating(true)
    setShowGenerate(false)
    try {
      await apiFetch('/concepts/generate', {
        method: 'POST',
        body: JSON.stringify({ topic: generateTopic }),
      })
      toast(`Concepts generated for "${generateTopic}"`)
      setGenerateTopic('')
      await fetchConcepts()
      await fetchTopics()
    } catch (e: any) {
      toast(e.message || 'Failed to generate concepts')
    }
    setGenerating(false)
  }

  const handleConfidence = async (id: string, confidence: number) => {
    try {
      await apiFetch(`/concepts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ confidence }),
      })
      setConcepts((prev) => prev.map((c) => (c.id === id ? { ...c, confidence } : c)))
    } catch { /* */ }
  }

  const handleReview = async (id: string) => {
    try {
      await apiFetch(`/concepts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ mark_reviewed: true }),
      })
      setConcepts((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, review_count: c.review_count + 1, last_reviewed_at: new Date().toISOString() } : c,
        ),
      )
      toast('Marked as reviewed')
      await fetchTopics()
    } catch { /* */ }
  }

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/concepts/${id}`, { method: 'DELETE' })
      setConcepts((prev) => prev.filter((c) => c.id !== id))
      toast('Concept deleted')
      await fetchTopics()
    } catch { /* */ }
  }

  const handleAddManual = async () => {
    if (!newConcept.topic.trim() || !newConcept.concept.trim()) return
    try {
      await apiFetch('/concepts', {
        method: 'POST',
        body: JSON.stringify(newConcept),
      })
      toast('Concept added')
      setShowAddManual(false)
      setNewConcept({ topic: '', concept: '', explanation: '' })
      await fetchConcepts()
      await fetchTopics()
    } catch (e: any) {
      toast(e.message || 'Failed to add concept')
    }
  }

  const filtered = concepts.filter(
    (c) => !search || c.concept.toLowerCase().includes(search.toLowerCase()) || c.topic.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-display text-text-primary">Concepts</h1>
          <p className="text-body text-text-secondary mt-1">Study and review key technical concepts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddManual(true)}>
            Add
          </Button>
          <Button variant="accent" icon={<Sparkles className="w-4 h-4" />} loading={generating} onClick={() => setShowGenerate(true)}>
            Generate
          </Button>
        </div>
      </div>

      {/* Topic Grid */}
      {topics.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 stagger">
          <button
            onClick={() => setSelectedTopic('')}
            className={clsx(
              'bg-surface-2 rounded-lg p-4 border text-left transition-all',
              !selectedTopic
                ? 'border-accent/30 ring-1 ring-accent/10'
                : 'border-[rgba(255,255,255,0.06)] card-hover',
            )}
          >
            <p className="text-heading text-text-primary">All Topics</p>
            <p className="text-caption text-text-tertiary mt-1">{concepts.length} concepts</p>
          </button>
          {topics.map((t) => {
            const pct = Math.round((t.avg_confidence / 5) * 100)
            return (
              <button
                key={t.topic}
                onClick={() => setSelectedTopic(t.topic)}
                className={clsx(
                  'bg-surface-2 rounded-lg p-4 border text-left transition-all',
                  selectedTopic === t.topic
                    ? 'border-accent/30 ring-1 ring-accent/10'
                    : 'border-[rgba(255,255,255,0.06)] card-hover',
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-heading text-text-primary truncate">{t.topic}</p>
                  <span className={clsx('text-caption font-tabular', pct >= 60 ? 'text-gain' : pct >= 30 ? 'text-warning' : 'text-loss')}>
                    {pct}%
                  </span>
                </div>
                <p className="text-caption text-text-tertiary">{t.count} concepts</p>
                <div className="mt-2 h-1.5 bg-surface-4 rounded-full overflow-hidden">
                  <div
                    className={clsx('h-full rounded-full transition-all', pct >= 60 ? 'bg-gain' : pct >= 30 ? 'bg-warning' : 'bg-loss')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} className="w-60" />
      </div>

      {/* Concept List */}
      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-20 rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="w-10 h-10" />}
          title="No concepts yet"
          description="Generate concept breakdowns for a topic or add them manually."
          action={{ label: 'Generate Concepts', onClick: () => setShowGenerate(true) }}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <div
              key={c.id}
              className={clsx(
                'bg-surface-2 rounded-lg border border-[rgba(255,255,255,0.06)] transition-all',
                expandedId === c.id ? 'ring-1 ring-accent/20' : 'card-hover',
              )}
            >
              <button
                onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                <div className={clsx(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  c.confidence >= 4 ? 'bg-gain' : c.confidence >= 2 ? 'bg-warning' : 'bg-loss',
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-body text-text-primary">{c.concept}</p>
                  <span className="text-caption text-text-tertiary">{c.topic}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={clsx('w-3 h-3', n <= c.confidence ? CONFIDENCE_COLORS[c.confidence] : 'text-text-tertiary/30')}
                      fill={n <= c.confidence ? 'currentColor' : 'none'}
                    />
                  ))}
                  {c.review_count > 0 && (
                    <span className="text-caption text-text-tertiary ml-2">{c.review_count}x</span>
                  )}
                  {expandedId === c.id ? <ChevronUp className="w-4 h-4 text-text-tertiary ml-1" /> : <ChevronDown className="w-4 h-4 text-text-tertiary ml-1" />}
                </div>
              </button>

              {expandedId === c.id && (
                <div className="px-4 pb-4 pt-0 border-t border-[rgba(255,255,255,0.04)] space-y-3">
                  {c.explanation && (
                    <div className="bg-surface-3 rounded-lg p-3 mt-3">
                      <p className="text-caption text-text-tertiary mb-1">Explanation</p>
                      <p className="text-body text-text-secondary whitespace-pre-wrap">{c.explanation}</p>
                    </div>
                  )}
                  {c.examples && (
                    <div className="bg-surface-3 rounded-lg p-3">
                      <p className="text-caption text-text-tertiary mb-1">Examples</p>
                      <pre className="text-body text-text-secondary whitespace-pre-wrap font-mono text-[13px]">{c.examples}</pre>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="text-label text-text-secondary">Confidence:</span>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => handleConfidence(c.id, n)} className="p-0.5">
                        <Star
                          className={clsx('w-5 h-5', n <= c.confidence ? CONFIDENCE_COLORS[c.confidence] : 'text-text-tertiary/30')}
                          fill={n <= c.confidence ? 'currentColor' : 'none'}
                        />
                      </button>
                    ))}
                    <div className="ml-auto flex gap-2">
                      <Button variant="ghost" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => handleDelete(c.id)} />
                      <Button variant="accent" size="sm" icon={<RotateCcw className="w-3.5 h-3.5" />} onClick={() => handleReview(c.id)}>
                        Review
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
      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Concept Breakdown" size="sm">
        <p className="text-body text-text-secondary mb-4">
          Enter a topic and AI will generate key concepts with explanations.
        </p>
        <div className="space-y-3">
          <input
            type="text"
            value={generateTopic}
            onChange={(e) => setGenerateTopic(e.target.value)}
            placeholder="e.g., System Design, Binary Trees, React Hooks..."
            className="w-full bg-surface-1 text-body text-text-primary rounded-md border border-[rgba(255,255,255,0.06)] px-3 py-2 focus:outline-none focus:border-accent/50"
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          />
          <Button variant="primary" onClick={handleGenerate} loading={generating} className="w-full">
            Generate
          </Button>
        </div>
      </Modal>

      {/* Add Manual Modal */}
      <Modal open={showAddManual} onClose={() => setShowAddManual(false)} title="Add Concept" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-label text-text-secondary mb-1">Topic</label>
            <input
              type="text"
              value={newConcept.topic}
              onChange={(e) => setNewConcept({ ...newConcept, topic: e.target.value })}
              placeholder="e.g., System Design"
              className="w-full bg-surface-1 text-body text-text-primary rounded-md border border-[rgba(255,255,255,0.06)] px-3 py-2 focus:outline-none focus:border-accent/50"
            />
          </div>
          <div>
            <label className="block text-label text-text-secondary mb-1">Concept</label>
            <input
              type="text"
              value={newConcept.concept}
              onChange={(e) => setNewConcept({ ...newConcept, concept: e.target.value })}
              placeholder="e.g., Load Balancing"
              className="w-full bg-surface-1 text-body text-text-primary rounded-md border border-[rgba(255,255,255,0.06)] px-3 py-2 focus:outline-none focus:border-accent/50"
            />
          </div>
          <div>
            <label className="block text-label text-text-secondary mb-1">Explanation (optional)</label>
            <textarea
              value={newConcept.explanation}
              onChange={(e) => setNewConcept({ ...newConcept, explanation: e.target.value })}
              placeholder="Your understanding..."
              className="w-full bg-surface-1 text-body text-text-primary rounded-md border border-[rgba(255,255,255,0.06)] px-3 py-2 min-h-[80px] focus:outline-none focus:border-accent/50"
            />
          </div>
          <Button variant="primary" onClick={handleAddManual} className="w-full">Add Concept</Button>
        </div>
      </Modal>
    </div>
  )
}
