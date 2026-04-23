import axios from 'axios'

const GATEWAY = 'http://localhost:8080'

export const userApi    = axios.create({ baseURL: `${GATEWAY}/api/users` })
export const orderApi   = axios.create({ baseURL: `${GATEWAY}/api/orders` })
export const paymentApi = axios.create({ baseURL: `${GATEWAY}/api/payments` })
export const priceApi   = axios.create({ baseURL: `${GATEWAY}/api/prices` })
export const companyApi = axios.create({ baseURL: `${GATEWAY}/api/companies` })

export function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}