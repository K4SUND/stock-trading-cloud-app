import axios from 'axios'

const GATEWAY = import.meta.env.VITE_GATEWAY_URL

export const userApi = axios.create({ baseURL: `${GATEWAY}/api/users` })
export const orderApi = axios.create({ baseURL: `${GATEWAY}/api/orders` })
export const paymentApi = axios.create({ baseURL: `${GATEWAY}/api/payments` })
export const priceApi = axios.create({ baseURL: `${GATEWAY}/api/prices` })
export const companyApi = axios.create({ baseURL: `${GATEWAY}/api/companies` })
export const bookApi = axios.create({ baseURL: `${GATEWAY}/api/book` })
export const notificationApi = axios.create({ baseURL: `${GATEWAY}/api/notifications` })

export function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}