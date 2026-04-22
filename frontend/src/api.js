import axios from 'axios'

export const userApi = axios.create({ baseURL: 'http://localhost:8081/api/users' })
export const orderApi = axios.create({ baseURL: 'http://localhost:8082/api/orders' })
export const paymentApi = axios.create({ baseURL: 'http://localhost:8083/api/payments' })
export const priceApi = axios.create({ baseURL: 'http://localhost:8084/api/prices' })

export function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}
