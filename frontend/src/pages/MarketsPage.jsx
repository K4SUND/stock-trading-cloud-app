import React, { useEffect, useState, useCallback } from 'react'
import { authHeaders, bookApi, companyApi, orderApi, priceApi } from '../api'
import { useAuth } from '../context/AuthContext'

function fmt$(n) { return `$${Number(n).toFixed(2)}` }

export default function MarketsPage() {
  const { token } = useAuth()
  const headers = authHeaders(token)

  const [listings, setListings]           = useState([])
  const [prices, setPrices]               = useState([])
  const [ipoAllocations, setIpoAllocations] = useState([])
  const [selected, setSelected]           = useState(null)
  const [orderBook, setOrderBook]         = useState(null)
  const [bookLoading, setBookLoading]     = useState(false)

  // Primary market (IPO) form state
  const [ipoQty, setIpoQty]     = useState(1)
  const [ipoBuying, setIpoBuying] = useState(false)
  const [ipoMsg, setIpoMsg]     = useState(null)

  // Secondary market form state
  const [secForm, setSecForm]       = useState({ type: 'BUY', quantity: 1, limitPrice: '', orderMode: 'LIMIT' })
  const [secSubmitting, setSecSubmitting] = useState(false)
  const [secMsg, setSecMsg]         = useState(null)

  const loadData = useCallback(async () => {
    const [listRes, priceRes, ipoRes] = await Promise.allSettled([
      companyApi.get('/public/stocks'),
      priceApi.get('/stocks'),
      orderApi.get('/ipo', { headers }),
    ])
    if (listRes.status === 'fulfilled')  setListings(listRes.value.data)
    if (priceRes.status === 'fulfilled') setPrices(priceRes.value.data)
    if (ipoRes.status === 'fulfilled')   setIpoAllocations(ipoRes.value.data)
  }, [token])

  useEffect(() => { loadData() }, [loadData])

  function getPrice(ticker)  { return prices.find(p => p.ticker === ticker) }
  function getIpo(ticker)    { return ipoAllocations.find(a => a.ticker === ticker) }

  async function selectStock(listing) {
    setSelected(listing)
    setIpoMsg(null)
    setSecMsg(null)
    setOrderBook(null)
    setIpoQty(1)
    setSecForm({ type: 'BUY', quantity: 1, limitPrice: '', orderMode: 'LIMIT' })
    setBookLoading(true)
    try {
      const r = await bookApi.get(`/${listing.ticker}`)
      setOrderBook(r.data)
    } catch {
      setOrderBook({ ticker: listing.ticker, bids: [], asks: [] })
    } finally {
      setBookLoading(false)
    }
  }

  async function refreshBook() {
    if (!selected) return
    setBookLoading(true)
    try {
      const r = await bookApi.get(`/${selected.ticker}`)
      setOrderBook(r.data)
    } catch {} finally { setBookLoading(false) }
  }

  // ── Primary market: direct IPO purchase ────────────────────────────────────
  async function submitIpoBuy(e) {
    e.preventDefault()
    if (!selected || ipoQty < 1) return
    setIpoBuying(true)
    setIpoMsg(null)
    try {
      const res = await orderApi.post('/ipo-buy',
        { ticker: selected.ticker, quantity: ipoQty }, { headers })
      const alloc = res.data
      setIpoMsg({
        type: 'success',
        text: `Bought ${ipoQty} share${ipoQty > 1 ? 's' : ''} of ${selected.ticker} at ${fmt$(getIpo(selected.ticker)?.ipoPrice)}. They're now in your portfolio!`,
      })
      setIpoAllocations(prev => prev.map(a => a.ticker === selected.ticker ? alloc : a))
      setIpoQty(1)
    } catch (err) {
      const text = err.response?.data?.error || err.response?.data?.message
        || err.response?.data || 'Purchase failed.'
      setIpoMsg({ type: 'error', text: String(text) })
    } finally {
      setIpoBuying(false)
    }
  }

  // ── Secondary market: place BUY or SELL order through matching engine ───────
  async function submitSecOrder(e) {
    e.preventDefault()
    if (!selected) return
    setSecSubmitting(true)
    setSecMsg(null)
    try {
      await orderApi.post('', {
        stockTicker: selected.ticker,
        quantity:    secForm.quantity,
        type:        secForm.type,
        orderMode:   secForm.orderMode,
        limitPrice:  secForm.orderMode === 'LIMIT' ? Number(secForm.limitPrice) : null,
      }, { headers })
      const modeLabel = secForm.orderMode === 'LIMIT' ? `Limit @ ${fmt$(secForm.limitPrice)}` : 'Market'
      setSecMsg({
        type: 'success',
        text: `${secForm.type} order placed: ${secForm.quantity}× ${selected.ticker} (${modeLabel}). Check Dashboard for status.`,
      })
      setSecForm(f => ({ ...f, quantity: 1, limitPrice: '' }))
      setTimeout(refreshBook, 800)
    } catch (err) {
      const text = err.response?.data?.error || err.response?.data?.message
        || err.response?.data || 'Order failed.'
      setSecMsg({ type: 'error', text: String(text) })
    } finally {
      setSecSubmitting(false)
    }
  }

  function fillFromAsk(price) {
    setSecForm(f => ({ ...f, limitPrice: Number(price).toFixed(2), orderMode: 'LIMIT' }))
  }
  function fillFromBid(price) {
    setSecForm(f => ({ ...f, limitPrice: Number(price).toFixed(2), orderMode: 'LIMIT' }))
  }

  const totalSecAsks = (orderBook?.asks || []).reduce((s, l) => s + l.quantity, 0)
  const totalSecBids = (orderBook?.bids || []).reduce((s, l) => s + l.quantity, 0)

  return (
    <div className="page">
      <div className="markets-header">
        <div>
          <h1 className="markets-title">Stock Market</h1>
          <p className="markets-sub">
            <strong>Primary market</strong>: buy new IPO shares directly from companies at the fixed issue price. &nbsp;
            <strong>Secondary market</strong>: trade stocks with other investors through the live order book.
          </p>
        </div>
      </div>

      <div className="markets-layout">

        {/* ── Left: listed stocks ──────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Listed Stocks</h2>
            <span className="card-hint">{listings.length} listing{listings.length !== 1 ? 's' : ''}</span>
          </div>

          {listings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏢</div>
              <p className="empty-state-title">No stocks listed yet</p>
              <p className="empty-state-sub">Company accounts can list stocks from their Company Dashboard.</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Company</th>
                    <th className="text-right">IPO Price</th>
                    <th className="text-right">IPO Remaining</th>
                    <th className="text-right">Market Price</th>
                    <th className="text-right">Change</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map(l => {
                    const mkt         = getPrice(l.ticker)
                    const ipo         = getIpo(l.ticker)
                    // changePct comes from price-service: (currentPrice - previousPrice) / previousPrice
                    // For a new stock with no secondary trades, change = 0 (previousPrice == currentPrice)
                    const chgPct      = mkt && mkt.changePct != null ? Number(mkt.changePct) : null
                    const ipoActive   = ipo && ipo.remainingShares > 0
                    const hasSecondary = mkt && mkt.lastTradePrice != null
                    const isSelected  = selected?.ticker === l.ticker
                    return (
                      <tr key={l.ticker}
                        className={`table-row-clickable ${isSelected ? 'row-selected' : ''}`}
                        onClick={() => selectStock(l)}>
                        <td>
                          <span className="ticker-badge">{l.ticker}</span>
                          {ipoActive && <span className="market-phase-badge ipo-phase">IPO</span>}
                          {hasSecondary && <span className="market-phase-badge sec-phase">Secondary</span>}
                        </td>
                        <td className="font-med">{l.companyName}</td>
                        <td className="text-right text-muted">{fmt$(l.initialPrice)}</td>
                        <td className="text-right">
                          {ipo
                            ? <span className={ipo.remainingShares > 0 ? 'pnl-positive' : 'text-muted'}>
                                {ipo.remainingShares > 0
                                  ? Number(ipo.remainingShares).toLocaleString()
                                  : 'Sold out'}
                              </span>
                            : <span className="text-muted">—</span>}
                        </td>
                        <td className="text-right font-med">
                          {mkt ? fmt$(mkt.currentPrice) : <span className="text-muted">—</span>}
                        </td>
                        <td className={`text-right ${chgPct === null ? '' : chgPct >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>
                          {chgPct !== null
                            ? `${chgPct >= 0 ? '+' : ''}${chgPct.toFixed(2)}%`
                            : '—'}
                        </td>
                        <td>
                          <button className="btn-buy-sm"
                            onClick={e => { e.stopPropagation(); selectStock(l) }}>
                            Trade →
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Right: trade panel ───────────────────────────────── */}
        {selected ? (
          <div className="markets-buy-panel">

            {/* Stock info */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">
                    <span className="ticker-badge">{selected.ticker}</span>
                    &nbsp;{selected.companyName}
                  </h2>
                  {selected.description && (
                    <p className="markets-desc">{selected.description}</p>
                  )}
                </div>
                <button className="btn-ghost"
                  onClick={() => { setSelected(null); setOrderBook(null); setIpoMsg(null); setSecMsg(null) }}>
                  ✕
                </button>
              </div>
              <div className="markets-price-row">
                <div className="markets-price-block">
                  <span className="stat-label">IPO Price</span>
                  <span className="markets-price-val">{fmt$(selected.initialPrice)}</span>
                </div>
                <div className="markets-price-block">
                  <span className="stat-label">IPO Remaining</span>
                  <span className="markets-price-val">
                    {(() => {
                      const ipo = getIpo(selected.ticker)
                      if (!ipo) return <span className="text-muted">—</span>
                      return ipo.remainingShares > 0
                        ? <span className="pnl-positive">{Number(ipo.remainingShares).toLocaleString()}</span>
                        : <span className="text-muted">Sold out</span>
                    })()}
                  </span>
                </div>
                <div className="markets-price-block">
                  <span className="stat-label">Market Price</span>
                  <span className="markets-price-val">
                    {getPrice(selected.ticker)
                      ? fmt$(getPrice(selected.ticker).currentPrice)
                      : <span className="text-muted text-sm">No secondary trades yet</span>}
                  </span>
                </div>
                <div className="markets-price-block">
                  <span className="stat-label">Total Shares</span>
                  <span className="markets-price-val">{Number(selected.totalShares).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* ── Primary Market Card ─────────────────────────────── */}
            {(() => {
              const ipo = getIpo(selected.ticker)
              if (!ipo) return null
              return (
                <div className="card market-section-card">
                  <div className="market-section-label market-section-primary">
                    Primary Market — IPO
                  </div>
                  <div className="card-header" style={{ paddingTop: 8 }}>
                    <div>
                      <h2 className="card-title">Buy from Company</h2>
                      <span className="card-hint">
                        Fixed price · No order book · Instant settlement
                      </span>
                    </div>
                  </div>

                  {ipoMsg && (
                    <div className={`alert ${ipoMsg.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                      {ipoMsg.text}
                    </div>
                  )}

                  {ipo.remainingShares <= 0 ? (
                    <div className="empty-state" style={{ padding: '16px' }}>
                      <div className="empty-state-icon">✅</div>
                      <p className="empty-state-title">IPO fully subscribed</p>
                      <p className="empty-state-sub">
                        All {Number(ipo.totalShares).toLocaleString()} IPO shares have been purchased.
                        Shares are now available in the secondary market below.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={submitIpoBuy} className="trade-form">
                      <div className="ipo-info-grid">
                        <div className="ipo-info-item">
                          <span className="stat-label">Price per share</span>
                          <span className="ipo-price">{fmt$(ipo.ipoPrice)}</span>
                        </div>
                        <div className="ipo-info-item">
                          <span className="stat-label">Available</span>
                          <span className="ipo-avail">{Number(ipo.remainingShares).toLocaleString()} shares</span>
                        </div>
                        <div className="ipo-info-item">
                          <span className="stat-label">Sold so far</span>
                          <span className="text-muted">{Number(ipo.soldShares).toLocaleString()} shares</span>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Quantity to buy</label>
                        <input className="form-input" type="number" min="1"
                          max={ipo.remainingShares}
                          value={ipoQty}
                          onChange={e => setIpoQty(Math.max(1, Number(e.target.value)))} />
                      </div>

                      <div className="order-summary">
                        <div className="summary-row">
                          <span className="summary-label">Total cost</span>
                          <span className="summary-value font-med">
                            {fmt$(Number(ipo.ipoPrice) * ipoQty)}
                          </span>
                        </div>
                        <div className="summary-row">
                          <span className="summary-label">You receive</span>
                          <span className="summary-value">{ipoQty.toLocaleString()} share{ipoQty !== 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      <div className="info-box" style={{ fontSize: 12 }}>
                        IPO purchases are instant. Shares appear in your portfolio immediately.
                        Once you own shares, you can sell them in the secondary market.
                      </div>

                      <button type="submit" className="btn-full btn-buy"
                        disabled={ipoBuying || ipoQty < 1 || ipoQty > ipo.remainingShares}>
                        {ipoBuying ? 'Purchasing…' : `Buy ${ipoQty} share${ipoQty !== 1 ? 's' : ''} @ ${fmt$(ipo.ipoPrice)} each`}
                      </button>
                    </form>
                  )}
                </div>
              )
            })()}

            {/* ── Secondary Market Card ────────────────────────────── */}
            <div className="card market-section-card">
              <div className="market-section-label market-section-secondary">
                Secondary Market — Order Book
              </div>

              {/* Live order book */}
              <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
                <div className="card-header" style={{ paddingTop: 8 }}>
                  <div>
                    <h2 className="card-title">Live Order Book</h2>
                    {!bookLoading && (
                      <span className="card-hint">
                        {totalSecAsks === 0 && totalSecBids === 0
                          ? 'No open orders — place one below to start secondary trading'
                          : `${totalSecAsks.toLocaleString()} shares for sale · ${totalSecBids.toLocaleString()} shares bid`}
                      </span>
                    )}
                  </div>
                  <button className="btn-ghost" onClick={refreshBook}>↺</button>
                </div>

                {bookLoading ? (
                  <div className="book-empty" style={{ padding: '12px 16px' }}>Loading…</div>
                ) : totalSecAsks === 0 && totalSecBids === 0 ? (
                  <div className="empty-state" style={{ padding: '12px 16px' }}>
                    <p className="empty-state-sub">
                      No orders yet. Once IPO shares are bought, holders can place SELL orders here to start secondary market trading.
                    </p>
                  </div>
                ) : (
                  <div className="dash-grid-equal" style={{ padding: '0 0 12px' }}>
                    {/* Asks (sell orders) */}
                    <div>
                      {orderBook?.asks?.length > 0 && (
                        <div className="book-side">
                          <div className="book-side-header book-asks-header">
                            Sell Orders (Asks) — click to use price
                          </div>
                          <div className="book-cols-header">
                            <span>Price</span><span>Qty</span><span>Orders</span>
                          </div>
                          {orderBook.asks.map((lvl, i) => {
                            const maxQty = Math.max(...orderBook.asks.map(l => l.quantity), 1)
                            return (
                              <div key={i} className="book-row book-row-ask book-row-clickable"
                                style={{ '--bar-pct': `${Math.round(lvl.quantity / maxQty * 100)}%` }}
                                onClick={() => fillFromAsk(lvl.price)}>
                                <span className="book-price">{fmt$(lvl.price)}</span>
                                <span className="book-qty">{lvl.quantity.toLocaleString()}</span>
                                <span className="book-orders">{lvl.orders}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    {/* Bids (buy orders) */}
                    <div>
                      {orderBook?.bids?.length > 0 && (
                        <div className="book-side">
                          <div className="book-side-header book-bids-header">
                            Buy Orders (Bids) — click to use price
                          </div>
                          <div className="book-cols-header">
                            <span>Price</span><span>Qty</span><span>Orders</span>
                          </div>
                          {orderBook.bids.map((lvl, i) => {
                            const maxQty = Math.max(...orderBook.bids.map(l => l.quantity), 1)
                            return (
                              <div key={i} className="book-row book-row-bid book-row-clickable"
                                style={{ '--bar-pct': `${Math.round(lvl.quantity / maxQty * 100)}%` }}
                                onClick={() => fillFromBid(lvl.price)}>
                                <span className="book-price">{fmt$(lvl.price)}</span>
                                <span className="book-qty">{lvl.quantity.toLocaleString()}</span>
                                <span className="book-orders">{lvl.orders}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Secondary market order form */}
              <div style={{ paddingTop: 4 }}>
                <h2 className="card-title" style={{ marginBottom: 12 }}>Place Order</h2>

                {secMsg && (
                  <div className={`alert ${secMsg.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                    {secMsg.text}
                  </div>
                )}

                <form onSubmit={submitSecOrder} className="trade-form">
                  {/* BUY / SELL toggle */}
                  <div className="type-toggle">
                    {['BUY', 'SELL'].map(t => (
                      <button key={t} type="button"
                        className={`type-btn ${secForm.type === t
                          ? (t === 'BUY' ? 'type-btn-buy-active' : 'type-btn-sell-active')
                          : 'type-btn-inactive'}`}
                        onClick={() => setSecForm(f => ({ ...f, type: t }))}>
                        {t === 'BUY' ? '▲ BUY' : '▼ SELL'}
                      </button>
                    ))}
                  </div>

                  {/* LIMIT / MARKET toggle */}
                  <div className="type-toggle" style={{ marginTop: 6 }}>
                    {['LIMIT', 'MARKET'].map(m => (
                      <button key={m} type="button"
                        className={`type-btn ${secForm.orderMode === m ? 'type-btn-mode-active' : 'type-btn-inactive'}`}
                        onClick={() => setSecForm(f => ({ ...f, orderMode: m }))}>
                        {m}
                      </button>
                    ))}
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label className="form-label">Quantity</label>
                      <input className="form-input" type="number" min="1"
                        value={secForm.quantity}
                        onChange={e => setSecForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
                    </div>
                    {secForm.orderMode === 'LIMIT' && (
                      <div className="form-group">
                        <label className="form-label">Limit Price ($)</label>
                        <input className="form-input" type="number" min="0.01" step="0.01"
                          value={secForm.limitPrice}
                          onChange={e => setSecForm(f => ({ ...f, limitPrice: e.target.value }))}
                          placeholder="0.00" />
                      </div>
                    )}
                  </div>

                  {secForm.orderMode === 'LIMIT' && secForm.limitPrice && (
                    <div className="order-summary">
                      <div className="summary-row">
                        <span className="summary-label">
                          {secForm.type === 'BUY' ? 'Max buy value' : 'Min sell value'}
                        </span>
                        <span className="summary-value font-med">
                          {fmt$(Number(secForm.limitPrice) * secForm.quantity)}
                        </span>
                      </div>
                    </div>
                  )}

                  {secForm.orderMode === 'MARKET' && (
                    <div className="info-box" style={{ fontSize: 12 }}>
                      {secForm.type === 'BUY'
                        ? 'Executes immediately at the best available ask. Cancelled if no seller exists.'
                        : 'Executes immediately at the best available bid. Cancelled if no buyer exists.'}
                    </div>
                  )}

                  <button type="submit"
                    className={`btn-full ${secForm.type === 'BUY' ? 'btn-buy' : 'btn-sell'}`}
                    disabled={secSubmitting || (secForm.orderMode === 'LIMIT' && !secForm.limitPrice)}>
                    {secSubmitting
                      ? 'Placing order…'
                      : `${secForm.type === 'BUY' ? '▲ BUY' : '▼ SELL'} ${secForm.quantity}× ${selected.ticker}`}
                  </button>
                </form>
              </div>
            </div>

          </div>
        ) : (
          <div className="markets-empty-panel">
            <div className="empty-state">
              <div className="empty-state-icon">👈</div>
              <p className="empty-state-title">Select a stock to trade</p>
              <p className="empty-state-sub">
                Click any row to buy IPO shares from the company or trade in the secondary market.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
