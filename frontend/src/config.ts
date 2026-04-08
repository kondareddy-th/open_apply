/**
 * App configuration — standalone by default.
 *
 * For nested deployment (e.g., yourdomain.com/apps/nexus/):
 *   Set VITE_BASE_PATH="/apps/nexus/" in your .env or build command.
 *
 * For standalone deployment (e.g., nexus.yourdomain.com/):
 *   No configuration needed — defaults to "/".
 */

// Base path for router and asset loading
// Strip trailing slash for router basename, keep for asset base
const raw = import.meta.env.VITE_BASE_PATH || '/'
export const BASE_PATH = raw.endsWith('/') ? raw.slice(0, -1) || '/' : raw

// API base path — always relative to the base path
export const API_BASE = raw === '/' ? '/api' : `${raw.endsWith('/') ? raw.slice(0, -1) : raw}/api`
