import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Briefcase, Users, Mail, MessageSquare, Zap, RefreshCw,
  BookOpen, StickyNote, ArrowRight, TrendingUp, Clock, FileText, Send,
} from 'lucide-react'
import clsx from 'clsx'
import { apiFetch } from '../api/client'
import Button from '../components/ui/Button'
import SetupWizard from '../components/SetupWizard'

interface Metrics {
  total_companies: number
  total_jobs: number
  jobs_by_status: Record<string, number>
  total_contacts: number
  contacts_with_email: number
  total_emails: number
  emails_by_status: Record<string, number>
  reply_count: number
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

interface AppStats {
  total: number
  by_status: Record<string, number>
  avg_match_score: number | null
  applied_this_week: number
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [appStats, setAppStats] = useState<AppStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)
  const navigate = useNavigate()

  const fetchMetrics = async () => {
    try {
      const [pipeline, apps] = await Promise.all([
        apiFetch<Metrics>('/pipeline/metrics'),
        apiFetch<AppStats>('/applications/stats').catch(() => null),
      ])
      setMetrics(pipeline)
      setAppStats(apps)
    } catch {
      // Backend not connected
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMetrics() }, [])

  const handleScrape = async () => {
    setScraping(true)
    try {
      await apiFetch('/jobs/scrape', { method: 'POST' })
      await fetchMetrics()
    } catch { /* */ }
    setScraping(false)
  }

  const statCards = metrics ? [
    { label: 'Companies', value: metrics.total_companies, icon: Zap, color: 'text-accent', bg: 'bg-accent/8' },
    { label: 'Jobs Found', value: metrics.total_jobs, icon: Briefcase, color: 'text-info', bg: 'bg-info/8' },
    { label: 'Apps Prepared', value: appStats?.total || 0, icon: FileText, color: 'text-warning', bg: 'bg-warning/8' },
    { label: 'Applied', value: appStats?.by_status?.applied || 0, icon: Send, color: 'text-gain', bg: 'bg-gain/8' },
    { label: 'Avg Match', value: appStats?.avg_match_score ? `${appStats.avg_match_score}%` : '—', icon: TrendingUp, color: 'text-accent', bg: 'bg-accent/8' },
  ] : []

  const funnelSteps = metrics ? [
    { label: 'Scraped', count: metrics.total_jobs, color: 'rgba(59, 130, 246, 0.6)' },
    { label: 'Saved', count: metrics.jobs_by_status?.saved || 0, color: 'rgba(6, 182, 212, 0.6)' },
    { label: 'Prepared', count: appStats?.total || 0, color: 'rgba(245, 158, 11, 0.6)' },
    { label: 'Approved', count: appStats?.by_status?.approved || 0, color: 'rgba(0, 211, 149, 0.5)' },
    { label: 'Applied', count: appStats?.by_status?.applied || 0, color: 'rgba(0, 211, 149, 0.8)' },
    { label: 'This Week', count: appStats?.applied_this_week || 0, color: 'rgba(6, 182, 212, 0.9)' },
  ] : []

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  // Focus items
  const newJobs = metrics?.jobs_by_status?.new || 0
  const pendingDrafts = metrics?.emails_by_status?.draft || 0
  const readyApps = appStats?.by_status?.ready || 0
  const approvedApps = appStats?.by_status?.approved || 0
  const savedJobs = metrics?.jobs_by_status?.saved || 0

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-display text-text-primary">{getGreeting()}</h1>
          <p className="text-body text-text-secondary mt-1">{today}</p>
        </div>
        <Button
          variant="accent"
          icon={<RefreshCw className={clsx('w-4 h-4', scraping && 'animate-spin')} />}
          loading={scraping}
          onClick={handleScrape}
        >
          {scraping ? 'Scraping...' : 'Scrape Now'}
        </Button>
      </div>

