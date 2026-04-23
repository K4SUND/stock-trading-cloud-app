import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { authHeaders, orderApi, paymentApi, priceApi } from '../api'
import { useAuth } from '../context/AuthContext'

const STATUS_META = {
  PENDING:   { label: 'Pending',   cls: 'badge-warning' },
  COMPLETED: { label: 'Completed', cls: 'badge-success' },
  FAILED:    { label: 'Failed',    cls: 'badge-danger'  },
}

export default function DashboardPage() {
  const { token } = useAuth()
  const headers = authHeaders(token)

  const [stocks, setStocks]             = useState([])
  const [priceDirections, setPriceDirs] = useState({})
  const [portfolio, setPortfolio]       = useState([])
  const [orders, setOrders]             = useState([])
  const [balance, setBalance]           = useState(null)
  const [wsConnected, setWsConnected]   = useState(false)
  const [activity, setActivity]         = useState([])
  const [activeTab, setActiveTab]       = useState('portfolio')
  const [tradeForm, setTradeForm] = useState({ stockTicker: 'ABC', quantity: 1, type: 'BUY' })
  const [tradeLoading, setTradeLoading] = useState(false)
  const [tradeMsg, setTradeMsg]   = useState(null)
  const prevPricesRef = useRef({})

  function pushActivity(msg) {
    const time = new Date().toLocaleTimeString()
    setActivity(prev => [`[${time}] ${msg}`, ...prev].slice(0, 30))
  }

  async function loadStocks() {
    const res = await priceApi.get('/stocks')
    setStocks(res.data)
  }
  async function loadPortfolio() {
    const res = await orderApi.get('/portfolio', { headers })
    setPortfolio(res.data)
  }
  async function loadOrders() {
    const res = await orderApi.get('', { headers })
    setOrders(res.data)
  }
  async function loadBalance() {
    const res = await paymentApi.get('/wallet', { headers })
    setBalance(res.data.balance)
  }

  useEffect(() => {
    loadStocks()
    loadPortfolio()
    loadOrders()
    loadBalance()
  }, [])

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        setWsConnected(true)
        client.subscribe('/topic/prices', (msg) => {
          const data = JSON.parse(msg.body)
          setStocks(prev => {
            const dirs = {}
            data.forEach(s => {
              const old = prevPricesRef.current[s.ticker]
              if (old !== undefined && Number(s.currentPrice) !== Number(old)) {
                dirs[s.ticker] = Number(s.currentPrice) > Number(old) ? 'up' : 'down'
                const arrow = dirs[s.ticker] === 'up' ? '▲' : '▼'
                pushActivity(`${s.ticker} price ${arrow} $${Number(s.currentPrice).toFixed(2)}`)
              } else {
                dirs[s.ticker] = prevPricesRef.current[`dir_${s.ticker}`] || 'neutral'
              }
              prevPricesRef.current[s.ticker] = s.currentPrice
              prevPricesRef.current[`dir_${s.ticker}`] = dirs[s.ticker]
            })
            setPriceDirs(dirs)
            return data
          })
        })
        pushActivity('Connected to live price feed')
      },
      onDisconnect: () => { setWsConnected(false); pushActivity('Disconnected from price feed') },
      onStompError: () => setWsConnected(false),
    })
    client.activate()
    return () => client.deactivate()
  }, [])

  async function submitTrade(e) {
    e.preventDefault()
    setTradeMsg(null)
    setTradeLoading(true)
    try {
      await orderApi.post('', tradeForm, { headers })
      const label = tradeForm.type === 'BUY' ? 'Buy' : 'Sell'
      pushActivity(`${label} order submitted: ${tradeForm.quantity}× ${tradeForm.stockTicker}`)
      setTradeMsg({ type: 'success', text: `${label} order submitted. Processing…` })
      setTradeForm(f => ({ ...f, quantity: 1 }))
      setTimeout(() => { loadOrders(); loadPortfolio(); loadBalance(); loadStocks() }, 2000)
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data || 'Order failed.'
      setTradeMsg({ type: 'error', text: String(msg) })
    } finally {
      setTradeLoading(false)
    }
  }

  function selectStock(ticker) {
    setTradeForm(f => ({ ...f, stockTicker: ticker }))
  }

  const portfolioMap = Object.fromEntries(portfolio.map(p => [p.stockTicker, p.quantity]))

  return (
    <div className="page">
      {/* Stats row */}
      <div className="stats-row">
        <Link to="/wallet" className="stat-card stat-card-link">
          <span className="stat-label">Wallet Balance</span>
          <span className="stat-value">
            {balance === null ? '…' : `$${Number(balance).toFixed(2)}`}
          </span>
        </Link>
        <div className="stat-card">
          <span className="stat-label">Portfolio Positions</span>
          <span className="stat-value">{portfolio.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Orders</span>
          <span className="stat-value">{orders.length}</span>
        </div>
        <div className={`stat-card ${wsConnected ? 'stat-card-live' : 'stat-card-offline'}`}>
          <span className="stat-label">Live Feed</span>
          <span className="stat-value-sm">
            <span className={`live-dot ${wsConnected ? 'live-dot-on' : 'live-dot-off'}`} />
            {wsConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Main grid: Stocks + Trade Form */}
      <div className="dash-grid">
        {/* Stocks */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Market Prices</h2>
            <span className="card-hint">Click a row to pre-fill the trade form</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th className="text-right">Current Price</th>
                <th className="text-right">Last Trade</th>
                <th className="text-right">Trade Value</th>
                <th>Last Update</th>
              </tr>
            </thead>
            <tbody>
              {stocks.length === 0 && (
                <tr><td colSpan={5} className="empty-row">Loading prices…</td></tr>
              )}
              {stocks.map(s => {
                const dir = priceDirections[s.ticker] || 'neutral'
                const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : ''
                const priceCls = dir === 'up' ? 'price-up' : dir === 'down' ? 'price-down' : ''
                const tradeCls = s.lastTradeType === 'BUY' ? 'type-buy' : s.lastTradeType === 'SELL' ? 'type-sell' : ''
                const updatedAt = s.lastUpdatedAt || '—'
                return (
                  <tr
                    key={s.ticker}
                    className={`table-row-clickable ${tradeForm.stockTicker === s.ticker ? 'row-selected' : ''}`}
                    onClick={() => selectStock(s.ticker)}
                  >
                    <td><span className="ticker-badge">{s.ticker}</span></td>
                    <td className={`text-right price-cell ${priceCls}`}>
                      {arrow && <span className="price-arrow">{arrow}</span>}
                      ${Number(s.currentPrice).toFixed(2)}
                    </td>
                    <td className={`text-right ${tradeCls}`}>
                      {s.lastTradePrice
                        ? `${s.lastTradeType} $${Number(s.lastTradePrice).toFixed(2)}`
                        : '—'}
                    </td>
                    <td className="text-right">
                      {s.lastTradeValue ? `$${Number(s.lastTradeValue).toFixed(2)}` : '—'}
                    </td>
                    <td className="text-muted text-sm">{updatedAt}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Trade form */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Place Order</h2>
          </div>
          {tradeMsg && (
            <div className={`alert ${tradeMsg.type === 'success' ? 'alert-success' : 'alert-error'}`}>
              {tradeMsg.text}
            </div>
          )}
          <form onSubmit={submitTrade} className="trade-form">
            <div className="form-group">
              <label className="form-label">Stock</label>
              <select
                className="form-input"
                value={tradeForm.stockTicker}
                onChange={e => setTradeForm(f => ({ ...f, stockTicker: e.target.value }))}
              >
                {stocks.map(s => (
                  <option key={s.ticker} value={s.ticker}>
                    {s.ticker} — ${Number(s.currentPrice).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input
                className="form-input"
                type="number"
                min="1"
                value={tradeForm.quantity}
                onChange={e => setTradeForm(f => ({ ...f, quantity: Number(e.target.value) }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Order Type</label>
              <div className="type-toggle">
                <button
                  type="button"
                  className={`type-btn ${tradeForm.type === 'BUY' ? 'type-btn-buy-active' : 'type-btn-inactive'}`}
                  onClick={() => setTradeForm(f => ({ ...f, type: 'BUY' }))}
                >
                  ▲ BUY
                </button>
                <button
                  type="button"
                  className={`type-btn ${tradeForm.type === 'SELL' ? 'type-btn-sell-active' : 'type-btn-inactive'}`}
                  onClick={() => setTradeForm(f => ({ ...f, type: 'SELL' }))}
                >
                  ▼ SELL
                </button>
              </div>
            </div>

            {stocks.length > 0 && (
              <div className="order-summary">
                <span className="summary-label">Estimated Total</span>
                <span className="summary-value">
                  ${(Number(stocks.find(s => s.ticker === tradeForm.stockTicker)?.currentPrice || 0) * tradeForm.quantity).toFixed(2)}
                </span>
              </div>
            )}

            <button
              type="submit"
              className={`btn-full ${tradeForm.type === 'BUY' ? 'btn-buy' : 'btn-sell'}`}
              disabled={tradeLoading}
            >
              {tradeLoading ? 'Submitting…' : `${tradeForm.type === 'BUY' ? '▲ Buy' : '▼ Sell'} ${tradeForm.quantity} × ${tradeForm.stockTicker}`}
            </button>
          </form>
        </div>
      </div>

      {/* Tabbed card: Portfolio | Order History */}
      <div className="card">
        <div className="card-header">
          <div className="tabs">
            <button
              className={`tab-btn ${activeTab === 'portfolio' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('portfolio')}
            >
              Portfolio
            </button>
            <button
              className={`tab-btn ${activeTab === 'orders' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              Order History
            </button>
          </div>
          {activeTab === 'portfolio'
            ? <button className="btn-ghost" onClick={() => { loadPortfolio(); loadOrders() }}>Refresh</button>
            : <button className="btn-ghost" onClick={loadOrders}>Refresh</button>
          }
        </div>

        {activeTab === 'portfolio' && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th className="text-right">Shares</th>
                  <th className="text-right">Current Price</th>
                  <th className="text-right">Market Value</th>
                  <th className="text-right">Avg Cost</th>
                  <th className="text-right">Unrealized P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.length === 0 && (
                  <tr><td colSpan={6} className="empty-row">No positions yet.</td></tr>
                )}
                {portfolio.map(p => {
                  const currentPrice = Number(stocks.find(s => s.ticker === p.stockTicker)?.currentPrice || 0)
                  const shares = p.quantity

                  const completedBuys = orders.filter(
                    o => o.stockTicker === p.stockTicker && o.type === 'BUY' && o.status === 'COMPLETED'
                  )
                  const totalBuyQty  = completedBuys.reduce((s, o) => s + o.quantity, 0)
                  const totalBuyCost = completedBuys.reduce((s, o) => s + Number(o.price) * o.quantity, 0)
                  const avgCost      = totalBuyQty > 0 ? totalBuyCost / totalBuyQty : null

                  const marketValue  = currentPrice * shares
                  const pnl          = avgCost !== null ? marketValue - shares * avgCost : null
                  const pnlCls       = pnl === null ? '' : pnl >= 0 ? 'pnl-positive' : 'pnl-negative'
                  const pnlSign      = pnl !== null && pnl > 0 ? '+' : ''

                  return (
                    <tr key={p.stockTicker}>
                      <td><span className="ticker-badge">{p.stockTicker}</span></td>
                      <td className="text-right">{shares.toLocaleString()}</td>
                      <td className="text-right">${currentPrice.toFixed(2)}</td>
                      <td className="text-right">${marketValue.toFixed(2)}</td>
                      <td className="text-right">{avgCost !== null ? `$${avgCost.toFixed(2)}` : '—'}</td>
                      <td className={`text-right ${pnlCls}`}>
                        {pnl !== null ? `${pnlSign}$${pnl.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ticker</th>
                  <th>Type</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr><td colSpan={6} className="empty-row">No orders yet.</td></tr>
                )}
                {orders.map(o => {
                  const meta = STATUS_META[o.status] || { label: o.status, cls: '' }
                  return (
                    <tr key={o.id}>
                      <td className="text-muted">{o.id}</td>
                      <td><span className="ticker-badge">{o.stockTicker}</span></td>
                      <td className={o.type === 'BUY' ? 'type-buy' : 'type-sell'}>{o.type}</td>
                      <td className="text-right">{o.quantity}</td>
                      <td className="text-right">${Number(o.price).toFixed(2)}</td>
                      <td><span className={`badge ${meta.cls}`}>{meta.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live Activity */}
      <div className="card activity-card">
        <div className="card-header">
          <h2 className="card-title">Live Activity</h2>
          <span className={`live-dot ${wsConnected ? 'live-dot-on' : 'live-dot-off'}`} />
        </div>
        <ul className="activity-list">
          {activity.length === 0 && <li className="activity-empty">Waiting for events…</li>}
          {activity.map((msg, i) => <li key={i} className="activity-item">{msg}</li>)}
        </ul>
      </div>
    </div>
  )
}