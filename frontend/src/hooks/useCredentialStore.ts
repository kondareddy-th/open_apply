const STORE_PREFIX = 'nexus_cred_'

export const LLM_PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic (Claude)' },
  { id: 'openai', label: 'OpenAI (GPT-4)' },
] as const

export const CLAUDE_MODELS = [
  { id: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', provider: 'anthropic' },
  { id: 'claude-sonnet-4-6-20250929', label: 'Claude Sonnet 4.6', provider: 'anthropic' },
  { id: 'claude-opus-4-6-20250929',   label: 'Claude Opus 4.6',  provider: 'anthropic' },
  { id: 'gpt-4o',                      label: 'GPT-4o',           provider: 'openai' },
  { id: 'gpt-4o-mini',                 label: 'GPT-4o Mini',      provider: 'openai' },
  { id: 'o3-mini',                     label: 'o3-mini',          provider: 'openai' },
] as const

export interface Credentials {
  anthropicApiKey: string
  openaiApiKey: string
  claudeModel: string
  llmProvider: string
}

export function getCredentials(): Credentials {
  return {
    anthropicApiKey: getItem('anthropic_api_key'),
    openaiApiKey:    getItem('openai_api_key'),
    claudeModel:     getItem('claude_model') || CLAUDE_MODELS[0].id,
    llmProvider:     getItem('llm_provider') || 'anthropic',
  }
}

export function getSelectedModel(): string {
  return getItem('claude_model') || CLAUDE_MODELS[0].id
}

export function setSelectedModel(modelId: string): void {
  setCredential('claude_model', modelId)
}

export function getLlmProvider(): string {
  return getItem('llm_provider') || 'anthropic'
}

export function setLlmProvider(provider: string): void {
  setCredential('llm_provider', provider)
}

export function setCredential(key: string, value: string): void {
  try {
    if (value) {
      localStorage.setItem(`${STORE_PREFIX}${key}`, btoa(value))
    } else {
      localStorage.removeItem(`${STORE_PREFIX}${key}`)
    }
  } catch { /* localStorage full or unavailable */ }
}

export function getItem(key: string): string {
  try {
    const val = localStorage.getItem(`${STORE_PREFIX}${key}`)
    return val ? atob(val) : ''
  } catch { return '' }
}

export function clearCredentials(): void {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(STORE_PREFIX))
  keys.forEach(k => localStorage.removeItem(k))
}

export function hasApiKey(): boolean {
  return !!(getItem('anthropic_api_key') || getItem('openai_api_key'))
}

export function getActiveApiKeyHeader(): Record<string, string> {
  const creds = getCredentials()
  if (creds.anthropicApiKey) return { 'X-Anthropic-Key': creds.anthropicApiKey }
  if (creds.openaiApiKey) return { 'X-OpenAI-Key': creds.openaiApiKey }
  return {}
}
