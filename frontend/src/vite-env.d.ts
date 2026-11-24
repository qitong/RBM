/// <reference types="vite/client" />

interface ImportMetaEnv {
  VITE_DATA_SOURCE?: 'mock' | 'api'
  VITE_API_BASE_URL?: string
  VITE_RBQM_STATIC_FALLBACK?: string
}
