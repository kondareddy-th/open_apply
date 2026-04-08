import { getCredentials, getActiveApiKeyHeader } from '../hooks/useCredentialStore'
import { API_BASE } from '../config'

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const cleanPath = path.startsWith('/api') ? path.slice(4) : path
  const creds = getCredentials()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
    ...getActiveApiKeyHeader(),
  }

  if (creds.claudeModel) {
    headers['X-Claude-Model'] = creds.claudeModel
  }

  const res = await fetch(`${API_BASE}${cleanPath}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('API key required. Please add your Anthropic or OpenAI API key in Settings.')
    }
    const body = await res.text()
    throw new Error(`API error: ${res.status} ${body}`)
  }
  return res.json()
}
