import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { authHeaders, bookApi, companyApi, orderApi, priceApi } from '../api'
import { useAuth } from '../context/AuthContext'

const PAGE_SIZE = 10

function fmt$(n) { return `$${Number(n).toFixed(2)}` }

function Pager({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="table-pager">
      <button className="table-pager-btn" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>Prev</button>
      <span className="table-pager-info">Page {page} of {totalPages}</span>
      <button className="table-pager-btn" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>Next</button>
    </div>
  )
}

export default function MarketsPage() {
  const { token } = useAuth()
  const headers = authHeaders(token)

  const [listings, setListings]             = useState([])
  const [prices, setPrices]                 = useState([])
  const [ipoAllocations, setIpoAllocations] = useState([])
  const [portfolio, setPortfolio]           = useState([])
  const [selected, setSelected]             = useState(null)
  const [orderBook, setOrderBook]           = useState(null)
  const [bookLoading, setBookLoading]       = useState(false)
  const [showModal, setShowModal]           = useState(false)
  const [activeTab, setActiveTab]           = useState('primary') // 'primary' | 'secondary'
  const [listingsPage, setListingsPage]     = useState(1)
  const [marketTradesPage, setMarketTradesPage] = useState(1)

  // Primary market (IPO) form state
  const [ipoQty, setIpoQty]       = useState(1)
  const [ipoBuying, setIpoBuying] = useState(false)
  const [ipoMsg, setIpoMsg]       = useState(null)

  // Secondary market form state
  const [secForm, setSecForm]           = useState({ type: 'BUY', quantity: 1, limitPrice: '', orderMode: 'LIMIT' })
  const [secSubmitting, setSecSubmitting] = useState(false)
  const [secMsg, setSecMsg]             = useState(null)

  const loadData = useCallback(async () => {
    const [listRes, priceRes, ipoRes, portRes] = await Promise.allSettled([
      companyApi.get('/public/stocks'),
      priceApi.get('/stocks'),
      orderApi.get('/ipo', { headers }),
      orderApi.get('/portfolio', { headers }),
    ])
    if (listRes.status === 'fulfilled')  setListings(listRes.value.data)
    if (priceRes.status === 'fulfilled') setPrices(priceRes.value.data)
    if (ipoRes.status === 'fulfilled')   setIpoAllocations(ipoRes.value.data)
    if (portRes.status === 'fulfilled')  setPortfolio(portRes.value.data)
  }, [token])

  useEffect(() => { loadData() }, [loadData])

  // Close modal on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') closeModal() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Sorted listings (A-Z by company name)
  const sortedListings = useMemo(
    () => [...listings].sort((a, b) => String(a.companyName).localeCompare(String(b.companyName))),
    [listings]
  )

  const listingsPageCount = Math.max(1, Math.ceil(sortedListings.length / PAGE_SIZE))
  const displayedListings = sortedListings.slice((listingsPage - 1) * PAGE_SIZE, listingsPage * PAGE_SIZE)

  function getPrice(ticker)  { return prices.find(p => p.ticker === ticker) }
  function getIpo(ticker)    { return ipoAllocations.find(a => a.ticker === ticker) }
  function getOwnedShares(ticker) {
    const pos = portfolio.find(p => p.stockTicker === ticker)
    return pos ? pos.quantity : 0
  }

  async function openTradeModal(listing) {
    setSelected(listing)
    setIpoMsg(null)
    setSecMsg(null)
    setOrderBook(null)
    setIpoQty(1)
    setSecForm({ type: 'BUY', quantity: 1, limitPrice: '', orderMode: 'LIMIT' })

    // decide default tab: primary if IPO has shares, else secondary
    const ipo = ipoAllocations.find(a => a.ticker === listing.ticker)
    setActiveTab(ipo && ipo.remainingShares > 0 ? 'primary' : 'secondary')

    setShowModal(true)
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

  function closeModal() {
    setShowModal(false)
    setSelected(null)
    setOrderBook(null)
    setIpoMsg(null)
    setSecMsg(null)
  }

  async function refreshBook() {
    if (!selected) return
    setBookLoading(true)
    try {
      const r = await bookApi.get(`/${selected.ticker}`)
      setOrderBook(r.data)
    } catch {} finally { setBookLoading(false) }
  }

  // ── Primary market: direct IPO purchase ──────────────────────────────────
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

  // ── Secondary market: place BUY or SELL order through matching engine ─────
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
      // Refresh portfolio to update owned count
      orderApi.get('/portfolio', { headers }).then(r => setPortfolio(r.data)).catch(() => {})
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

      {/* ── Listed stocks table (full width) ──────────────────── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Listed Stocks</h2>
          <span className="card-hint">{listings.length} listing{listings.length !== 1 ? 's' : ''}</span>
        </div>

        {sortedListings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏢</div>
            <p className="empty-state-title">No stocks listed yet</p>
            <p className="empty-state-sub">Company accounts can list stocks from their Company Dashboard.</p>
          </div>
        ) : (
          <>
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
                  {displayedListings.map(l => {
                  const mkt          = getPrice(l.ticker)
                  const ipo          = getIpo(l.ticker)
                  const chgPct       = mkt && mkt.changePct != null ? Number(mkt.changePct) : null
                  const ipoActive    = ipo && ipo.remainingShares > 0
                  const hasSecondary = mkt && mkt.lastTradePrice != null
                  return (
                    <tr key={l.ticker}
                      className="table-row-clickable"
                      onClick={() => openTradeModal(l)}>
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
                          onClick={e => { e.stopPropagation(); openTradeModal(l) }}>
                          Trade →
                        </button>
                      </td>
                    </tr>
                  )
                })}
                </tbody>
              </table>
            </div>
            <Pager page={listingsPage} totalPages={listingsPageCount} onPageChange={setListingsPage} />
          </>
        )}
      </div>

      {/* ── Trade Popup Modal ──────────────────────────────────── */}
      {showModal && selected && (
        <div className="trade-modal-overlay" onClick={closeModal}>
          <div className="trade-modal" onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="trade-modal-header">
              <div className="trade-modal-header-info">
                <span className="ticker-badge" style={{ fontSize: 15 }}>{selected.ticker}</span>
                <div>
                  <div className="trade-modal-company">{selected.companyName}</div>
                  {selected.description && (
                    <div className="trade-modal-desc">{selected.description}</div>
                  )}
                </div>
              </div>
              <button className="trade-modal-close" onClick={closeModal} title="Close (Esc)">✕</button>
            </div>

            {/* Price stats */}
            <div className="trade-modal-stats">
              <div className="trade-modal-stat">
                <span className="stat-label">IPO Price</span>
                <span className="trade-modal-stat-val">{fmt$(selected.initialPrice)}</span>
              </div>
              <div className="trade-modal-stat">
                <span className="stat-label">IPO Remaining</span>
                <span className="trade-modal-stat-val">
                  {(() => {
                    const ipo = getIpo(selected.ticker)
                    if (!ipo) return <span className="text-muted">—</span>
                    return ipo.remainingShares > 0
                      ? <span className="pnl-positive">{Number(ipo.remainingShares).toLocaleString()}</span>
                      : <span className="text-muted">Sold out</span>
                  })()}
                </span>
              </div>
              <div className="trade-modal-stat">
                <span className="stat-label">Market Price</span>
                <span className="trade-modal-stat-val">
                  {getPrice(selected.ticker)
                    ? fmt$(getPrice(selected.ticker).currentPrice)
                    : <span className="text-muted text-sm">No trades yet</span>}
                </span>
              </div>
              <div className="trade-modal-stat">
                <span className="stat-label">Total Shares</span>
                <span className="trade-modal-stat-val">{Number(selected.totalShares).toLocaleString()}</span>
              </div>
              {getOwnedShares(selected.ticker) > 0 && (
                <div className="trade-modal-stat">
                  <span className="stat-label">You Own</span>
                  <span className="trade-modal-stat-val pnl-positive">
                    {getOwnedShares(selected.ticker).toLocaleString()} shares
                  </span>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="trade-modal-tabs">
              {[
                { key: 'primary',   label: '🏛 Primary Market — IPO' },
                { key: 'secondary', label: '📈 Secondary Market — Order Book' },
              ].map(t => (
                <button key={t.key}
                  className={`trade-modal-tab ${activeTab === t.key ? 'trade-modal-tab-active' : ''}`}
                  onClick={() => setActiveTab(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="trade-modal-body">

              {/* ── PRIMARY MARKET TAB ── */}
              {activeTab === 'primary' && (() => {
                const ipo = getIpo(selected.ticker)
                if (!ipo) return (
                  <div className="empty-state" style={{ padding: '40px 24px' }}>
                    <div className="empty-state-icon">🔍</div>
                    <p className="empty-state-title">No IPO data available</p>
                    <p className="empty-state-sub">This stock does not have an active IPO allocation.</p>
                  </div>
                )
                return (
                  <div>
                    <div className="trade-modal-section-label trade-modal-section-primary">
                      Buy from Company · Fixed Price · Instant Settlement
                    </div>

                    {ipoMsg && (
                      <div className={`alert ${ipoMsg.type === 'success' ? 'alert-success' : 'alert-error'}`}
                        style={{ margin: '12px 20px 0' }}>
                        {ipoMsg.text}
                      </div>
                    )}

                    {ipo.remainingShares <= 0 ? (
                      <div className="empty-state" style={{ padding: '32px 24px' }}>
                        <div className="empty-state-icon">✅</div>
                        <p className="empty-state-title">IPO fully subscribed</p>
                        <p className="empty-state-sub">
                          All {Number(ipo.totalShares).toLocaleString()} IPO shares have been purchased.
                          Switch to the Secondary Market tab to trade.
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

              {/* ── SECONDARY MARKET TAB ── */}
              {activeTab === 'secondary' && (
                <div>
                  <div className="trade-modal-section-label trade-modal-section-secondary">
                    Trade with Investors · Live Order Book · Matching Engine
                  </div>

                  {/* Live order book */}
                  <div style={{ borderBottom: '1px solid var(--border)', padding: '12px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span className="card-title" style={{ fontSize: 13 }}>Live Order Book</span>
                      <button className="btn-ghost" onClick={refreshBook}>↺ Refresh</button>
                    </div>
                    {!bookLoading && (
                      <span className="card-hint">
                        {totalSecAsks === 0 && totalSecBids === 0
                          ? 'No open orders — place one below to start secondary trading'
                          : `${totalSecAsks.toLocaleString()} shares for sale · ${totalSecBids.toLocaleString()} shares bid`}
                      </span>
                    )}

                    {bookLoading ? (
                      <div className="book-empty" style={{ padding: '12px 0' }}>Loading…</div>
                    ) : totalSecAsks === 0 && totalSecBids === 0 ? (
                      <div className="empty-state" style={{ padding: '16px 0' }}>
                        <p className="empty-state-sub">
                          No orders yet. Once IPO shares are bought, holders can place SELL orders to start secondary market trading.
                        </p>
                      </div>
                    ) : (
                      <div className="dash-grid-equal" style={{ marginTop: 10 }}>
                        {/* Asks */}
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
                        {/* Bids */}
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

                  {/* Place order form */}
                  <div>
                    <div style={{ padding: '12px 20px 0' }}>
                      <h3 className="card-title" style={{ marginBottom: 2 }}>Place Order</h3>
                    </div>

                    {secMsg && (
                      <div className={`alert ${secMsg.type === 'success' ? 'alert-success' : 'alert-error'}`}
                        style={{ margin: '8px 20px 0' }}>
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

                      {/* Show user's stock count when SELL is selected */}
                      {secForm.type === 'SELL' && (
                        <div className="trade-modal-owned-banner">
                          <span className="trade-modal-owned-label">You currently own</span>
                          <span className={`trade-modal-owned-count ${getOwnedShares(selected.ticker) === 0 ? 'trade-modal-owned-zero' : ''}`}>
                            {getOwnedShares(selected.ticker).toLocaleString()} shares of {selected.ticker}
                          </span>
                          {getOwnedShares(selected.ticker) === 0 && (
                            <span className="trade-modal-owned-hint">You have no shares to sell</span>
                          )}
                        </div>
                      )}

                      {/* LIMIT / MARKET toggle */}
                      <div className="type-toggle" style={{ marginTop: 4 }}>
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
                            max={secForm.type === 'SELL' ? getOwnedShares(selected.ticker) || undefined : undefined}
                            value={secForm.quantity}
                            onChange={e => setSecForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
                          {secForm.type === 'SELL' && secForm.quantity > getOwnedShares(selected.ticker) && getOwnedShares(selected.ticker) > 0 && (
                            <span style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }}>
                              Exceeds your {getOwnedShares(selected.ticker)} shares
                            </span>
                          )}
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
                        disabled={
                          secSubmitting ||
                          (secForm.orderMode === 'LIMIT' && !secForm.limitPrice) ||
                          (secForm.type === 'SELL' && getOwnedShares(selected.ticker) === 0)
                        }>
                        {secSubmitting
                          ? 'Placing order…'
                          : `${secForm.type === 'BUY' ? '▲ BUY' : '▼ SELL'} ${secForm.quantity}× ${selected.ticker}`}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
