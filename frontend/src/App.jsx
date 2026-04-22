import React, { useEffect, useMemo, useState } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { authHeaders, orderApi, paymentApi, priceApi, userApi } from './api'

const initialForm = { username: '', password: '' }

export default function App() {
  const [registerForm, setRegisterForm] = useState(initialForm)
  const [loginForm, setLoginForm] = useState(initialForm)
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'))
  const [stocks, setStocks] = useState([])
  const [portfolio, setPortfolio] = useState([])
  const [orders, setOrders] = useState([])
  const [balance, setBalance] = useState(0)
  const [walletAmount, setWalletAmount] = useState('1000')
  const [tradeForm, setTradeForm] = useState({ stockTicker: 'ABC', quantity: 1, type: 'BUY' })
  const [messages, setMessages] = useState([])

  const isLoggedIn = useMemo(() => !!token && !!user, [token, user])

  const pushMessage = (message) => setMessages((prev) => [message, ...prev].slice(0, 20))

  async function loadStocks() {
    const res = await priceApi.get('/stocks')
    setStocks(res.data)
  }

  async function loadPortfolio() {
    if (!token) return
    const res = await orderApi.get('/portfolio', { headers: authHeaders(token) })
    setPortfolio(res.data)
  }

  async function loadOrders() {
    if (!token) return
    const res = await orderApi.get('', { headers: authHeaders(token) })
    setOrders(res.data)
  }

  async function loadBalance() {
    if (!token) return
    const res = await paymentApi.get('/wallet', { headers: authHeaders(token) })
    setBalance(res.data.balance)
  }

  useEffect(() => { loadStocks() }, [])

  useEffect(() => {
    if (!isLoggedIn) return
    loadPortfolio()
    loadOrders()
    loadBalance()
  }, [isLoggedIn])

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8084/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe('/topic/prices', (message) => {
          const data = JSON.parse(message.body)
          setStocks(data)
          pushMessage('Live price update received')
        })
      },
      onStompError: (frame) => {
        console.error('Broker error', frame)
      }
    })
    client.activate()
    return () => client.deactivate()
  }, [])

  async function register(e) {
    e.preventDefault()
    await userApi.post('/register', registerForm)
    pushMessage('Registration successful')
    setRegisterForm(initialForm)
  }

  async function login(e) {
    e.preventDefault()
    const res = await userApi.post('/login', loginForm)
    setToken(res.data.token)
    setUser({ userId: res.data.userId, username: res.data.username })
    localStorage.setItem('token', res.data.token)
    localStorage.setItem('user', JSON.stringify({ userId: res.data.userId, username: res.data.username }))
    pushMessage('Login successful')
  }

  function logout() {
    setToken('')
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  async function addBalance() {
    await paymentApi.post('/wallet/topup', { amount: Number(walletAmount) }, { headers: authHeaders(token) })
    pushMessage(`Wallet topped up by ${walletAmount}`)
    loadBalance()
  }

  async function submitTrade(e) {
    e.preventDefault()
    await orderApi.post('', tradeForm, { headers: authHeaders(token) })
    pushMessage(`${tradeForm.type} order submitted`) 
    setTradeForm({ ...tradeForm, quantity: 1 })
    setTimeout(() => {
      loadOrders(); loadPortfolio(); loadBalance(); loadStocks()
    }, 1500)
  }

  return (
    <div className="container">
      <h1>Simple Stock Trading Prototype</h1>
      <p className="sub">REST for user actions, Kafka for internal events, WebSocket for live prices.</p>

      <div className="grid two">
        <section className="card">
          <h2>Register</h2>
          <form onSubmit={register}>
            <input placeholder="username" value={registerForm.username} onChange={e => setRegisterForm({ ...registerForm, username: e.target.value })} />
            <input placeholder="password" type="password" value={registerForm.password} onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })} />
            <button type="submit">Register</button>
          </form>
        </section>

        <section className="card">
          <h2>Login</h2>
          <form onSubmit={login}>
            <input placeholder="username" value={loginForm.username} onChange={e => setLoginForm({ ...loginForm, username: e.target.value })} />
            <input placeholder="password" type="password" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} />
            <div className="row">
              <button type="submit">Login</button>
              {isLoggedIn && <button type="button" onClick={logout}>Logout</button>}
            </div>
          </form>
          {user && <p>Logged in as <strong>{user.username}</strong></p>}
        </section>
      </div>

      <div className="grid two">
        <section className="card">
          <h2>Stocks</h2>
          <table>
            <thead>
              <tr><th>Ticker</th><th>Price</th></tr>
            </thead>
            <tbody>
              {stocks.map(stock => (
                <tr key={stock.ticker}>
                  <td>{stock.ticker}</td>
                  <td>{Number(stock.currentPrice).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2>Wallet</h2>
          <p>Balance: <strong>{Number(balance).toFixed(2)}</strong></p>
          {isLoggedIn && (
            <>
              <input value={walletAmount} onChange={e => setWalletAmount(e.target.value)} />
              <button onClick={addBalance}>Top Up Wallet</button>
            </>
          )}
        </section>
      </div>

      {isLoggedIn && (
        <div className="grid two">
          <section className="card">
            <h2>Buy / Sell</h2>
            <form onSubmit={submitTrade}>
              <select value={tradeForm.stockTicker} onChange={e => setTradeForm({ ...tradeForm, stockTicker: e.target.value })}>
                {stocks.map(stock => <option key={stock.ticker} value={stock.ticker}>{stock.ticker}</option>)}
              </select>
              <input type="number" min="1" value={tradeForm.quantity} onChange={e => setTradeForm({ ...tradeForm, quantity: Number(e.target.value) })} />
              <select value={tradeForm.type} onChange={e => setTradeForm({ ...tradeForm, type: e.target.value })}>
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
              <button type="submit">Submit Order</button>
            </form>
          </section>

          <section className="card">
            <h2>Portfolio</h2>
            <table>
              <thead><tr><th>Ticker</th><th>Quantity</th></tr></thead>
              <tbody>
                {portfolio.map(p => <tr key={p.stockTicker}><td>{p.stockTicker}</td><td>{p.quantity}</td></tr>)}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {isLoggedIn && (
        <section className="card">
          <h2>Orders</h2>
          <table>
            <thead><tr><th>ID</th><th>Ticker</th><th>Type</th><th>Qty</th><th>Price</th><th>Status</th></tr></thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td>{o.id}</td><td>{o.stockTicker}</td><td>{o.type}</td><td>{o.quantity}</td><td>{Number(o.price).toFixed(2)}</td><td>{o.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card">
        <h2>Activity</h2>
        <ul>
          {messages.map((m, idx) => <li key={idx}>{m}</li>)}
        </ul>
      </section>
    </div>
  )
}
