import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Database, Key, Building2, FileText, User, Mail,
  CheckCircle, XCircle, AlertCircle, ArrowRight, Loader2,
  Sparkles, Zap,
} from 'lucide-react'
import clsx from 'clsx'
import { apiFetch } from '../api/client'
import Button from './ui/Button'

interface Check {
  status: 'ok' | 'error' | 'missing' | 'optional'
  message: string
  type?: string
  provider?: string
  count?: number
}

interface SetupData {
  ready: boolean
  checks: Record<string, Check>
}

const STEPS = [
  { key: 'database', icon: Database, label: 'Database', route: null },
  { key: 'llm', icon: Key, label: 'AI Provider', route: '/settings' },
  { key: 'resume', icon: FileText, label: 'Resume', route: '/resume' },
  { key: 'companies', icon: Building2, label: 'Companies', route: '/settings' },
  { key: 'profile', icon: User, label: 'Profile', route: '/settings' },
  { key: 'gmail', icon: Mail, label: 'Gmail', route: '/settings' },
]

export default function SetupWizard() {
  const [data, setData] = useState<SetupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchSetup = async () => {
      try {
        const result = await apiFetch<SetupData>('/health/setup')
        setData(result)
      } catch {
        // Backend not connected
        setData({
          ready: false,
          checks: {
            database: { status: 'error', message: 'Cannot connect to backend. Is it running on port 8002?' },
          },
        })
      }
      setLoading(false)
    }
    fetchSetup()
  }, [])

  if (loading) {
    return (
      <div className="bg-surface-2 rounded-xl border border-[rgba(255,255,255,0.06)] p-8 text-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin mx-auto mb-3" />
        <p className="text-body text-text-tertiary">Checking setup...</p>
      </div>
    )
  }

  if (!data || dismissed) return null
  if (data.ready) return null // Everything is configured, don't show wizard

  const completedCount = STEPS.filter(s => data.checks[s.key]?.status === 'ok').length
  const requiredIncomplete = ['database', 'llm'].filter(k => data.checks[k]?.status !== 'ok')

  const statusIcon = (check: Check | undefined) => {
    if (!check) return <AlertCircle className="w-4 h-4 text-text-tertiary" />
    if (check.status === 'ok') return <CheckCircle className="w-4 h-4 text-gain" />
    if (check.status === 'error') return <XCircle className="w-4 h-4 text-loss" />
    if (check.status === 'optional') return <CheckCircle className="w-4 h-4 text-text-tertiary/50" />
    return <AlertCircle className="w-4 h-4 text-warning" />
  }

  return (
    <div className="bg-surface-2 rounded-xl border border-accent/20 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-accent/10 to-transparent px-6 py-5 border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-heading text-text-primary">Welcome to Nexus</h2>
              <p className="text-caption text-text-tertiary mt-0.5">
                {completedCount}/{STEPS.length} steps complete — let's get you set up
              </p>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-caption text-text-tertiary hover:text-text-secondary"
          >
            Dismiss
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1.5 bg-surface-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {STEPS.map(step => {
            const check = data.checks[step.key]
            const isOk = check?.status === 'ok'
            const isOptional = check?.status === 'optional'
            const isRequired = ['database', 'llm'].includes(step.key)

            return (
              <button
                key={step.key}
                onClick={() => step.route && navigate(step.route)}
                disabled={!step.route || isOk}
                className={clsx(
                  'flex items-start gap-3 p-3 rounded-lg border text-left transition-all',
                  isOk
                    ? 'bg-gain/5 border-gain/20'
                    : isOptional
                    ? 'bg-surface-3 border-[rgba(255,255,255,0.04)]'
                    : 'bg-surface-3 border-[rgba(255,255,255,0.06)] hover:border-accent/30 hover:bg-accent/5',
                  (!step.route || isOk) && 'cursor-default',
                )}
              >
                {statusIcon(check)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={clsx(
                      'text-body font-medium',
                      isOk ? 'text-gain' : 'text-text-primary',
                    )}>
                      {step.label}
                    </span>
                    {isRequired && !isOk && (
                      <span className="text-[9px] px-1 py-0 bg-loss/10 text-loss rounded">Required</span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-tertiary mt-0.5 truncate">
                    {check?.message || 'Not checked'}
                  </p>
                </div>
                {step.route && !isOk && !isOptional && (
                  <ArrowRight className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0 mt-0.5" />
                )}
              </button>
            )
          })}
        </div>

        {requiredIncomplete.length > 0 && (
          <div className="mt-4 p-3 bg-warning/5 rounded-lg border border-warning/20">
            <p className="text-caption text-warning">
              <Zap className="w-3 h-3 inline mr-1" />
              Complete the required steps (Database + AI Provider) to start using Nexus.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
