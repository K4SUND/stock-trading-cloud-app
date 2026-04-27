import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { authHeaders, bookApi, companyApi, orderApi, paymentApi, priceApi } from '../api'
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

const INSIGHT_RANGES = ['1D', '1W', '1M', '3M', '1Y', 'ALL']

function fmtPointTime(ts) {
  if (!ts) return 'IPO / Listing start'
  return new Date(ts).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function TickerSparkline({ data = [], width = 520, height = 200, color = '#2563eb', pointRadius = 3 }) {
  const [hovered, setHovered] = useState(null)

  if (!data || data.length < 2) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height: height, color:'#64748b', fontSize:13 }}>
        Not enough trade data for this range.
      </div>
    )
  }

  const normalized = data.map((d, i) => {
    const price = Number(typeof d === 'number' ? d : d.price)
    const timestamp = typeof d === 'number' ? null : (d.timestamp || null)
    const prev = i > 0 ? Number(typeof data[i - 1] === 'number' ? data[i - 1] : data[i - 1].price) : price
    const change = i > 0 ? price - prev : 0
    return { price, timestamp, change }
  })

  const prices = normalized.map(p => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const span = max - min || 1
  const pad = { top: 12, bottom: 24, left: 8, right: 8 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  const plotted = normalized.map((p, i) => {
    const x = pad.left + (i / (normalized.length - 1)) * innerW
    const y = pad.top + innerH - ((p.price - min) / span) * innerH
    return { ...p, x, y, i }
  })

  const line = plotted.map(p => `${p.x},${p.y}`).join(' ')
  const areaBottom = pad.top + innerH
  const area = `${plotted[0].x},${areaBottom} ` + plotted.map(p => `${p.x},${p.y}`).join(' ') + ` ${plotted[plotted.length-1].x},${areaBottom}`
  const changed = plotted.filter((p, idx) => idx > 0 && Math.abs(p.change) > 0.000001)
  const isDown = color === '#ef4444' || color === '#dc2626'
  const gradId = `grad-${Math.abs(color.charCodeAt(1))}`

  return (
    <div style={{ position:'relative', width:'100%' }} onMouseLeave={() => setHovered(null)}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display:'block' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18"/>
            <stop offset="100%" stopColor={color} stopOpacity="0.01"/>
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#${gradId})`} />
        <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {changed.map(p => (
          <circle
            key={`chg-${p.i}`} cx={p.x} cy={p.y} r={pointRadius}
            fill={p.change >= 0 ? '#16a34a' : '#ef4444'}
            stroke="#0f172a" strokeWidth="1.5"
            style={{ cursor:'pointer' }}
            onMouseEnter={() => setHovered(p)}
          />
        ))}
        {/* Y-axis labels */}
        <text x={pad.left} y={pad.top + 10} fill="#64748b" fontSize="10" fontFamily="'JetBrains Mono', monospace">${max.toFixed(2)}</text>
        <text x={pad.left} y={pad.top + innerH} fill="#64748b" fontSize="10" fontFamily="'JetBrains Mono', monospace">${min.toFixed(2)}</text>
      </svg>
      {hovered && (
        <div style={{
          position:'absolute',
          left: Math.min(Math.max((hovered.x / width) * 100 + 2, 1), 65) + '%',
          top: Math.max((hovered.y / height) * 100 - 18, 0) + '%',
          minWidth: 170,
          background:'#0f172a',
          color:'#f8fafc',
          fontSize:11,
          borderRadius:8,
          padding:'8px 12px',
          border:'1px solid #1e293b',
          boxShadow:'0 12px 28px rgba(0,0,0,.4)',
          pointerEvents:'none',
          zIndex:10,
          fontFamily:"'JetBrains Mono', monospace",
        }}>
          <div style={{ fontFamily:'DM Sans, sans-serif', opacity:.7, marginBottom:4, fontSize:11 }}>{fmtPointTime(hovered.timestamp)}</div>
          <div>Price: <strong>${hovered.price.toFixed(2)}</strong></div>
          <div style={{ color: hovered.change >= 0 ? '#4ade80' : '#f87171', marginTop:2 }}>
            Δ {hovered.change >= 0 ? '+' : ''}{hovered.change.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  )
}

function fmt$(n)    { return `$${Number(n).toFixed(2)}` }
function fmtTime(ms) {
  if (!ms) return '—'
  return new Date(ms).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
}

function websiteToHref(website) {
  if (!website) return null
  const value = String(website).trim()
  if (!value) return null
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

export default function DashboardPage() {
  const { token } = useAuth()
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
  const [stockMetaByTicker, setStockMetaByTicker] = useState({})
  const [showTickerInsights, setShowTickerInsights] = useState(false)
  const [insightRange, setInsightRange] = useState('1W')
  const [insightTrades, setInsightTrades] = useState([])
  const [insightLoading, setInsightLoading] = useState(false)
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
  async function loadCompanyStockMeta() {
    try {
      const [stocksRes, profilesRes] = await Promise.allSettled([
        companyApi.get('/public/stocks'),
        companyApi.get('/public/all'),
      ])
      const stocks = stocksRes.status === 'fulfilled' ? (stocksRes.value.data || []) : []
      const profiles = profilesRes.status === 'fulfilled' ? (profilesRes.value.data || []) : []
      const profileByCompanyName = {}
      for (const p of profiles) {
        const key = String(p.companyName || '').trim().toLowerCase()
        if (key) profileByCompanyName[key] = p
      }
      const byTicker = {}
      for (const s of stocks) {
        const nameKey = String(s.companyName || '').trim().toLowerCase()
        const profile = profileByCompanyName[nameKey]
        byTicker[s.ticker] = { ...s, contactEmail: s.contactEmail || profile?.contactEmail || '', website: s.website || profile?.website || '' }
      }
      setStockMetaByTicker(byTicker)
    } catch { setStockMetaByTicker({}) }
  }
  async function loadInsightTrades(ticker, range = insightRange) {
    if (!ticker) { setInsightTrades([]); return }
    setInsightLoading(true)
    try {
      const r = await orderApi.get('/market/trades', { params: { ticker, range } })
      setInsightTrades(r.data || [])
    } catch { setInsightTrades([]) }
    finally { setInsightLoading(false) }
  }
  async function loadOrderBook(ticker) {
    try { const r = await bookApi.get(`/${ticker}`); setOrderBook(r.data) }
    catch { setOrderBook({ ticker, bids: [], asks: [] }) }
  }

  function loadAll() {
    loadStocks(); loadPortfolio(); loadOrders(); loadTrades(); loadIpoPurchases(); loadBalance(); loadMarketTrades(); loadCompanyStockMeta()
  }

  useEffect(() => { loadAll(); loadOrderBook(tradeForm.stockTicker) }, [])

  useEffect(() => {
    if (!showTickerInsights || !tradeForm.stockTicker) return
    loadInsightTrades(tradeForm.stockTicker, insightRange)
  }, [showTickerInsights, tradeForm.stockTicker, insightRange])

  useEffect(() => {
    if (!showTickerInsights) return
    function onKeyDown(e) { if (e.key === 'Escape') setShowTickerInsights(false) }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [showTickerInsights])

  useEffect(() => { loadOrderBook(tradeForm.stockTicker) }, [tradeForm.stockTicker])

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
                setTimeout(() => { loadOrders(); loadPortfolio(); loadTrades(); loadIpoPurchases(); loadBalance(); loadMarketTrades() }, 600)
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

  useEffect(() => {
    if (stocks.length > 0 && !tradeForm.limitPrice) {
      const stock = stocks.find(s => s.ticker === tradeForm.stockTicker)
      if (stock) setTradeForm(f => ({ ...f, limitPrice: Number(stock.currentPrice).toFixed(2) }))
    }
  }, [stocks])

  function selectStock(ticker) {
    const stock = stocks.find(s => s.ticker === ticker)
    setTradeForm(f => ({ ...f, stockTicker: ticker, limitPrice: stock ? Number(stock.currentPrice).toFixed(2) : f.limitPrice }))
  }

  function openTickerInsights(ticker) {
    selectStock(ticker)
    setShowTickerInsights(true)
    loadInsightTrades(ticker, insightRange)
  }

  function showMsg(msg) {
    setTradeMsg(msg)
    if (tradeMsgTimer.current) clearTimeout(tradeMsgTimer.current)
    if (msg) tradeMsgTimer.current = setTimeout(() => setTradeMsg(null), 5000)
  }

  function fillFromBook(price, side) {
    setTradeForm(f => ({ ...f, type: side === 'ask' ? 'BUY' : 'SELL', orderMode: 'LIMIT', limitPrice: Number(price).toFixed(2) }))
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
      const modeLabel = tradeForm.orderMode === 'LIMIT' ? `Limit @ ${fmt$(tradeForm.limitPrice)}` : 'Market'
      pushActivity(`${tradeForm.type} ${modeLabel} — ${tradeForm.quantity}× ${tradeForm.stockTicker}`)
      showMsg({ type:'success', text:`${tradeForm.type} order placed: ${tradeForm.quantity}× ${tradeForm.stockTicker} (${modeLabel})` })
      setTradeForm(f => ({ ...f, quantity: 1 }))
      setTimeout(() => { loadAll(); loadOrderBook(tradeForm.stockTicker) }, 800)
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.response?.data || 'Order failed.'
      showMsg({ type:'error', text: String(msg) })
    } finally { setTradeLoading(false) }
  }

  async function cancelOrder(orderId) {
    setCancelling(orderId)
    try {
      await orderApi.delete(`/${orderId}`, { headers })
      pushActivity(`Order #${orderId} cancelled`)
      loadOrders(); loadOrderBook(tradeForm.stockTicker)
    } catch (err) { alert(err.response?.data?.error || 'Cancel failed.') }
    finally { setCancelling(null) }
  }

  const currentStock   = stocks.find(s => s.ticker === tradeForm.stockTicker)
  const estimatedTotal = tradeForm.orderMode === 'LIMIT'
    ? (Number(tradeForm.limitPrice) || 0) * tradeForm.quantity
    : (Number(currentStock?.currentPrice) || 0) * tradeForm.quantity

  const openOrders = orders.filter(o => o.status === 'OPEN' || o.status === 'PARTIALLY_FILLED')
  const openCount  = openOrders.length
  const myOrderIds = new Set(orders.map(o => o.id))

  const portfolioRows = portfolio.map(p => {
    const stock        = stocks.find(s => s.ticker === p.stockTicker)
    const currentPrice = stock ? Number(stock.currentPrice) : null
    const avgCost      = p.avgCostBasis != null ? Number(p.avgCostBasis) : null
    const mktVal       = currentPrice != null ? currentPrice * p.quantity : null
    const pnl          = mktVal != null && avgCost != null ? mktVal - p.quantity * avgCost : null
    const pnlPct       = avgCost != null && avgCost > 0 && currentPrice != null ? ((currentPrice - avgCost) / avgCost) * 100 : null
    return { ...p, currentPrice, avgCost, mktVal, pnl, pnlPct }
  })

  const totalMktVal = portfolioRows.reduce((s, p) => s + (p.mktVal ?? 0), 0)
  const totalPnl    = portfolioRows.reduce((s, p) => s + (p.pnl ?? 0), 0)

  const filteredOrders = orderFilter === 'open'
    ? orders.filter(o => o.status === 'OPEN' || o.status === 'PARTIALLY_FILLED')
    : orderFilter === 'history'
    ? orders.filter(o => !['OPEN','PARTIALLY_FILLED'].includes(o.status))
    : orders

  const insightMeta = stockMetaByTicker[tradeForm.stockTicker]
  const insightWebsiteHref = websiteToHref(insightMeta?.website)
  const insightSeries = useMemo(() => {
    const sorted = [...insightTrades].sort((a, b) => Number(a.executedAt) - Number(b.executedAt))
    const points = []
    const ipoPrice = Number(insightMeta?.initialPrice)
    if (Number.isFinite(ipoPrice) && ipoPrice > 0) points.push({ price: ipoPrice, timestamp: null })
    for (const t of sorted) {
      const price = Number(t.price)
      if (Number.isFinite(price) && price > 0) points.push({ price, timestamp: t.executedAt })
    }
    if (points.length === 0) {
      const fallback = Number(currentStock?.currentPrice)
      if (Number.isFinite(fallback) && fallback > 0) {
        points.push({ price: fallback, timestamp: null }, { price: fallback, timestamp: Date.now() })
      }
    } else if (points.length === 1) {
      points.push({ price: points[0].price, timestamp: Date.now() })
    }
    return points
  }, [insightTrades, insightMeta, currentStock])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="db-page">

      {/* ── KPI Strip ────────────────────────────────────────────────────── */}
      <div className="db-kpi-strip">
        <Link to="/wallet" className="db-kpi db-kpi-link">
          <span className="db-kpi-icon"></span>
          <div>
            <div className="db-kpi-label">Wallet Balance</div>
            <div className="db-kpi-value">{balance === null ? '—' : fmt$(balance)}</div>
          </div>
        </Link>
        <div className="db-kpi">
          <span className="db-kpi-icon"></span>
          <div>
            <div className="db-kpi-label">Portfolio Value</div>
            <div className="db-kpi-value">{totalMktVal > 0 ? fmt$(totalMktVal) : '—'}</div>
          </div>
        </div>
        <div className="db-kpi">
          <span className="db-kpi-icon">{totalPnl >= 0 ? '' : ''}</span>
          <div>
            <div className="db-kpi-label">Unrealized P&amp;L</div>
            <div className={`db-kpi-value ${totalPnl > 0 ? 'pnl-pos' : totalPnl < 0 ? 'pnl-neg' : ''}`}>
              {totalPnl !== 0 ? `${totalPnl > 0 ? '+' : ''}${fmt$(totalPnl)}` : '—'}
            </div>
          </div>
        </div>
        <div className="db-kpi">
          <span className="db-kpi-icon"></span>
          <div>
            <div className="db-kpi-label">Open Orders</div>
            <div className="db-kpi-value">{openCount}</div>
          </div>
        </div>

      </div>

      {/* ── Main Two-Column Layout ────────────────────────────────────────── */}
      <div className="db-main-grid">

        {/* LEFT COLUMN */}
        <div className="db-left-col">

          {/* Market Prices */}
          <div className="db-card">
            <div className="db-card-head">
              <div>
                <div className="db-card-title">Market Prices</div>
                <div className="db-card-sub">Click row to select · Press <kbd>i</kbd> for chart</div>
              </div>
            </div>
            <div className="db-scroll-table" style={{ maxHeight: 260 }}>
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th className="tar">Last Price</th>
                    <th className="tar">Prev Trade</th>
                    <th className="tar">Value</th>
                    <th>Updated</th>
                    <th className="tar"></th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.length === 0 && <tr><td colSpan={6} className="db-empty-row">Loading market data…</td></tr>}
                  {stocks.map(s => {
                    const dir   = priceDirs[s.ticker] || 'neutral'
                    const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : ''
                    const priceCls = dir === 'up' ? 'price-up' : dir === 'down' ? 'price-down' : ''
                    const myPos = portfolio.find(p => p.stockTicker === s.ticker)
                    return (
                      <tr key={s.ticker}
                        className={`db-tr-click ${tradeForm.stockTicker === s.ticker ? 'db-tr-selected' : ''}`}
                        onClick={() => selectStock(s.ticker)}>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span className="db-ticker">{s.ticker}</span>
                            {myPos && <span className="db-chip-pos">{myPos.quantity} held</span>}
                          </div>
                        </td>
                        <td className={`tar db-mono ${priceCls}`} style={{ fontWeight:700 }}>
                          {arrow && <span style={{ fontSize:10, marginRight:3 }}>{arrow}</span>}
                          {fmt$(s.currentPrice)}
                        </td>
                        <td className="tar db-mono muted">{s.lastTradePrice ? fmt$(s.lastTradePrice) : '—'}</td>
                        <td className="tar db-mono muted">{s.lastTradeValue ? fmt$(s.lastTradeValue) : '—'}</td>
                        <td className="muted db-sm">{s.lastUpdatedAt || '—'}</td>
                        <td className="tar">
                          <button className="db-btn-icon" title="View chart" onClick={e => { e.stopPropagation(); openTickerInsights(s.ticker) }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Order Book + Market Trades side-by-side */}
          <div className="db-two-col">

            {/* Order Book */}
            <div className="db-card" style={{ padding:0 }}>
              <div className="db-card-head" style={{ padding:'12px 16px' }}>
                <div>
                  <div className="db-card-title">Order Book — <span className="db-ticker-inline">{tradeForm.stockTicker}</span></div>
                  <div className="db-card-sub">Click price to pre-fill order</div>
                </div>
                <button className="db-btn-ghost" onClick={() => loadOrderBook(tradeForm.stockTicker)}>↺</button>
              </div>
              {!orderBook ? (
                <div className="db-empty-row">Loading…</div>
              ) : (
                <div>
                  {/* Asks */}
                  <div className="book-section-label book-asks-lbl">SELL · ASKS</div>
                  <div className="book-col-hdr"><span>Price</span><span>Qty</span><span>Orders</span></div>
                  <div style={{ maxHeight:130, overflowY:'auto' }}>
                    {orderBook.asks.length === 0
                      ? <div className="db-empty-row db-sm">No sell orders</div>
                      : [...orderBook.asks].reverse().map((lvl, i) => {
                          const maxQty = Math.max(...orderBook.asks.map(l => l.quantity), 1)
                          return (
                            <div key={i} className="book-row book-row-ask"
                              style={{ '--pct': `${Math.round(lvl.quantity / maxQty * 100)}%` }}
                              onClick={() => fillFromBook(lvl.price, 'ask')}
                              title={`BUY at ${fmt$(lvl.price)}`}>
                              <span className="book-price ask-price">{fmt$(lvl.price)}</span>
                              <span className="book-qty">{lvl.quantity.toLocaleString()}</span>
                              <span className="book-orders">{lvl.orders}</span>
                            </div>
                          )
                        })
                    }
                  </div>

                  {/* Spread */}
                  {orderBook.bids.length > 0 && orderBook.asks.length > 0 ? (
                    <div className="book-spread">
                      Spread {fmt$(Number(orderBook.asks[0].price) - Number(orderBook.bids[0].price))} · Mid {fmt$((Number(orderBook.asks[0].price) + Number(orderBook.bids[0].price)) / 2)}
                    </div>
                  ) : (
                    <div className="book-spread muted">— one-sided book —</div>
                  )}

                  {/* Bids */}
                  <div className="book-section-label book-bids-lbl">BUY · BIDS</div>
                  <div className="book-col-hdr"><span>Price</span><span>Qty</span><span>Orders</span></div>
                  <div style={{ maxHeight:130, overflowY:'auto' }}>
                    {orderBook.bids.length === 0
                      ? <div className="db-empty-row db-sm">No buy orders</div>
                      : orderBook.bids.map((lvl, i) => {
                          const maxQty = Math.max(...orderBook.bids.map(l => l.quantity), 1)
                          return (
                            <div key={i} className="book-row book-row-bid"
                              style={{ '--pct': `${Math.round(lvl.quantity / maxQty * 100)}%` }}
                              onClick={() => fillFromBook(lvl.price, 'bid')}
                              title={`SELL at ${fmt$(lvl.price)}`}>
                              <span className="book-price bid-price">{fmt$(lvl.price)}</span>
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
            <div className="db-card">
              <div className="db-card-head">
                <div>
                  <div className="db-card-title">Market Trades</div>
                  <div className="db-card-sub">Latest executions across all tickers</div>
                </div>
                <button className="db-btn-ghost" onClick={loadMarketTrades}>↺</button>
              </div>
              <div className="db-scroll-table" style={{ maxHeight:360 }}>
                <table className="db-table">
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th className="tar">Price</th>
                      <th className="tar">Qty</th>
                      <th className="tar">Value</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketTrades.length === 0 && <tr><td colSpan={5} className="db-empty-row">No trades yet.</td></tr>}
                    {marketTrades.map(t => {
                      const isMine = myOrderIds.has(t.buyOrderId) || myOrderIds.has(t.sellOrderId)
                      return (
                        <tr key={t.id} className={isMine ? 'db-tr-mine' : ''}>
                          <td>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <span className="db-ticker">{t.ticker}</span>
                              {isMine && <span className="db-chip-mine">You</span>}
                            </div>
                          </td>
                          <td className="tar db-mono" style={{ fontWeight:600 }}>{fmt$(t.price)}</td>
                          <td className="tar db-mono muted">{t.quantity.toLocaleString()}</td>
                          <td className="tar db-mono muted">{fmt$(t.value)}</td>
                          <td className="db-sm muted">{new Date(t.executedAt).toLocaleTimeString()}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Portfolio / Orders / Trades tabbed panel */}
          <div className="db-card">
            <div className="db-card-head">
              <div className="db-tabs">
                {[
                  { key:'portfolio', label:`Portfolio`, count: portfolio.length },
                  { key:'orders',    label:`Orders`,    count: openCount > 0 ? openCount : orders.length, dot: openCount > 0 },
                  { key:'trades',    label:`My Trades`, count: trades.length + ipoPurchases.length },
                ].map(t => (
                  <button key={t.key} className={`db-tab ${activeTab === t.key ? 'db-tab-active' : ''}`} onClick={() => setActiveTab(t.key)}>
                    {t.label}
                    {t.count > 0 && <span className={`db-tab-badge ${t.dot ? 'db-tab-badge-dot' : ''}`}>{t.count}</span>}
                  </button>
                ))}
              </div>
              <button className="db-btn-ghost" onClick={loadAll}>↺ Refresh</button>
            </div>

            {/* Portfolio Tab */}
            {activeTab === 'portfolio' && (
              portfolioRows.length === 0 ? (
                <div className="db-empty-state">
                  <div className="db-empty-icon">📊</div>
                  <div className="db-empty-title">No positions yet</div>
                  <div className="db-empty-sub">Place a BUY order to start building your portfolio.</div>
                </div>
              ) : (
                <div className="db-scroll-table" style={{ maxHeight:320 }}>
                  <table className="db-table">
                    <thead>
                      <tr>
                        <th>Ticker</th>
                        <th className="tar">Shares</th>
                        <th className="tar">Avg Cost</th>
                        <th className="tar">Mkt Price</th>
                        <th className="tar">Market Value</th>
                        <th className="tar">P&amp;L ($)</th>
                        <th className="tar">P&amp;L (%)</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolioRows.map(p => {
                        const pnlCls = p.pnl === null ? '' : p.pnl >= 0 ? 'pnl-pos' : 'pnl-neg'
                        return (
                          <tr key={p.stockTicker}>
                            <td><span className="db-ticker">{p.stockTicker}</span></td>
                            <td className="tar db-mono">{p.quantity.toLocaleString()}</td>
                            <td className="tar db-mono muted">{p.avgCost != null ? fmt$(p.avgCost) : '—'}</td>
                            <td className="tar db-mono">{p.currentPrice != null ? fmt$(p.currentPrice) : '—'}</td>
                            <td className="tar db-mono" style={{ fontWeight:600 }}>{p.mktVal != null ? fmt$(p.mktVal) : '—'}</td>
                            <td className={`tar db-mono ${pnlCls}`}>{p.pnl != null ? `${p.pnl >= 0 ? '+' : ''}${fmt$(p.pnl)}` : '—'}</td>
                            <td className={`tar db-mono ${pnlCls}`}>{p.pnlPct != null ? `${p.pnlPct >= 0 ? '+' : ''}${p.pnlPct.toFixed(2)}%` : '—'}</td>
                            <td>
                              <button className="db-btn-sell-sm" onClick={() => setTradeForm(f => ({
                                ...f, type:'SELL', stockTicker: p.stockTicker,
                                limitPrice: p.currentPrice != null ? p.currentPrice.toFixed(2) : '',
                                orderMode:'LIMIT', quantity:1,
                              }))}>Sell</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="db-tfoot-row">
                        <td colSpan={4}><strong>Total</strong></td>
                        <td className="tar db-mono"><strong>{fmt$(totalMktVal)}</strong></td>
                        <td className={`tar db-mono ${totalPnl > 0 ? 'pnl-pos' : totalPnl < 0 ? 'pnl-neg' : ''}`}>
                          <strong>{totalPnl !== 0 ? `${totalPnl > 0 ? '+' : ''}${fmt$(totalPnl)}` : '—'}</strong>
                        </td>
                        <td colSpan={2}/>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <>
                <div className="db-filter-bar">
                  {[
                    { key:'open',    label:`Open (${openCount})` },
                    { key:'history', label:'History' },
                    { key:'all',     label:`All (${orders.length})` },
                  ].map(f => (
                    <button key={f.key} className={`db-filter-btn ${orderFilter === f.key ? 'db-filter-active' : ''}`} onClick={() => setOrderFilter(f.key)}>
                      {f.label}
                    </button>
                  ))}
                </div>
                {filteredOrders.length === 0 ? (
                  <div className="db-empty-state">
                    <div className="db-empty-icon">{orderFilter === 'open' ? '⏳' : '📋'}</div>
                    <div className="db-empty-title">{orderFilter === 'open' ? 'No open orders' : 'Nothing here yet'}</div>
                    <div className="db-empty-sub">
                      {orderFilter === 'open' ? 'LIMIT orders waiting to match appear here.' : 'Completed & cancelled orders appear here.'}
                    </div>
                  </div>
                ) : (
                  <div className="db-scroll-table" style={{ maxHeight:320 }}>
                    <table className="db-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Ticker</th>
                          <th>Side</th>
                          <th>Mode</th>
                          <th className="tar">Qty</th>
                          <th className="tar">Filled</th>
                          <th className="tar">Price</th>
                          <th>Status</th>
                          <th>Placed</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.map(o => {
                          const meta      = STATUS_META[o.status] || { label: o.status, cls: '' }
                          const canCancel = o.status === 'OPEN' || o.status === 'PARTIALLY_FILLED'
                          const fillPct   = o.quantity > 0 ? Math.round((o.filledQuantity / o.quantity) * 100) : 0
                          const priceCol  = o.avgFillPrice ? `${fmt$(o.avgFillPrice)} avg` : o.limitPrice ? fmt$(o.limitPrice) : 'Market'
                          return (
                            <tr key={o.id}>
                              <td className="muted db-sm db-mono">#{o.id}</td>
                              <td><span className="db-ticker">{o.stockTicker}</span></td>
                              <td className={o.type === 'BUY' ? 'type-buy' : 'type-sell'} style={{ fontWeight:700, fontSize:12 }}>{o.type}</td>
                              <td className="muted db-sm">{o.orderMode}</td>
                              <td className="tar db-mono">{o.quantity}</td>
                              <td className="tar">
                                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3 }}>
                                  <span className="db-mono db-sm">{o.filledQuantity}/{o.quantity}</span>
                                  {o.filledQuantity > 0 && o.filledQuantity < o.quantity && (
                                    <div style={{ width:50, height:3, background:'#e2e8f0', borderRadius:2 }}>
                                      <div style={{ width:`${fillPct}%`, height:'100%', background:'var(--db-primary)', borderRadius:2 }}/>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="tar db-mono db-sm">{priceCol}</td>
                              <td><span className={`db-badge ${meta.cls}`}>{meta.label}</span></td>
                              <td className="muted db-sm">{fmtTime(o.createdAt)}</td>
                              <td>
                                {canCancel && (
                                  <button className="db-btn-cancel" disabled={cancelling === o.id} onClick={() => cancelOrder(o.id)}>
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

            {/* My Trades Tab */}
            {activeTab === 'trades' && (() => {
              const allTxns = [
                ...trades.map(t => ({
                  key: t.id, ticker: t.ticker, market:'secondary',
                  side: myOrderIds.has(t.buyOrderId) ? 'BUY' : 'SELL',
                  qty: t.quantity, price: t.price, value: t.value, ts: t.executedAt,
                  counterpart: myOrderIds.has(t.buyOrderId) ? t.sellOrderId : t.buyOrderId,
                })),
                ...ipoPurchases.map(p => ({
                  key:`ipo-${p.id}`, ticker: p.ticker, market:'ipo', side:'BUY',
                  qty: p.quantity, price: p.pricePerShare, value: p.totalValue, ts: p.purchasedAt, counterpart: null,
                })),
              ].sort((a, b) => b.ts - a.ts)

              if (allTxns.length === 0) return (
                <div className="db-empty-state">
                  <div className="db-empty-icon">⚡</div>
                  <div className="db-empty-title">No transactions yet</div>
                  <div className="db-empty-sub">IPO purchases and matched trades will appear here.</div>
                </div>
              )
              return (
                <div className="db-scroll-table" style={{ maxHeight:320 }}>
                  <table className="db-table">
                    <thead>
                      <tr>
                        <th>Ticker</th>
                        <th>Type</th>
                        <th>Side</th>
                        <th className="tar">Qty</th>
                        <th className="tar">Price</th>
                        <th className="tar">Total</th>
                        <th>Counterpart</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTxns.map(t => (
                        <tr key={t.key}>
                          <td><span className="db-ticker">{t.ticker}</span></td>
                          <td><span className={`db-badge ${t.market === 'ipo' ? 'badge-ipo' : 'badge-sec'}`}>{t.market === 'ipo' ? 'IPO' : 'Secondary'}</span></td>
                          <td className={t.side === 'BUY' ? 'type-buy' : 'type-sell'} style={{ fontWeight:700, fontSize:12 }}>
                            {t.side === 'BUY' ? '▲ Bought' : '▼ Sold'}
                          </td>
                          <td className="tar db-mono">{t.qty.toLocaleString()}</td>
                          <td className="tar db-mono" style={{ fontWeight:600 }}>{fmt$(t.price)}</td>
                          <td className="tar db-mono">{fmt$(t.value)}</td>
                          <td className="muted db-sm">{t.counterpart != null ? `Order #${t.counterpart}` : '—'}</td>
                          <td className="muted db-sm">{fmtTime(t.ts)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>

        </div>{/* end left col */}

        {/* RIGHT COLUMN */}
        <div className="db-right-col">

          {/* ── TRADE PANEL ── */}
          <div className="op-panel">

            {/* Stock selector header */}
            <div className="op-stock-header">
              <div className="op-stock-left">
                <select className="op-stock-select" value={tradeForm.stockTicker} onChange={e => selectStock(e.target.value)}>
                  {stocks.map(s => <option key={s.ticker} value={s.ticker}>{s.ticker}</option>)}
                </select>
                {currentStock && (
                  <div className="op-stock-name">{stockMetaByTicker[tradeForm.stockTicker]?.companyName || 'Select a stock'}</div>
                )}
              </div>
              <div className="op-stock-right">
                {currentStock && (
                  <>
                    <div className={`op-live-price ${priceDirs[tradeForm.stockTicker] === 'up' ? 'op-price-up' : priceDirs[tradeForm.stockTicker] === 'down' ? 'op-price-down' : ''}`}>
                      {fmt$(currentStock.currentPrice)}
                    </div>
                    <div className="op-price-label">
                      {priceDirs[tradeForm.stockTicker] === 'up' ? '▲ Live' : priceDirs[tradeForm.stockTicker] === 'down' ? '▼ Live' : '● Live'}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* BUY / SELL big toggle */}
            <div className="op-side-toggle">
              <button
                type="button"
                className={`op-side-btn op-side-buy ${tradeForm.type === 'BUY' ? 'op-side-buy-active' : ''}`}
                onClick={() => setTradeForm(f => ({ ...f, type: 'BUY' }))}>
                <span className="op-side-icon">▲</span> Buy
              </button>
              <button
                type="button"
                className={`op-side-btn op-side-sell ${tradeForm.type === 'SELL' ? 'op-side-sell-active' : ''}`}
                onClick={() => setTradeForm(f => ({ ...f, type: 'SELL' }))}>
                <span className="op-side-icon">▼</span> Sell
              </button>
            </div>

            {/* Active side indicator bar */}
            <div className={`op-side-bar ${tradeForm.type === 'BUY' ? 'op-bar-buy' : 'op-bar-sell'}`} />

            {tradeMsg && (
              <div className={`op-alert ${tradeMsg.type === 'success' ? 'op-alert-ok' : 'op-alert-err'}`}>
                <span className="op-alert-icon">{tradeMsg.type === 'success' ? '✓' : '!'}</span>
                {tradeMsg.text}
              </div>
            )}

            <form onSubmit={submitTrade} className="op-form">

              {/* Order mode */}
              <div className="op-mode-row">
                <span className="op-section-label">Order Type</span>
                <div className="op-mode-pills">
                  {['LIMIT','MARKET'].map(m => (
                    <button key={m} type="button"
                      className={`op-mode-pill ${tradeForm.orderMode === m ? 'op-mode-active' : ''}`}
                      onClick={() => setTradeForm(f => ({ ...f, orderMode: m }))}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inputs */}
              <div className="op-inputs">
                <div className="op-input-group">
                  <label className="op-input-label">Quantity (shares)</label>
                  <div className="op-qty-row">
                    <button type="button" className="op-qty-btn"
                      onClick={() => setTradeForm(f => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))}>−</button>
                    <input className="op-input op-input-center db-mono" type="number" min="1"
                      value={tradeForm.quantity}
                      onChange={e => setTradeForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
                    <button type="button" className="op-qty-btn"
                      onClick={() => setTradeForm(f => ({ ...f, quantity: f.quantity + 1 }))}>+</button>
                  </div>
                </div>

                {tradeForm.orderMode === 'LIMIT' && (
                  <div className="op-input-group">
                    <label className="op-input-label">Limit Price</label>
                    <div className="op-price-input-wrap">
                      <span className="op-currency">$</span>
                      <input className="op-input op-input-price db-mono" type="number" min="0.01" step="0.01"
                        value={tradeForm.limitPrice} placeholder="0.00"
                        onChange={e => setTradeForm(f => ({ ...f, limitPrice: e.target.value }))} />
                    </div>
                    {tradeForm.limitPrice && (
                      <div className="op-condition-hint">
                        {tradeForm.type === 'BUY'
                          ? `Executes when ask ≤ ${fmt$(tradeForm.limitPrice)}`
                          : `Executes when bid ≥ ${fmt$(tradeForm.limitPrice)}`}
                      </div>
                    )}
                  </div>
                )}
                {tradeForm.orderMode === 'MARKET' && (
                  <div className="op-market-note">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    Fills immediately at best available price. Remainder auto-cancelled.
                  </div>
                )}
              </div>

              {/* Order summary */}
              <div className="op-summary">
                <div className="op-summary-title">Order Summary</div>
                <div className="op-summary-rows">
                  <div className="op-summary-row">
                    <span>{tradeForm.orderMode === 'LIMIT' ? 'Max value' : 'Est. value'}</span>
                    <span className="db-mono op-summary-val">{fmt$(estimatedTotal)}</span>
                  </div>
                  {tradeForm.type === 'BUY' && balance !== null && (
                    <div className="op-summary-row">
                      <span>Balance after</span>
                      <span className={`db-mono ${Number(balance) - estimatedTotal < 0 ? 'op-val-danger' : 'op-val-muted'}`}>
                        {fmt$(Number(balance) - estimatedTotal)}
                      </span>
                    </div>
                  )}
                  {tradeForm.type === 'SELL' && (() => {
                    const pos = portfolio.find(p => p.stockTicker === tradeForm.stockTicker)
                    const avail = pos?.quantity ?? 0
                    return (
                      <div className="op-summary-row">
                        <span>Shares owned</span>
                        <span className={`db-mono ${tradeForm.quantity > avail ? 'op-val-danger' : 'op-val-muted'}`}>
                          {avail}{tradeForm.quantity > avail ? ' — insufficient' : ''}
                        </span>
                      </div>
                    )
                  })()}
                </div>
              </div>

              {/* Submit */}
              <button type="submit"
                className={`op-submit ${tradeForm.type === 'BUY' ? 'op-submit-buy' : 'op-submit-sell'}`}
                disabled={tradeLoading || (tradeForm.orderMode === 'LIMIT' && !tradeForm.limitPrice)}>
                {tradeLoading
                  ? <span className="op-loading">Processing…</span>
                  : <span>
                      {tradeForm.type === 'BUY' ? '▲' : '▼'}&nbsp;
                      {tradeForm.orderMode} {tradeForm.type}&nbsp;·&nbsp;
                      {tradeForm.quantity} {tradeForm.stockTicker}
                    </span>
                }
              </button>

            </form>
          </div>{/* end op-panel */}

          {/* Live Activity Feed */}
          <div className="db-card">
            <div className="db-card-head">
              <div>
                <div className="db-card-title">Live Activity</div>
                <div className="db-card-sub">Real-time event stream</div>
              </div>
              <span className={`db-live-dot ${wsConnected ? 'dot-on' : 'dot-off'}`}/>
            </div>
            <div style={{ maxHeight:220, overflowY:'auto' }}>
              {activity.length === 0
                ? <div className="db-empty-row" style={{ padding:'20px 16px' }}>Waiting for events…</div>
                : activity.map((msg, i) => (
                  <div key={i} className={`db-activity-item ${i === 0 ? 'db-activity-new' : ''}`}>
                    <span className="db-activity-dot"/>
                    <span>{msg}</span>
                  </div>
                ))
              }
            </div>
          </div>

        </div>{/* end right col */}
      </div>{/* end main grid */}

      {/* ── Ticker Insights Modal ─────────────────────────────────────────── */}
      {showTickerInsights && (
        <div className="db-modal-overlay" onClick={() => setShowTickerInsights(false)}>
          <div className="db-modal" onClick={e => e.stopPropagation()}>
            <div className="db-modal-head">
              <div>
                <div className="db-modal-title">{tradeForm.stockTicker} — {insightMeta?.companyName || 'Company'}</div>
                <div className="db-modal-meta">
                  <span><strong>Description:</strong> {insightMeta?.description || 'Not provided'}</span>
                  <span><strong>Email:</strong> {insightMeta?.contactEmail || 'Not provided'}</span>
                  <span>
                    <strong>Website:</strong>{' '}
                    {insightMeta?.website
                      ? <a href={insightWebsiteHref || '#'} target="_blank" rel="noreferrer" className="db-link">{insightMeta.website}</a>
                      : 'Not provided'}
                  </span>
                </div>
              </div>
              <button className="db-modal-close" onClick={() => setShowTickerInsights(false)}>×</button>
            </div>

            <div className="db-modal-body">
              <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
                {INSIGHT_RANGES.map(r => (
                  <button key={r}
                    className={`db-filter-btn ${insightRange === r ? 'db-filter-active' : ''}`}
                    onClick={() => setInsightRange(r)}>
                    {r}
                  </button>
                ))}
              </div>

              <div className="db-chart-wrap">
                {insightLoading
                  ? <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:240, color:'#64748b', fontSize:13 }}>Loading chart…</div>
                  : <TickerSparkline
                      data={insightSeries}
                      color={priceDirs[tradeForm.stockTicker] === 'down' ? '#ef4444' : '#16a34a'}
                      width={860}
                      height={240}
                      pointRadius={3.5}
                    />
                }
              </div>
              <div className="muted db-sm" style={{ marginTop:10 }}>
                {insightTrades.length} trade points · {tradeForm.stockTicker} · {insightRange} · Hover dots for detail
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}