      {/* Setup Wizard — shows until all infra is configured */}
      <div className="mb-6">
        <SetupWizard />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-24 rounded-lg" />)}
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8 stagger">
            {statCards.map((card) => (
              <div key={card.label} className="bg-surface-2 rounded-lg p-4 border border-[rgba(255,255,255,0.06)] card-hover">
                <div className="flex items-center gap-2 mb-2">
                  <div className={clsx('w-7 h-7 rounded-md flex items-center justify-center', card.bg)}>
                    <card.icon className={clsx('w-3.5 h-3.5', card.color)} />
                  </div>
                  <span className="text-caption text-text-tertiary">{card.label}</span>
                </div>
                <p className="text-title font-tabular text-text-primary">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Left: Funnel + Pipeline */}
            <div className="lg:col-span-2 space-y-6">
              {/* Pipeline Funnel */}
              <div className="bg-surface-2 rounded-xl p-6 border border-[rgba(255,255,255,0.06)]">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-heading text-text-primary flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-accent" />
                    Pipeline Funnel
                  </h2>
                </div>
                <div className="flex items-end gap-3 h-44">
                  {funnelSteps.map((step, i) => {
                    const maxCount = Math.max(...funnelSteps.map((s) => s.count), 1)
                    const height = Math.max((step.count / maxCount) * 100, 6)
                    return (
                      <div key={step.label} className="flex-1 flex flex-col items-center gap-2 group">
                        <span className="text-label font-tabular text-text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                          {step.count}
                        </span>
                        <div className="w-full relative">
                          <div
                            className="w-full rounded-lg transition-all duration-700 ease-out hover:brightness-125"
                            style={{
                              height: `${height * 1.4}px`,
                              minHeight: '8px',
                              backgroundColor: step.color,
                              animationDelay: `${i * 80}ms`,
                            }}
                          />
                        </div>
                        <div className="text-center">
                          <span className="text-label font-tabular text-text-primary block">{step.count}</span>
                          <span className="text-caption text-text-tertiary">{step.label}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { icon: Briefcase, label: 'Browse Jobs', desc: 'Review scraped positions', path: '/jobs', color: 'text-info', bg: 'bg-info/8' },
                  { icon: FileText, label: 'Resume', desc: 'Edit & tailor your resume', path: '/resume', color: 'text-accent', bg: 'bg-accent/8' },
                  { icon: Send, label: 'Applications', desc: 'Prepare & track applications', path: '/applications', color: 'text-gain', bg: 'bg-gain/8' },
                ].map((action) => (
                  <button
                    key={action.label}
                    onClick={() => navigate(action.path)}
                    className="bg-surface-2 rounded-lg p-4 border border-[rgba(255,255,255,0.06)] card-hover text-left group"
                  >
                    <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center mb-3', action.bg)}>
                      <action.icon className={clsx('w-4 h-4', action.color)} />
                    </div>
                    <p className="text-heading text-text-primary flex items-center gap-1">
                      {action.label}
                      <ArrowRight className="w-3.5 h-3.5 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
                    </p>
                    <p className="text-caption text-text-tertiary mt-1">{action.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Focus + Prep */}
            <div className="space-y-6">
              {/* Today's Focus */}
              <div className="bg-surface-2 rounded-xl p-5 border border-[rgba(255,255,255,0.06)]">
                <h3 className="text-heading text-text-primary flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-accent" />
                  Today's Focus
                </h3>
                <div className="space-y-3">
                  {newJobs > 0 && (
                    <button
                      onClick={() => navigate('/jobs')}
                      className="w-full flex items-center gap-3 p-3 bg-surface-3 rounded-lg hover:bg-surface-4 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center">
                        <Briefcase className="w-4 h-4 text-info" />
                      </div>
                      <div className="flex-1">
                        <p className="text-body text-text-primary">{newJobs} new jobs</p>
                        <p className="text-caption text-text-tertiary">Review and categorize</p>
                      </div>
                    </button>
                  )}
                  {readyApps > 0 && (
                    <button
                      onClick={() => navigate('/applications')}
                      className="w-full flex items-center gap-3 p-3 bg-surface-3 rounded-lg hover:bg-surface-4 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-warning" />
                      </div>
                      <div className="flex-1">
                        <p className="text-body text-text-primary">{readyApps} apps ready for review</p>
                        <p className="text-caption text-text-tertiary">Review and approve</p>
                      </div>
                    </button>
                  )}
                  {approvedApps > 0 && (
                    <button
                      onClick={() => navigate('/applications')}
                      className="w-full flex items-center gap-3 p-3 bg-surface-3 rounded-lg hover:bg-surface-4 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gain/10 flex items-center justify-center">
                        <Send className="w-4 h-4 text-gain" />
                      </div>
                      <div className="flex-1">
                        <p className="text-body text-text-primary">{approvedApps} approved — ready to apply</p>
                        <p className="text-caption text-text-tertiary">Go apply now!</p>
                      </div>
                    </button>
                  )}
                  {savedJobs > 0 && !readyApps && (
                    <button
                      onClick={() => navigate('/jobs')}
                      className="w-full flex items-center gap-3 p-3 bg-surface-3 rounded-lg hover:bg-surface-4 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Briefcase className="w-4 h-4 text-accent" />
                      </div>
                      <div className="flex-1">
                        <p className="text-body text-text-primary">{savedJobs} saved jobs</p>
                        <p className="text-caption text-text-tertiary">Prepare applications</p>
                      </div>
                    </button>
                  )}
                  {newJobs === 0 && readyApps === 0 && approvedApps === 0 && savedJobs === 0 && (
                    <p className="text-body text-text-tertiary text-center py-4">All caught up!</p>
                  )}
                </div>
              </div>

              {/* Prep Shortcuts */}
              <div className="bg-surface-2 rounded-xl p-5 border border-[rgba(255,255,255,0.06)]">
                <h3 className="text-heading text-text-primary mb-4">Prep Center</h3>
                <div className="space-y-2">
                  {[
                    { icon: BookOpen, label: 'Interview Prep', path: '/interview-prep', color: 'text-accent' },
                    { icon: StickyNote, label: 'Notes', path: '/notes', color: 'text-warning' },
                    { icon: Zap, label: 'Concepts', path: '/concepts', color: 'text-info' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => navigate(item.path)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors text-left group"
                    >
                      <item.icon className={clsx('w-4 h-4', item.color)} />
                      <span className="text-body text-text-secondary group-hover:text-text-primary transition-colors flex-1">{item.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
