import axios from 'axios'

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '')
}

const envGateway = (import.meta.env.VITE_GATEWAY_URL || '').trim()
const browserOrigin = typeof window !== 'undefined' ? window.location.origin : ''
const browserHost = typeof window !== 'undefined' ? window.location.hostname : ''
const isLocalDevHost = browserHost === 'localhost' || browserHost === '127.0.0.1'
const fallbackGateway = isLocalDevHost ? 'http://localhost:8080' : browserOrigin

export const GATEWAY = normalizeBaseUrl(envGateway || fallbackGateway || 'http://localhost:8080')
export const WS_URL = `${normalizeBaseUrl((import.meta.env.VITE_WS_BASE_URL || '').trim() || GATEWAY)}/ws`

export const userApi    = axios.create({ baseURL: `${GATEWAY}/api/users` })
export const orderApi   = axios.create({ baseURL: `${GATEWAY}/api/orders` })
export const paymentApi = axios.create({ baseURL: `${GATEWAY}/api/payments` })
export const priceApi   = axios.create({ baseURL: `${GATEWAY}/api/prices` })
export const companyApi = axios.create({ baseURL: `${GATEWAY}/api/companies` })
export const bookApi             = axios.create({ baseURL: `${GATEWAY}/api/book` })
export const notificationApi     = axios.create({ baseURL: `${GATEWAY}/api/notifications` })

export function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}