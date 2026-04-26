import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { authHeaders, bookApi, orderApi, paymentApi, priceApi } from '../api'
import { useAuth } from '../context/AuthContext'

const STATUS_META = {
  OPEN:             { label: 'Open',         cls: 'badge-open'    },
  PARTIALLY_FILLED: { label: 'Partial Fill', cls: 'badge-warning' },
  FILLED:           { label: 'Filled',       cls: 'badge-success' },
  CANCELLED:        { label: 'Cancelled',    cls: 'badge-neutral' },
  REJECTED:         { label: 'Rejected',     cls: 'badge-danger'  },
}

const INITIAL_FORM = {
  stockTicker: 'ABC',
  quantity: 1,
  type: 'BUY',
  orderMode: 'LIMIT',
  limitPrice: '',
}

function fmt$(n)    { return `$${Number(n).toFixed(2)}` }
function fmtTime(ms) {
  if (!ms) return '—'
  return new Date(ms).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function DashboardPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const headers = authHeaders(token)

  const [stocks, setStocks]             = useState([])
  const [priceDirs, setPriceDirs]       = useState({})
  const [portfolio, setPortfolio]       = useState([])
  const [orders, setOrders]             = useState([])
  const [trades, setTrades]             = useState([])
  const [ipoPurchases, setIpoPurchases] = useState([])
  const [balance, setBalance]           = useState(null)
  const [wsConnected, setWsConnected]   = useState(false)
  const [activity, setActivity]         = useState([])
  const [activeTab, setActiveTab]       = useState('portfolio')
  const [orderFilter, setOrderFilter]   = useState('open')
  const [tradeForm, setTradeForm]       = useState(INITIAL_FORM)
  const [tradeLoading, setTradeLoading] = useState(false)
  const [tradeMsg, setTradeMsg]         = useState(null)
  const [cancelling, setCancelling]     = useState(null)
  const [orderBook, setOrderBook]       = useState(null)
  const [marketTrades, setMarketTrades] = useState([])
  const prevPricesRef  = useRef({})
  const tradeMsgTimer  = useRef(null)

  function pushActivity(msg) {
    setActivity(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 30))
  }

  async function loadStocks()    { const r = await priceApi.get('/stocks'); setStocks(r.data) }
  async function loadPortfolio() { const r = await orderApi.get('/portfolio', { headers }); setPortfolio(r.data) }
  async function loadOrders()    { const r = await orderApi.get('', { headers }); setOrders(r.data) }
  async function loadTrades()    { const r = await orderApi.get('/trades', { headers }); setTrades(r.data) }
  async function loadIpoPurchases() { const r = await orderApi.get('/ipo-purchases', { headers }); setIpoPurchases(r.data) }
  async function loadBalance()   { const r = await paymentApi.get('/wallet', { headers }); setBalance(r.data.balance) }
  async function loadMarketTrades() { const r = await orderApi.get('/market/trades'); setMarketTrades(r.data) }
  async function loadOrderBook(ticker) {
    try { const r = await bookApi.get(`/${ticker}`); setOrderBook(r.data) }
    catch { setOrderBook({ ticker, bids: [], asks: [] }) }
  }

  function loadAll() {
    loadStocks(); loadPortfolio(); loadOrders(); loadTrades(); loadIpoPurchases(); loadBalance(); loadMarketTrades()
  }

  useEffect(() => { loadAll(); loadOrderBook(tradeForm.stockTicker) }, [])

  // Reload order book whenever selected ticker changes
  useEffect(() => { loadOrderBook(tradeForm.stockTicker) }, [tradeForm.stockTicker])

  // WebSocket: live price feed
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
                pushActivity(`${s.ticker} ${arrow} ${fmt$(s.currentPrice)} — trade executed`)
                // Delay so Kafka consumer has time to commit the trade
                setTimeout(() => {
                  loadOrders(); loadPortfolio(); loadTrades(); loadIpoPurchases()
                  loadBalance(); loadMarketTrades()
                }, 600)
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
      onStompError:  () => setWsConnected(false),
    })
    client.activate()
    return () => client.deactivate()
  }, [])

  // Auto-fill limit price when stocks first load
  useEffect(() => {
    if (stocks.length > 0 && !tradeForm.limitPrice) {
      const stock = stocks.find(s => s.ticker === tradeForm.stockTicker)
      if (stock) setTradeForm(f => ({ ...f, limitPrice: Number(stock.currentPrice).toFixed(2) }))
    }
  }, [stocks])

  // ── Helpers ────────────────────────────────────────────────────────────────
  function selectStock(ticker) {
    const stock = stocks.find(s => s.ticker === ticker)
    setTradeForm(f => ({
      ...f,
      stockTicker: ticker,
      limitPrice:  stock ? Number(stock.currentPrice).toFixed(2) : f.limitPrice,
    }))
  }

  function openTickerHistory(ticker) {
    navigate(`/portfolio/${encodeURIComponent(ticker)}`)
  }

  function showMsg(msg) {
    setTradeMsg(msg)
    if (tradeMsgTimer.current) clearTimeout(tradeMsgTimer.current)
    if (msg) tradeMsgTimer.current = setTimeout(() => setTradeMsg(null), 5000)
  }

  // Clicking an order-book price level pre-fills the trade form
  function fillFromBook(price, side) {
    setTradeForm(f => ({
      ...f,
      type:       side === 'ask' ? 'BUY' : 'SELL',
      orderMode:  'LIMIT',
      limitPrice: Number(price).toFixed(2),
    }))
  }

  async function submitTrade(e) {
    e.preventDefault()
    showMsg(null)
    setTradeLoading(true)
    try {
      const payload = {
        stockTicker: tradeForm.stockTicker,
        quantity:    tradeForm.quantity,
        type:        tradeForm.type,
        orderMode:   tradeForm.orderMode,
        limitPrice:  tradeForm.orderMode === 'LIMIT' ? Number(tradeForm.limitPrice) : null,
      }
      await orderApi.post('', payload, { headers })
      const modeLabel = tradeForm.orderMode === 'LIMIT'
        ? `Limit @ ${fmt$(tradeForm.limitPrice)}`
        : 'Market'
      pushActivity(`${tradeForm.type} ${modeLabel} — ${tradeForm.quantity}× ${tradeForm.stockTicker}`)
      showMsg({
        type: 'success',
        text: `${tradeForm.type} order placed: ${tradeForm.quantity}× ${tradeForm.stockTicker} (${modeLabel})`,
      })
      setTradeForm(f => ({ ...f, quantity: 1 }))
      setTimeout(() => { loadAll(); loadOrderBook(tradeForm.stockTicker) }, 800)
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message
        || err.response?.data || 'Order failed.'
      showMsg({ type: 'error', text: String(msg) })
    } finally {
      setTradeLoading(false)
    }
  }

  async function cancelOrder(orderId) {
    setCancelling(orderId)
    try {
      await orderApi.delete(`/${orderId}`, { headers })
      pushActivity(`Order #${orderId} cancelled`)
      loadOrders(); loadOrderBook(tradeForm.stockTicker)
    } catch (err) {
      alert(err.response?.data?.error || 'Cancel failed.')
    } finally {
      setCancelling(null)
    }
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const currentStock   = stocks.find(s => s.ticker === tradeForm.stockTicker)
  const estimatedTotal = tradeForm.orderMode === 'LIMIT'
    ? (Number(tradeForm.limitPrice) || 0) * tradeForm.quantity
    : (Number(currentStock?.currentPrice) || 0) * tradeForm.quantity

  const openOrders = orders.filter(o => o.status === 'OPEN' || o.status === 'PARTIALLY_FILLED')
  const openCount  = openOrders.length

  // Set of my order IDs for fast lookups (still used for trade history labelling)
  const myOrderIds = new Set(orders.map(o => o.id))

  // Portfolio rows: avgCostBasis is stored server-side and updated on every buy
  // (IPO purchase at IPO price, secondary trade at execution price — weighted average).
  const portfolioRows = portfolio.map(p => {
    const stock        = stocks.find(s => s.ticker === p.stockTicker)
    const currentPrice = stock ? Number(stock.currentPrice) : null
    const avgCost      = p.avgCostBasis != null ? Number(p.avgCostBasis) : null
    const mktVal       = currentPrice != null ? currentPrice * p.quantity : null
    const pnl          = mktVal != null && avgCost != null ? mktVal - p.quantity * avgCost : null
    const pnlPct       = avgCost != null && avgCost > 0 && currentPrice != null
      ? ((currentPrice - avgCost) / avgCost) * 100 : null
    return { ...p, currentPrice, avgCost, mktVal, pnl, pnlPct }
  })

  const totalMktVal = portfolioRows.reduce((s, p) => s + (p.mktVal ?? 0), 0)
  const totalPnl    = portfolioRows.reduce((s, p) => s + (p.pnl ?? 0), 0)

  // Filtered orders list for Orders tab
  const filteredOrders = orderFilter === 'open'
    ? orders.filter(o => o.status === 'OPEN' || o.status === 'PARTIALLY_FILLED')
    : orderFilter === 'history'
    ? orders.filter(o => !['OPEN', 'PARTIALLY_FILLED'].includes(o.status))
    : orders

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page">

      {/* ── Stats Row ─────────────────────────────────────────────────────── */}
      <div className="stats-row">
        <Link to="/wallet" className="stat-card stat-card-link">
          <span className="stat-label">Wallet Balance</span>
          <span className="stat-value">{balance === null ? '…' : fmt$(balance)}</span>
        </Link>
        <div className="stat-card">
          <span className="stat-label">Portfolio Value</span>
          <span className="stat-value">{totalMktVal > 0 ? fmt$(totalMktVal) : '—'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Unrealized P&L</span>
          <span className={`stat-value ${totalPnl > 0 ? 'pnl-positive' : totalPnl < 0 ? 'pnl-negative' : ''}`}>
            {totalPnl !== 0 ? `${totalPnl > 0 ? '+' : ''}${fmt$(totalPnl)}` : '—'}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Open Orders</span>
          <span className="stat-value">{openCount}</span>
        </div>
        <div className={`stat-card ${wsConnected ? 'stat-card-live' : 'stat-card-offline'}`}>
          <span className="stat-label">Live Feed</span>
          <span className="stat-value-sm">
            <span className={`live-dot ${wsConnected ? 'live-dot-on' : 'live-dot-off'}`} />
            {wsConnected ? 'Connected' : 'Offline'}
          </span>
        </div>
      </div>

      {/* ── Market Prices + Trade Form ─────────────────────────────────────── */}
      <div className="dash-grid">

        {/* Market Prices */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Market Prices</h2>
            <span className="card-hint">Click a row to select stock</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th className="text-right">Last Price</th>
                <th className="text-right">Last Trade</th>
                <th className="text-right">Trade Value</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {stocks.length === 0 && <tr><td colSpan={5} className="empty-row">Loading…</td></tr>}
              {stocks.map(s => {
                const dir      = priceDirs[s.ticker] || 'neutral'
                const arrow    = dir === 'up' ? '▲' : dir === 'down' ? '▼' : ''
                const priceCls = dir === 'up' ? 'price-up' : dir === 'down' ? 'price-down' : ''
                const myPos    = portfolio.find(p => p.stockTicker === s.ticker)
                return (
                  <tr key={s.ticker}
                    className={`table-row-clickable ${tradeForm.stockTicker === s.ticker ? 'row-selected' : ''}`}
                    onClick={() => selectStock(s.ticker)}>
                    <td>
                      <span className="ticker-badge">{s.ticker}</span>
                      {myPos && <span className="pos-chip">{myPos.quantity} shares</span>}
                    </td>
                    <td className={`text-right price-cell ${priceCls}`}>
                      {arrow && <span className="price-arrow">{arrow}</span>}
                      {fmt$(s.currentPrice)}
                    </td>
                    <td className="text-right text-muted">
                      {s.lastTradePrice ? fmt$(s.lastTradePrice) : '—'}
                    </td>
                    <td className="text-right text-muted">
                      {s.lastTradeValue ? fmt$(s.lastTradeValue) : '—'}
                    </td>
                    <td className="text-muted text-sm">{s.lastUpdatedAt || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Trade Form */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Place Order</h2>
            {currentStock && (
              <span className="card-hint">{currentStock.ticker} @ {fmt$(currentStock.currentPrice)}</span>
            )}
          </div>
          {tradeMsg && (
            <div className={`alert ${tradeMsg.type === 'success' ? 'alert-success' : 'alert-error'}`}>
              {tradeMsg.text}
            </div>
          )}
          <form onSubmit={submitTrade} className="trade-form">
            {/* BUY / SELL */}
            <div className="type-toggle">
              {['BUY', 'SELL'].map(t => (
                <button key={t} type="button"
                  className={`type-btn ${tradeForm.type === t
                    ? (t === 'BUY' ? 'type-btn-buy-active' : 'type-btn-sell-active')
                    : 'type-btn-inactive'}`}
                  onClick={() => setTradeForm(f => ({ ...f, type: t }))}>
                  {t === 'BUY' ? '▲ BUY' : '▼ SELL'}
                </button>
              ))}
            </div>

            {/* LIMIT / MARKET */}
            <div className="type-toggle">
              {['LIMIT', 'MARKET'].map(m => (
                <button key={m} type="button"
                  className={`type-btn ${tradeForm.orderMode === m ? 'type-btn-mode-active' : 'type-btn-inactive'}`}
                  onClick={() => setTradeForm(f => ({ ...f, orderMode: m }))}>
                  {m}
                </button>
              ))}
            </div>

            <div className="form-group">
              <label className="form-label">Stock</label>
              <select className="form-input" value={tradeForm.stockTicker}
                onChange={e => selectStock(e.target.value)}>
                {stocks.map(s => (
                  <option key={s.ticker} value={s.ticker}>
                    {s.ticker} — {fmt$(s.currentPrice)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input className="form-input" type="number" min="1" value={tradeForm.quantity}
                  onChange={e => setTradeForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
              </div>
              {tradeForm.orderMode === 'LIMIT' && (
                <div className="form-group">
                  <label className="form-label">Limit Price ($)</label>
                  <input className="form-input" type="number" min="0.01" step="0.01"
                    value={tradeForm.limitPrice}
                    onChange={e => setTradeForm(f => ({ ...f, limitPrice: e.target.value }))}
                    placeholder="0.00" />
                </div>
              )}
            </div>

            {tradeForm.orderMode === 'LIMIT' && tradeForm.limitPrice && (
              <span className="form-hint">
                {tradeForm.type === 'BUY'
                  ? `Fills only when ask ≤ ${fmt$(tradeForm.limitPrice)}`
                  : `Fills only when bid ≥ ${fmt$(tradeForm.limitPrice)}`}
              </span>
            )}
            {tradeForm.orderMode === 'MARKET' && (
              <div className="info-box" style={{ fontSize: 12 }}>
                Market order matches immediately at the best available price.
                Unmatched remainder is automatically cancelled.
              </div>
            )}

            <div className="order-summary">
              <div className="summary-row">
                <span className="summary-label">
                  {tradeForm.orderMode === 'LIMIT' ? 'Max order value' : 'Estimated value'}
                </span>
                <span className="summary-value font-med">{fmt$(estimatedTotal)}</span>
              </div>
              {tradeForm.type === 'BUY' && balance !== null && (
                <div className="summary-row">
                  <span className="summary-label">Balance after</span>
                  <span className={`summary-value ${Number(balance) - estimatedTotal < 0 ? 'pnl-negative' : 'text-muted'}`}>
                    {fmt$(Number(balance) - estimatedTotal)}
                  </span>
                </div>
              )}
              {tradeForm.type === 'SELL' && (() => {
                const pos   = portfolio.find(p => p.stockTicker === tradeForm.stockTicker)
                const avail = pos?.quantity ?? 0
                return (
                  <div className="summary-row">
                    <span className="summary-label">Shares you own</span>
                    <span className={`summary-value ${tradeForm.quantity > avail ? 'pnl-negative' : 'text-muted'}`}>
                      {avail}{tradeForm.quantity > avail ? ' (insufficient)' : ''}
                    </span>
                  </div>
                )
              })()}
            </div>

            <button type="submit"
              className={`btn-full ${tradeForm.type === 'BUY' ? 'btn-buy' : 'btn-sell'}`}
              disabled={tradeLoading || (tradeForm.orderMode === 'LIMIT' && !tradeForm.limitPrice)}>
              {tradeLoading
                ? 'Submitting…'
                : `${tradeForm.type === 'BUY' ? '▲' : '▼'} ${tradeForm.orderMode} ${tradeForm.type} — ${tradeForm.quantity}× ${tradeForm.stockTicker}`}
            </button>
          </form>
        </div>
      </div>

      {/* ── Order Book + Market Trade Feed ────────────────────────────────── */}
      <div className="dash-grid-equal">

        {/* Order Book */}
        <div className="card" style={{ padding: 0 }}>
          <div className="card-header" style={{ padding: '14px 16px' }}>
            <div>
              <h2 className="card-title">Order Book — {tradeForm.stockTicker}</h2>
              <span className="card-hint" style={{ display: 'block', marginTop: 2 }}>
                Click a price to pre-fill the order form
              </span>
            </div>
            <button className="btn-ghost" onClick={() => loadOrderBook(tradeForm.stockTicker)}>↺</button>
          </div>
          {!orderBook ? (
            <div className="book-empty">Loading…</div>
          ) : (
            <div className="book-container">
              {/* Asks — reversed so lowest (best) ask is closest to spread */}
              <div className="book-side">
                <div className="book-side-header book-asks-header">SELL — Asks</div>
                <div className="book-cols-header">
                  <span>Price</span><span>Quantity</span><span>Orders</span>
                </div>
                {orderBook.asks.length === 0
                  ? <div className="book-empty">No sell orders resting</div>
                  : [...orderBook.asks].reverse().map((lvl, i) => {
                      const maxQty = Math.max(...orderBook.asks.map(l => l.quantity), 1)
                      return (
                        <div key={i} className="book-row book-row-ask book-row-clickable"
                          style={{ '--bar-pct': `${Math.round(lvl.quantity / maxQty * 100)}%` }}
                          onClick={() => fillFromBook(lvl.price, 'ask')}
                          title={`Click → BUY at ${fmt$(lvl.price)}`}>
                          <span className="book-price">{fmt$(lvl.price)}</span>
                          <span className="book-qty">{lvl.quantity.toLocaleString()}</span>
                          <span className="book-orders">{lvl.orders}</span>
                        </div>
                      )
                    })
                }
              </div>

              {/* Spread indicator */}
              {orderBook.bids.length > 0 && orderBook.asks.length > 0 ? (
                <div className="book-spread">
                  Spread: {fmt$(Number(orderBook.asks[0].price) - Number(orderBook.bids[0].price))}
                  &nbsp;·&nbsp;
                  Mid: {fmt$((Number(orderBook.asks[0].price) + Number(orderBook.bids[0].price)) / 2)}
                </div>
              ) : (
                <div className="book-spread" style={{ color: 'var(--text-muted)' }}>
                  — no spread: book is one-sided —
                </div>
              )}

              {/* Bids */}
              <div className="book-side">
                <div className="book-side-header book-bids-header">BUY — Bids</div>
                <div className="book-cols-header">
                  <span>Price</span><span>Quantity</span><span>Orders</span>
                </div>
                {orderBook.bids.length === 0
                  ? <div className="book-empty">No buy orders resting</div>
                  : orderBook.bids.map((lvl, i) => {
                      const maxQty = Math.max(...orderBook.bids.map(l => l.quantity), 1)
                      return (
                        <div key={i} className="book-row book-row-bid book-row-clickable"
                          style={{ '--bar-pct': `${Math.round(lvl.quantity / maxQty * 100)}%` }}
                          onClick={() => fillFromBook(lvl.price, 'bid')}
                          title={`Click → SELL at ${fmt$(lvl.price)}`}>
                          <span className="book-price">{fmt$(lvl.price)}</span>
                          <span className="book-qty">{lvl.quantity.toLocaleString()}</span>
                          <span className="book-orders">{lvl.orders}</span>
                        </div>
                      )
                    })
                }
              </div>
            </div>
          )}
        </div>

        {/* Recent Market Trades */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Market Trades</h2>
            <button className="btn-ghost" onClick={loadMarketTrades}>↺</button>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Value</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {marketTrades.length === 0 && (
                  <tr><td colSpan={5} className="empty-row">No trades executed yet.</td></tr>
                )}
                {marketTrades.map(t => {
                  const isMine = myOrderIds.has(t.buyOrderId) || myOrderIds.has(t.sellOrderId)
                  return (
                    <tr key={t.id} className={isMine ? 'row-mine' : ''}>
                      <td>
                        <span className="ticker-badge">{t.ticker}</span>
                        {isMine && <span className="mine-chip">You</span>}
                      </td>
                      <td className="text-right font-med">{fmt$(t.price)}</td>
                      <td className="text-right">{t.quantity.toLocaleString()}</td>
                      <td className="text-right">{fmt$(t.value)}</td>
                      <td className="text-muted text-sm">
                        {new Date(t.executedAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Portfolio / Orders / My Trades ────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <div className="tabs">
            {[
              { key: 'portfolio', label: `Portfolio (${portfolio.length})` },
              { key: 'orders',    label: openCount > 0 ? `Orders · ${openCount} open` : 'Orders' },
              { key: 'trades',    label: `My Trades (${trades.length + ipoPurchases.length})` },
            ].map(t => (
              <button key={t.key}
                className={`tab-btn ${activeTab === t.key ? 'tab-btn-active' : ''}`}
                onClick={() => setActiveTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
          <button className="btn-ghost" onClick={loadAll}>↺ Refresh</button>
        </div>

        {/* ── Portfolio tab ─────────────────────────────────── */}
        {activeTab === 'portfolio' && (
          portfolioRows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <p className="empty-state-title">No positions yet</p>
              <p className="empty-state-sub">
                Place a BUY order above to start building your portfolio.
              </p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th className="text-right">Shares</th>
                    <th className="text-right">Avg Cost</th>
                    <th className="text-right">Mkt Price</th>
                    <th className="text-right">Market Value</th>
                    <th className="text-right">P&amp;L ($)</th>
                    <th className="text-right">P&amp;L (%)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioRows.map(p => {
                    const pnlCls = p.pnl === null ? '' : p.pnl >= 0 ? 'pnl-positive' : 'pnl-negative'
                    return (
                      <tr key={p.stockTicker}
                        className="table-row-clickable"
                        role="button"
                        tabIndex={0}
                        title={`View ${p.stockTicker} transaction history`}
                        onClick={() => openTickerHistory(p.stockTicker)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            openTickerHistory(p.stockTicker)
                          }
                        }}>
                        <td><span className="ticker-badge">{p.stockTicker}</span></td>
                        <td className="text-right">{p.quantity.toLocaleString()}</td>
                        <td className="text-right text-muted">
                          {p.avgCost != null ? fmt$(p.avgCost) : '—'}
                        </td>
                        <td className="text-right">{p.currentPrice != null ? fmt$(p.currentPrice) : '—'}</td>
                        <td className="text-right font-med">{p.mktVal != null ? fmt$(p.mktVal) : '—'}</td>
                        <td className={`text-right font-med ${pnlCls}`}>
                          {p.pnl != null ? `${p.pnl >= 0 ? '+' : ''}${fmt$(p.pnl)}` : '—'}
                        </td>
                        <td className={`text-right ${pnlCls}`}>
                          {p.pnlPct != null
                            ? `${p.pnlPct >= 0 ? '+' : ''}${p.pnlPct.toFixed(2)}%`
                            : '—'}
                        </td>
                        <td>
                          <button className="btn-sell-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setTradeForm(f => ({
                                ...f,
                                type:        'SELL',
                                stockTicker: p.stockTicker,
                                limitPrice:  p.currentPrice != null ? p.currentPrice.toFixed(2) : '',
                                orderMode:   'LIMIT',
                                quantity:    1,
                              }))
                            }}
                          >
                            Sell
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="table-total-row">
                    <td colSpan={4}><strong>Total</strong></td>
                    <td className="text-right"><strong>{fmt$(totalMktVal)}</strong></td>
                    <td className={`text-right ${totalPnl > 0 ? 'pnl-positive' : totalPnl < 0 ? 'pnl-negative' : ''}`}>
                      <strong>
                        {totalPnl !== 0 ? `${totalPnl > 0 ? '+' : ''}${fmt$(totalPnl)}` : '—'}
                      </strong>
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        )}

        {/* ── Orders tab ────────────────────────────────────── */}
        {activeTab === 'orders' && (
          <>
            <div className="filter-bar">
              {[
                { key: 'open',    label: `Open (${openCount})` },
                { key: 'history', label: 'History' },
                { key: 'all',     label: `All (${orders.length})` },
              ].map(f => (
                <button key={f.key}
                  className={`filter-btn ${orderFilter === f.key ? 'filter-btn-active' : ''}`}
                  onClick={() => setOrderFilter(f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
            {filteredOrders.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">{orderFilter === 'open' ? '⏳' : '📋'}</div>
                <p className="empty-state-title">
                  {orderFilter === 'open' ? 'No open orders' : 'Nothing here yet'}
                </p>
                <p className="empty-state-sub">
                  {orderFilter === 'open'
                    ? 'LIMIT orders waiting to be matched will appear here. You can cancel them any time.'
                    : 'Filled and cancelled orders will appear here once you start trading.'}
                </p>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Ticker</th>
                      <th>Side</th>
                      <th>Mode</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Filled</th>
                      <th className="text-right">Price</th>
                      <th>Status</th>
                      <th>Placed</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map(o => {
                      const meta      = STATUS_META[o.status] || { label: o.status, cls: '' }
                      const canCancel = o.status === 'OPEN' || o.status === 'PARTIALLY_FILLED'
                      const fillPct   = o.quantity > 0
                        ? Math.round((o.filledQuantity / o.quantity) * 100) : 0
                      const priceCol  = o.avgFillPrice
                        ? `${fmt$(o.avgFillPrice)} avg`
                        : o.limitPrice ? fmt$(o.limitPrice) : 'Market'
                      return (
                        <tr key={o.id}>
                          <td className="text-muted text-sm">#{o.id}</td>
                          <td><span className="ticker-badge">{o.stockTicker}</span></td>
                          <td className={o.type === 'BUY' ? 'type-buy' : 'type-sell'}>{o.type}</td>
                          <td className="text-muted text-sm">{o.orderMode}</td>
                          <td className="text-right">{o.quantity}</td>
                          <td className="text-right">
                            <div className="fill-cell">
                              <span>{o.filledQuantity}/{o.quantity}</span>
                              {o.filledQuantity > 0 && o.filledQuantity < o.quantity && (
                                <div className="fill-bar">
                                  <div className="fill-bar-inner" style={{ width: `${fillPct}%` }} />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="text-right text-sm">{priceCol}</td>
                          <td><span className={`badge ${meta.cls}`}>{meta.label}</span></td>
                          <td className="text-muted text-sm">{fmtTime(o.createdAt)}</td>
                          <td>
                            {canCancel && (
                              <button className="btn-delete-sm"
                                disabled={cancelling === o.id}
                                onClick={() => cancelOrder(o.id)}>
                                {cancelling === o.id ? '…' : 'Cancel'}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── My Trades tab ─────────────────────────────────── */}
        {activeTab === 'trades' && (() => {
          // Merge secondary market trades and IPO purchases into one chronological list
          const allTxns = [
            ...trades.map(t => ({
              key:       t.id,
              ticker:    t.ticker,
              market:    'secondary',
              side:      myOrderIds.has(t.buyOrderId) ? 'BUY' : 'SELL',
              qty:       t.quantity,
              price:     t.price,
              value:     t.value,
              ts:        t.executedAt,
              counterpart: myOrderIds.has(t.buyOrderId) ? t.sellOrderId : t.buyOrderId,
            })),
            ...ipoPurchases.map(p => ({
              key:       `ipo-${p.id}`,
              ticker:    p.ticker,
              market:    'ipo',
              side:      'BUY',
              qty:       p.quantity,
              price:     p.pricePerShare,
              value:     p.totalValue,
              ts:        p.purchasedAt,
              counterpart: null,
            })),
          ].sort((a, b) => b.ts - a.ts)

          if (allTxns.length === 0) return (
            <div className="empty-state">
              <div className="empty-state-icon">⚡</div>
              <p className="empty-state-title">No transactions yet</p>
              <p className="empty-state-sub">
                IPO purchases and matched secondary market trades will appear here.
              </p>
            </div>
          )
          return (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Type</th>
                    <th>Side</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Total Value</th>
                    <th>Counterpart</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {allTxns.map(t => (
                    <tr key={t.key}>
                      <td><span className="ticker-badge">{t.ticker}</span></td>
                      <td className="text-muted text-sm">
                        {t.market === 'ipo' ? 'IPO' : 'Secondary'}
                      </td>
                      <td className={t.side === 'BUY' ? 'type-buy' : 'type-sell'}>
                        {t.side === 'BUY' ? '▲ Bought' : '▼ Sold'}
                      </td>
                      <td className="text-right">{t.qty.toLocaleString()}</td>
                      <td className="text-right font-med">{fmt$(t.price)}</td>
                      <td className="text-right">{fmt$(t.value)}</td>
                      <td className="text-muted text-sm">
                        {t.counterpart != null ? `Order #${t.counterpart}` : '—'}
                      </td>
                      <td className="text-muted text-sm">{fmtTime(t.ts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })()}
      </div>

      {/* ── Live Activity ──────────────────────────────────────────────────── */}
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
