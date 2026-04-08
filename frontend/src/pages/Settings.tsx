import { useEffect, useState } from 'react'
import {
  Key, Bot, Mail, Building2, Target, FileText, Save, Trash2, Plus,
  CheckCircle, XCircle, Eye, EyeOff,
  Shield, ChevronDown, ChevronUp, Globe, Briefcase, User, Loader2, Sparkles,
} from 'lucide-react'
import clsx from 'clsx'
import { apiFetch } from '../api/client'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { toast } from '../components/ui/Toast'
import {
  CLAUDE_MODELS,
  LLM_PROVIDERS,
  getCredentials,
  setCredential,
  getSelectedModel,
  setSelectedModel,
  getLlmProvider,
  setLlmProvider,
  clearCredentials,
  hasApiKey,
} from '../hooks/useCredentialStore'

interface Company {
  id: string
  name: string
  domain: string | null
  greenhouse_slug: string | null
  lever_slug: string | null
  ashby_slug: string | null
  workable_slug: string | null
  careers_url: string | null
  ats_type: string | null
  notes: string | null
  is_active: boolean
}

interface GmailStatus {
  connected: boolean
  email?: string
  error?: string
}

const ATS_TYPES = [
  { id: '', label: 'Auto-detect' },
  { id: 'greenhouse', label: 'Greenhouse' },
  { id: 'lever', label: 'Lever' },
  { id: 'ashby', label: 'Ashby' },
  { id: 'workable', label: 'Workable' },
  { id: 'smartrecruiters', label: 'SmartRecruiters' },
  { id: 'jobvite', label: 'Jobvite' },
  { id: 'custom', label: 'Custom / Other' },
]

function SectionCard({ children, className, danger }: { children: React.ReactNode; className?: string; danger?: boolean }) {
  return (
    <section className={clsx(
      'bg-surface-2 rounded-xl border',
      danger ? 'border-loss/20' : 'border-[rgba(255,255,255,0.06)]',
      className,
    )}>
      {children}
    </section>
  )
}

function SectionHeader({ icon, title, description, status }: {
  icon: React.ReactNode; title: string; description?: string; status?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between p-5 pb-0">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-accent/10 text-accent mt-0.5">{icon}</div>
        <div>
          <h2 className="text-heading text-text-primary">{title}</h2>
          {description && <p className="text-caption text-text-tertiary mt-0.5">{description}</p>}
        </div>
      </div>
      {status}
    </div>
  )
}

