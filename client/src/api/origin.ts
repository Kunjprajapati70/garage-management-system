const configured = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '') || ''

export const apiOrigin = configured
export const apiBase = configured ? `${configured}/api` : '/api'