export default function Settings() {
  const [apiKey, setApiKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [showOpenaiKey, setShowOpenaiKey] = useState(false)
  const [provider, setProvider] = useState(getLlmProvider())
  const [model, setModel] = useState(getSelectedModel())
  const [keySaved, setKeySaved] = useState(false)

  const [gmailStatus, setGmailStatus] = useState<GmailStatus>({ connected: false })

  // User profile for auto-apply
  const [profile, setProfile] = useState({
    full_name: '', email: '', phone: '', location: '',
    linkedin_url: '', portfolio_url: '', github_url: '',
    work_authorization: '', require_sponsorship: false,
    years_experience: '', desired_salary: '',
    willing_to_relocate: false, preferred_locations: '',
    education_summary: '',
  })
  const [profileSaved, setProfileSaved] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  const [companies, setCompanies] = useState<Company[]>([])
  const [newCompany, setNewCompany] = useState({
    name: '', domain: '', greenhouse_slug: '', lever_slug: '',
    ashby_slug: '', workable_slug: '', careers_url: '', ats_type: '', notes: '',
  })
  const [addingCompany, setAddingCompany] = useState(false)
  const [showAddCompany, setShowAddCompany] = useState(false)
  const [suggestions, setSuggestions] = useState<Array<Record<string, string>>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [addingSuggestion, setAddingSuggestion] = useState('')

  const [criteria, setCriteria] = useState('')
  const [resume, setResume] = useState('')
  const [showCriteria, setShowCriteria] = useState(false)
  const [showResume, setShowResume] = useState(false)

  useEffect(() => {
    const creds = getCredentials()
    if (creds.anthropicApiKey) setApiKey(creds.anthropicApiKey)
    if (creds.openaiApiKey) setOpenaiKey(creds.openaiApiKey)
    fetchCompanies()
    fetchGmailStatus()
    fetchConfig()
    fetchProfile()
  }, [])

  const fetchCompanies = async () => {
    try {
      const data = await apiFetch<Company[]>('/companies')
      setCompanies(data)
    } catch { /* */ }
  }

  const fetchProfile = async () => {
    try {
      const data = await apiFetch<any>('/profile')
      if (data) {
        setProfile({
          full_name: data.full_name || '',
          email: data.email || '',
          phone: data.phone || '',
          location: data.location || '',
          linkedin_url: data.linkedin_url || '',
          portfolio_url: data.portfolio_url || '',
          github_url: data.github_url || '',
          work_authorization: data.work_authorization || '',
          require_sponsorship: data.require_sponsorship || false,
          years_experience: data.years_experience?.toString() || '',
          desired_salary: data.desired_salary || '',
          willing_to_relocate: data.willing_to_relocate || false,
          preferred_locations: data.preferred_locations || '',
          education_summary: data.education_summary || '',
        })
        setShowProfile(true)
      }
    } catch { /* */ }
  }

  const handleSaveProfile = async () => {
    try {
      await apiFetch('/profile', {
        method: 'PUT',
        body: JSON.stringify({
          ...profile,
          years_experience: profile.years_experience ? parseInt(profile.years_experience) : null,
        }),
      })
      setProfileSaved(true)
      toast('Profile saved')
      setTimeout(() => setProfileSaved(false), 2000)
    } catch { toast('Failed to save profile') }
  }

  const fetchGmailStatus = async () => {
    try {
      const data = await apiFetch<GmailStatus>('/auth/gmail/status')
      setGmailStatus(data)
    } catch { /* */ }
  }

  const fetchConfig = async () => {
    try {
      const configs = await apiFetch<Array<{ key: string; value: Record<string, string> }>>('/pipeline/config')
      for (const config of configs) {
        if (config.key === 'role_criteria') { setCriteria(config.value.criteria || ''); if (config.value.criteria) setShowCriteria(true) }
        if (config.key === 'resume_context') { setResume(config.value.resume || ''); if (config.value.resume) setShowResume(true) }
      }
    } catch { /* */ }
  }

  const [verifyingKey, setVerifyingKey] = useState(false)

  const handleSaveApiKey = async () => {
    // Save first
    setCredential('anthropic_api_key', apiKey)
    setCredential('openai_api_key', openaiKey)
    setLlmProvider(provider)

    // Then verify the key works
    const activeKey = provider === 'anthropic' ? apiKey : openaiKey
    if (activeKey) {
      setVerifyingKey(true)
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (provider === 'anthropic') headers['X-Anthropic-Key'] = apiKey
        else headers['X-OpenAI-Key'] = openaiKey

        const result = await apiFetch<{ checks: { llm: { status: string; message: string } } }>('/health/setup')
        const llmCheck = result.checks?.llm
        if (llmCheck?.status === 'ok') {
          toast('API key saved and verified!')
        } else {
          toast('Key saved. Verification: ' + (llmCheck?.message || 'pending — will verify on first use'))
        }
      } catch {
        toast('Key saved — will verify on first use')
      }
      setVerifyingKey(false)
    } else {
      toast('API key cleared')
    }

    setKeySaved(true)
    setTimeout(() => setKeySaved(false), 2000)
  }

  const handleProviderChange = (p: string) => {
    setProvider(p)
    setLlmProvider(p)
    // Auto-select first model for the new provider
    const firstModel = CLAUDE_MODELS.find(m => m.provider === p)
    if (firstModel) {
      setModel(firstModel.id)
      setSelectedModel(firstModel.id)
    }
  }

  const handleModelChange = (modelId: string) => {
    setModel(modelId)
    setSelectedModel(modelId)
    toast('Model updated')
  }

  const handleConnectGmail = async () => {
    try {
      const data = await apiFetch<{ url?: string; error?: string }>('/auth/gmail/url')
      if (data.url) window.location.href = data.url
    } catch { /* */ }
  }

  const fetchSuggestions = async () => {
    try {
      const data = await apiFetch<Array<Record<string, string>>>('/companies/suggestions')
      // Filter out already-added companies
      const existing = new Set(companies.map(c => c.name.toLowerCase()))
      setSuggestions(data.filter(s => !existing.has(s.name.toLowerCase())))
    } catch { /* */ }
  }

  const handleQuickAddCompany = async (suggestion: Record<string, string>) => {
    setAddingSuggestion(suggestion.name)
    try {
      await apiFetch('/companies', {
        method: 'POST',
        body: JSON.stringify({
          name: suggestion.name,
          domain: suggestion.domain || null,
          greenhouse_slug: suggestion.greenhouse_slug || null,
          lever_slug: suggestion.lever_slug || null,
          ashby_slug: suggestion.ashby_slug || null,
          workable_slug: suggestion.workable_slug || null,
          careers_url: suggestion.careers_url || null,
        }),
      })
      await fetchCompanies()
      setSuggestions(prev => prev.filter(s => s.name !== suggestion.name))
      toast(`Added ${suggestion.name}`)
    } catch { /* */ }
    setAddingSuggestion('')
  }

  const autoDetectAts = (url: string) => {
    if (!url) return
    const u = url.toLowerCase()
    // Greenhouse: job-boards.greenhouse.io/{slug} or boards-api.greenhouse.io
    const ghMatch = u.match(/(?:job-boards\.(?:eu\.)?greenhouse\.io|boards-api\.greenhouse\.io\/v1\/boards)\/([a-z0-9-]+)/)
    if (ghMatch) {
      setNewCompany(p => ({ ...p, greenhouse_slug: ghMatch[1], ats_type: 'greenhouse' }))
      return
    }
    // Lever: jobs.lever.co/{slug}
    const leverMatch = u.match(/jobs\.lever\.co\/([a-z0-9-]+)/)
    if (leverMatch) {
      setNewCompany(p => ({ ...p, lever_slug: leverMatch[1], ats_type: 'lever' }))
      return
    }
    // Ashby: jobs.ashbyhq.com/{slug}
    const ashbyMatch = u.match(/jobs\.ashbyhq\.com\/([a-z0-9.-]+)/i)
    if (ashbyMatch) {
      setNewCompany(p => ({ ...p, ashby_slug: ashbyMatch[1], ats_type: 'ashby' }))
      return
    }
    // Workable: apply.workable.com/{slug}
    const workableMatch = u.match(/apply\.workable\.com\/([a-z0-9-]+)/)
    if (workableMatch) {
      setNewCompany(p => ({ ...p, workable_slug: workableMatch[1], ats_type: 'workable' }))
      return
    }
  }

  const handleAddCompany = async () => {
    if (!newCompany.name) return
    setAddingCompany(true)
    try {
      await apiFetch('/companies', {
        method: 'POST',
        body: JSON.stringify({
          name: newCompany.name,
          domain: newCompany.domain || null,
          greenhouse_slug: newCompany.greenhouse_slug || null,
          lever_slug: newCompany.lever_slug || null,
          ashby_slug: newCompany.ashby_slug || null,
          workable_slug: newCompany.workable_slug || null,
          careers_url: newCompany.careers_url || null,
          ats_type: newCompany.ats_type || null,
          notes: newCompany.notes || null,
        }),
      })
      setNewCompany({ name: '', domain: '', greenhouse_slug: '', lever_slug: '', ashby_slug: '', workable_slug: '', careers_url: '', ats_type: '', notes: '' })
      await fetchCompanies()
      setShowAddCompany(false)
      toast('Company added')
    } catch { /* */ }
    setAddingCompany(false)
  }

  const handleDeleteCompany = async (id: string) => {
    try {
      await apiFetch(`/companies/${id}`, { method: 'DELETE' })
      setCompanies(prev => prev.filter(c => c.id !== id))
      toast('Company removed')
    } catch { /* */ }
  }

  const handleSaveConfig = async (key: string, value: Record<string, any>, label: string) => {
    try {
      await apiFetch('/pipeline/config', {
        method: 'PUT',
        body: JSON.stringify({ key, value }),
      })
      toast(`${label} saved`)
    } catch { /* */ }
  }

  const maskedKey = apiKey ? `sk-ant-...${apiKey.slice(-6)}` : ''

  const atsCount = (c: Company) => {
    let count = 0
    if (c.greenhouse_slug) count++
    if (c.lever_slug) count++
    if (c.ashby_slug) count++
    if (c.workable_slug) count++
    if (c.careers_url) count++
    return count
  }

  return (
    <div className="p-6 max-w-3xl mx-auto animate-fade-in space-y-4">
      <div className="mb-6">
        <h1 className="text-display text-text-primary">Settings</h1>
        <p className="text-body text-text-tertiary mt-1">Configure your Nexus pipeline and integrations</p>
      </div>

      {/* Connections Overview */}
      <div className="grid grid-cols-3 gap-3">
        <div className={clsx(
          'flex items-center gap-2.5 p-3 rounded-lg border',
          hasApiKey() ? 'bg-gain/5 border-gain/20' : 'bg-surface-2 border-[rgba(255,255,255,0.06)]',
        )}>
          <div className={clsx('w-2 h-2 rounded-full', hasApiKey() ? 'bg-gain' : 'bg-text-tertiary')} />
          <div>
            <p className="text-caption text-text-primary font-medium">Claude API</p>
            <p className="text-[10px] text-text-tertiary">{hasApiKey() ? 'Configured' : 'Not set'}</p>
          </div>
        </div>
        <div className={clsx(
          'flex items-center gap-2.5 p-3 rounded-lg border',
          gmailStatus.connected ? 'bg-gain/5 border-gain/20' : 'bg-surface-2 border-[rgba(255,255,255,0.06)]',
        )}>
          <div className={clsx('w-2 h-2 rounded-full', gmailStatus.connected ? 'bg-gain' : 'bg-text-tertiary')} />
          <div>
            <p className="text-caption text-text-primary font-medium">Gmail</p>
            <p className="text-[10px] text-text-tertiary">{gmailStatus.connected ? gmailStatus.email : 'Not connected'}</p>
          </div>
        </div>
        <div className={clsx(
          'flex items-center gap-2.5 p-3 rounded-lg border',
          companies.length > 0 ? 'bg-gain/5 border-gain/20' : 'bg-surface-2 border-[rgba(255,255,255,0.06)]',
        )}>
          <div className={clsx('w-2 h-2 rounded-full', companies.length > 0 ? 'bg-gain' : 'bg-text-tertiary')} />
          <div>
            <p className="text-caption text-text-primary font-medium">Job Boards</p>
            <p className="text-[10px] text-text-tertiary">{companies.length > 0 ? `${companies.length} companies` : 'None configured'}</p>
          </div>
        </div>
      </div>

      {/* LLM Provider & API Keys */}
      <SectionCard>
        <SectionHeader
          icon={<Key className="w-4 h-4" />}
          title="AI Provider"
          description="Choose Anthropic (Claude) or OpenAI (GPT-4) and provide your API key"
          status={hasApiKey() ? <Badge variant="applied" dot>Active</Badge> : null}
        />
        <div className="p-5 pt-4 space-y-4">
          {/* Provider toggle */}
          <div className="flex gap-1 p-0.5 bg-surface-3 rounded-lg w-fit">
            {LLM_PROVIDERS.map(p => (
              <button
                key={p.id}
                onClick={() => handleProviderChange(p.id)}
                className={clsx(
                  'px-3 py-1.5 rounded-md text-caption transition-colors',
                  provider === p.id ? 'bg-surface-2 text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Anthropic Key */}
          {provider === 'anthropic' && (
            <div>
              <label className="text-[11px] text-text-tertiary block mb-1">Anthropic API Key</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="w-full px-3 py-2 pr-10 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50"
                  />
                  <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary">
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button variant={keySaved ? 'primary' : 'accent'} size="sm" onClick={handleSaveApiKey} icon={keySaved ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}>
                  {keySaved ? 'Saved' : 'Save'}
                </Button>
              </div>
            </div>
          )}

          {/* OpenAI Key */}
          {provider === 'openai' && (
            <div>
              <label className="text-[11px] text-text-tertiary block mb-1">OpenAI API Key</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showOpenaiKey ? 'text' : 'password'}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 pr-10 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50"
                  />
                  <button onClick={() => setShowOpenaiKey(!showOpenaiKey)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary">
                    {showOpenaiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button variant={keySaved ? 'primary' : 'accent'} size="sm" onClick={handleSaveApiKey} icon={keySaved ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}>
                  {keySaved ? 'Saved' : 'Save'}
                </Button>
              </div>
            </div>
          )}

          {/* Model selection — filtered by provider */}
          <div>
            <label className="text-[11px] text-text-tertiary block mb-2">Model</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CLAUDE_MODELS.filter(m => m.provider === provider).map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleModelChange(m.id)}
                  className={clsx(
                    'px-3 py-2.5 rounded-lg text-label transition-all text-left',
                    model === m.id
                      ? 'bg-accent/15 text-accent border border-accent/30 ring-1 ring-accent/10'
                      : 'bg-surface-3 text-text-secondary hover:bg-surface-4 border border-transparent',
                  )}
                >
                  <span className="block">{m.label}</span>
                  {model === m.id && <span className="text-[10px] text-accent/70 mt-0.5 block">Selected</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Gmail Connection */}
      <SectionCard>
        <SectionHeader
          icon={<Mail className="w-4 h-4" />}
          title="Gmail Connection"
          description="Send outreach emails directly from Nexus"
          status={gmailStatus.connected
            ? <Badge variant="applied" dot>Connected</Badge>
            : null
          }
        />
        <div className="p-5 pt-4">
          {gmailStatus.connected ? (
            <div className="flex items-center gap-3 p-3 bg-gain/5 rounded-lg border border-gain/20">
              <CheckCircle className="w-5 h-5 text-gain flex-shrink-0" />
              <div className="flex-1">
                <p className="text-body text-text-primary">Connected as <span className="font-medium text-gain">{gmailStatus.email}</span></p>
                <p className="text-caption text-text-tertiary">Outreach emails will be sent from this account</p>
              </div>
            </div>
          ) : (
            <div>
              <Button variant="accent" size="sm" icon={<Mail className="w-3.5 h-3.5" />} onClick={handleConnectGmail}>
                Connect Gmail
              </Button>
            </div>
          )}
        </div>
      </SectionCard>

      {/* User Profile for Auto-Apply */}
      <SectionCard>
        <button
          onClick={() => setShowProfile(!showProfile)}
          className="w-full flex items-center justify-between p-5"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10 text-accent"><User className="w-4 h-4" /></div>
            <div className="text-left">
              <h2 className="text-heading text-text-primary">Application Profile</h2>
              <p className="text-caption text-text-tertiary">Personal details for auto-filling job applications</p>
            </div>
          </div>
          {showProfile ? <ChevronUp className="w-4 h-4 text-text-tertiary" /> : <ChevronDown className="w-4 h-4 text-text-tertiary" />}
        </button>
        {showProfile && (
          <div className="px-5 pb-5 pt-0 space-y-4">
            <p className="text-caption text-text-tertiary">These details are used when preparing applications. All fields are optional.</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Full Name</label>
                <input type="text" value={profile.full_name} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="John Doe" className="w-full px-3 py-2 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50" />
              </div>
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Email</label>
                <input type="email" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                  placeholder="john@example.com" className="w-full px-3 py-2 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50" />
              </div>
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Phone</label>
                <input type="tel" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+1 555-0100" className="w-full px-3 py-2 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50" />
              </div>
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Location</label>
                <input type="text" value={profile.location} onChange={e => setProfile(p => ({ ...p, location: e.target.value }))}
                  placeholder="San Francisco, CA" className="w-full px-3 py-2 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">LinkedIn URL</label>
                <input type="url" value={profile.linkedin_url} onChange={e => setProfile(p => ({ ...p, linkedin_url: e.target.value }))}
                  placeholder="linkedin.com/in/..." className="w-full px-3 py-2 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50" />
              </div>
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Portfolio URL</label>
                <input type="url" value={profile.portfolio_url} onChange={e => setProfile(p => ({ ...p, portfolio_url: e.target.value }))}
                  placeholder="yoursite.com" className="w-full px-3 py-2 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50" />
              </div>
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">GitHub URL</label>
                <input type="url" value={profile.github_url} onChange={e => setProfile(p => ({ ...p, github_url: e.target.value }))}
                  placeholder="github.com/..." className="w-full px-3 py-2 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Work Authorization</label>
                <select value={profile.work_authorization} onChange={e => setProfile(p => ({ ...p, work_authorization: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary focus:outline-none focus:border-accent/50">
                  <option value="">Select...</option>
                  <option value="US Citizen">US Citizen</option>
                  <option value="Green Card">Green Card</option>
                  <option value="H1B">H1B Visa</option>
                  <option value="OPT">OPT</option>
                  <option value="EAD">EAD</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Years of Experience</label>
                <input type="number" value={profile.years_experience} onChange={e => setProfile(p => ({ ...p, years_experience: e.target.value }))}
                  placeholder="5" className="w-full px-3 py-2 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50" />
              </div>
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Desired Salary</label>
                <input type="text" value={profile.desired_salary} onChange={e => setProfile(p => ({ ...p, desired_salary: e.target.value }))}
                  placeholder="$150k-200k" className="w-full px-3 py-2 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50" />
              </div>
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">Preferred Locations</label>
                <input type="text" value={profile.preferred_locations} onChange={e => setProfile(p => ({ ...p, preferred_locations: e.target.value }))}
                  placeholder="SF, NYC, Remote" className="w-full px-3 py-2 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50" />
              </div>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={profile.require_sponsorship} onChange={e => setProfile(p => ({ ...p, require_sponsorship: e.target.checked }))}
                  className="rounded border-[rgba(255,255,255,0.2)] bg-surface-2 text-accent" />
                <span className="text-caption text-text-secondary">Requires sponsorship</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={profile.willing_to_relocate} onChange={e => setProfile(p => ({ ...p, willing_to_relocate: e.target.checked }))}
                  className="rounded border-[rgba(255,255,255,0.2)] bg-surface-2 text-accent" />
                <span className="text-caption text-text-secondary">Willing to relocate</span>
              </label>
            </div>

            <div>
              <label className="text-[11px] text-text-tertiary block mb-1">Education Summary</label>
              <textarea value={profile.education_summary} onChange={e => setProfile(p => ({ ...p, education_summary: e.target.value }))}
                rows={2} placeholder="MS Computer Science, Stanford University, 2020"
                className="w-full px-3 py-2 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 resize-y" />
            </div>

            <Button variant="accent" size="sm" icon={profileSaved ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />} onClick={handleSaveProfile}>
              {profileSaved ? 'Saved' : 'Save Profile'}
            </Button>
          </div>
        )}
      </SectionCard>

      {/* Target Companies */}
      <SectionCard>
        <SectionHeader
          icon={<Building2 className="w-4 h-4" />}
          title="Target Companies"
          description={`${companies.length} companies tracked across ${new Set(companies.flatMap(c => [c.greenhouse_slug && 'GH', c.lever_slug && 'Lever', c.ashby_slug && 'Ashby', c.workable_slug && 'Workable', c.careers_url && 'Custom'].filter(Boolean))).size} board types`}
        />
        <div className="p-5 pt-4">
          {companies.length > 0 && (
            <div className="space-y-1.5 mb-4">
              {companies.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2.5 px-3.5 bg-surface-3 rounded-lg group hover:bg-surface-4 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-accent text-label font-semibold">{c.name[0]}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-body text-text-primary truncate">{c.name}</p>
                      <div className="flex gap-2 flex-wrap">
                        {c.domain && <span className="text-[10px] text-text-tertiary">{c.domain}</span>}
                        {c.greenhouse_slug && <Badge variant="gain" className="text-[9px] px-1.5 py-0">GH</Badge>}
                        {c.lever_slug && <Badge variant="info" className="text-[9px] px-1.5 py-0">Lever</Badge>}
                        {c.ashby_slug && <Badge variant="accent" className="text-[9px] px-1.5 py-0">Ashby</Badge>}
                        {c.workable_slug && <Badge variant="warning" className="text-[9px] px-1.5 py-0">Workable</Badge>}
                        {c.careers_url && !c.greenhouse_slug && !c.lever_slug && !c.ashby_slug && !c.workable_slug && (
                          <Badge variant="default" className="text-[9px] px-1.5 py-0">Custom</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteCompany(c.id)}
                    className="text-text-tertiary hover:text-loss opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Quick add from suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="mb-4 p-3 bg-surface-1 rounded-lg border border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-label text-text-primary">Popular Companies (click to add)</p>
                <Button variant="accent" size="sm" onClick={async () => {
                  try {
                    await apiFetch('/companies/import', { method: 'POST', body: JSON.stringify({ companies: suggestions }) })
                    await fetchCompanies()
                    setSuggestions([])
                    toast(`Added ${suggestions.length} companies`)
                  } catch { toast('Import failed') }
                }}>
                  Add All ({suggestions.length})
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map(s => (
                  <button
                    key={s.name}
                    onClick={() => handleQuickAddCompany(s)}
                    disabled={addingSuggestion === s.name}
                    className={clsx(
                      'px-2.5 py-1.5 rounded-md text-caption transition-all border',
                      addingSuggestion === s.name
                        ? 'bg-accent/10 text-accent border-accent/30'
                        : 'bg-surface-3 text-text-secondary border-transparent hover:border-accent/30 hover:bg-accent/5',
                    )}
                  >
                    {addingSuggestion === s.name ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
                    {s.name}
                    <span className="text-[9px] text-text-tertiary ml-1">
                      {s.greenhouse_slug ? 'GH' : s.lever_slug ? 'Lever' : s.ashby_slug ? 'Ashby' : s.workable_slug ? 'Wkbl' : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {showAddCompany ? (
            <div className="space-y-3 p-4 bg-surface-1 rounded-lg border border-[rgba(255,255,255,0.06)]">
              <p className="text-label text-text-primary font-medium">Add Company</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newCompany.name}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Company name *"
                  className="px-3 py-2 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50"
                />
                <input
                  type="text"
                  value={newCompany.domain}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, domain: e.target.value }))}
                  placeholder="Domain (e.g. stripe.com)"
                  className="px-3 py-2 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50"
                />
              </div>

              <p className="text-caption text-text-tertiary">ATS Integrations — fill in the slugs for boards this company uses:</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newCompany.greenhouse_slug}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, greenhouse_slug: e.target.value }))}
                  placeholder="Greenhouse slug"
                  className="px-3 py-2 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50"
                />
                <input
                  type="text"
                  value={newCompany.lever_slug}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, lever_slug: e.target.value }))}
                  placeholder="Lever slug"
                  className="px-3 py-2 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50"
                />
                <input
                  type="text"
                  value={newCompany.ashby_slug}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, ashby_slug: e.target.value }))}
                  placeholder="Ashby slug"
                  className="px-3 py-2 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50"
                />
                <input
                  type="text"
                  value={newCompany.workable_slug}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, workable_slug: e.target.value }))}
                  placeholder="Workable slug"
                  className="px-3 py-2 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50"
                />
              </div>

              <div>
                <input
                  type="text"
                  value={newCompany.careers_url}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, careers_url: e.target.value }))}
                  onBlur={(e) => autoDetectAts(e.target.value)}
                  placeholder="Paste careers page URL — auto-detects Greenhouse, Lever, Ashby, Workable"
                  className="w-full px-3 py-2 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50"
                />
                <p className="text-[10px] text-text-tertiary mt-1">Paste a URL like jobs.ashbyhq.com/elevenlabs and slugs auto-fill</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newCompany.ats_type}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, ats_type: e.target.value }))}
                  className="px-3 py-2 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary focus:outline-none focus:border-accent/50"
                >
                  {ATS_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <input
                  type="text"
                  value={newCompany.notes}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notes (optional)"
                  className="px-3 py-2 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="accent"
                  size="sm"
                  onClick={handleAddCompany}
                  disabled={!newCompany.name || addingCompany}
                  loading={addingCompany}
                  icon={<Plus className="w-3.5 h-3.5" />}
                >
                  Add Company
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAddCompany(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowAddCompany(true)}>
                Add Company
              </Button>
              <Button variant="ghost" size="sm" icon={<Sparkles className="w-3.5 h-3.5" />} onClick={() => { setShowSuggestions(!showSuggestions); if (!showSuggestions) fetchSuggestions() }}>
                {showSuggestions ? 'Hide Suggestions' : 'Quick Add Popular'}
              </Button>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Role Criteria */}
      <SectionCard>
        <button
          onClick={() => setShowCriteria(!showCriteria)}
          className="w-full flex items-center justify-between p-5"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10 text-accent"><Target className="w-4 h-4" /></div>
            <div className="text-left">
              <h2 className="text-heading text-text-primary">Role Criteria</h2>
              <p className="text-caption text-text-tertiary">Ideal role description for job matching</p>
            </div>
          </div>
          {showCriteria ? <ChevronUp className="w-4 h-4 text-text-tertiary" /> : <ChevronDown className="w-4 h-4 text-text-tertiary" />}
        </button>
        {showCriteria && (
          <div className="px-5 pb-5 pt-0">
            <textarea
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              rows={4}
              placeholder="e.g., Senior AI/ML Engineer, interested in LLMs, RAG, and autonomous agents. Prefer remote or San Francisco area."
              className="w-full px-3 py-2 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 resize-y mb-3"
            />
            <Button variant="accent" size="sm" icon={<Save className="w-3.5 h-3.5" />} onClick={() => handleSaveConfig('role_criteria', { criteria }, 'Criteria')}>
              Save Criteria
            </Button>
          </div>
        )}
      </SectionCard>

      {/* Resume / Skills */}
      <SectionCard>
        <button
          onClick={() => setShowResume(!showResume)}
          className="w-full flex items-center justify-between p-5"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10 text-accent"><FileText className="w-4 h-4" /></div>
            <div className="text-left">
              <h2 className="text-heading text-text-primary">Resume / Skills</h2>
              <p className="text-caption text-text-tertiary">Context for email drafting and interview prep</p>
            </div>
          </div>
          {showResume ? <ChevronUp className="w-4 h-4 text-text-tertiary" /> : <ChevronDown className="w-4 h-4 text-text-tertiary" />}
        </button>
        {showResume && (
          <div className="px-5 pb-5 pt-0">
            <textarea
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              rows={6}
              placeholder="Paste your resume summary, key skills, notable projects, etc."
              className="w-full px-3 py-2 bg-surface-3 border border-[rgba(255,255,255,0.06)] rounded-lg text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 resize-y mb-3"
            />
            <Button variant="accent" size="sm" icon={<Save className="w-3.5 h-3.5" />} onClick={() => handleSaveConfig('resume_context', { resume }, 'Resume')}>
              Save Resume
            </Button>
          </div>
        )}
      </SectionCard>

      {/* Danger Zone */}
      <SectionCard danger>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-loss/10 text-loss"><Shield className="w-4 h-4" /></div>
            <div>
              <h2 className="text-heading text-text-primary">Danger Zone</h2>
              <p className="text-caption text-text-tertiary">This action cannot be undone</p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            icon={<XCircle className="w-3.5 h-3.5" />}
            onClick={() => { clearCredentials(); toast('All credentials cleared') }}
          >
            Clear All Stored Credentials
          </Button>
        </div>
      </SectionCard>
    </div>
  )
}
