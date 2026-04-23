import React, { useEffect, useState } from 'react'
import { authHeaders, companyApi, priceApi, orderApi, userApi } from '../api'
import { useAuth } from '../context/AuthContext'

const emptyProfile = { companyName: '', description: '', contactEmail: '', website: '' }
const emptyStock   = { ticker: '', initialPrice: '', totalShares: '', description: '' }

export default function CompanyDashboardPage() {
  const { token } = useAuth()
  const headers = authHeaders(token)

  const [profile,        setProfile]        = useState(null)
  const [profileForm,    setProfileForm]    = useState(emptyProfile)
  const [profileMsg,     setProfileMsg]     = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const [stocks,       setStocks]       = useState([])
  const [prices,       setPrices]       = useState({})
  const [traders,      setTraders]      = useState([])
  const [stockForm,    setStockForm]    = useState(emptyStock)
  const [editTicker,   setEditTicker]   = useState(null)
  const [stockMsg,     setStockMsg]     = useState(null)
  const [stockLoading, setStockLoading] = useState(false)

  useEffect(() => {
    loadProfile()
    loadStocks()
    loadPrices()
  }, [])

  async function loadProfile() {
    try {
      const res = await companyApi.get('/profile', { headers })
      setProfile(res.data)
      setProfileForm(res.data)
    } catch { /* no profile yet */ }
  }

  async function loadStocks() {
    try {
      const res = await companyApi.get('/stocks', { headers })
      setStocks(res.data)
      if (res.data.length > 0) await loadTraders(res.data.map(s => s.ticker))
    } catch { setStocks([]) }
  }

  async function loadPrices() {
    try {
      const res = await priceApi.get('/stocks')
      const map = {}
      for (const p of res.data) map[p.ticker] = p
      setPrices(map)
    } catch { setPrices({}) }
  }

  async function loadTraders(tickers) {
    if (!tickers || tickers.length === 0) { setTraders([]); return }
    try {
      const holdersRes = await orderApi.get('/holders', {
        headers,
        params: { tickers: tickers.join(',') }
      })
      const holders = holdersRes.data
      if (holders.length === 0) { setTraders([]); return }

      const uniqueIds = [...new Set(holders.map(h => h.userId))]
      const usersRes = await userApi.get('/batch', {
        headers,
        params: { ids: uniqueIds.join(',') }
      })
      const userMap = {}
      for (const u of usersRes.data) userMap[u.id] = u.username

      const byUser = {}
      for (const h of holders) {
        if (!byUser[h.userId]) {
          byUser[h.userId] = { userId: h.userId, username: userMap[h.userId] || `User #${h.userId}`, holdings: [], total: 0 }
        }
        byUser[h.userId].holdings.push({ ticker: h.stockTicker, quantity: h.quantity })
        byUser[h.userId].total += h.quantity
      }
      setTraders(Object.values(byUser).sort((a, b) => b.total - a.total))
    } catch { setTraders([]) }
  }

  async function saveProfile(e) {
    e.preventDefault()
    setProfileMsg(null); setProfileLoading(true)
    try {
      const res = await companyApi.post('/profile', profileForm, { headers })
      setProfile(res.data)
      setProfileMsg({ type: 'success', text: 'Company profile saved successfully.' })
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.message || 'Failed to save profile.' })
    } finally { setProfileLoading(false) }
  }

  async function submitStock(e) {
    e.preventDefault()
    setStockMsg(null); setStockLoading(true)
    const payload = { ...stockForm, initialPrice: Number(stockForm.initialPrice), totalShares: Number(stockForm.totalShares) }
    try {
      if (editTicker) {
        await companyApi.put(`/stocks/${editTicker}`, payload, { headers })
        setStockMsg({ type: 'success', text: `Stock ${editTicker} updated successfully.` })
      } else {
        await companyApi.post('/stocks', payload, { headers })
        setStockMsg({ type: 'success', text: `${stockForm.ticker.toUpperCase()} has been listed on the market.` })
      }
      setStockForm(emptyStock); setEditTicker(null)
      loadStocks()
    } catch (err) {
      setStockMsg({ type: 'error', text: err.response?.data?.message || 'Failed to save stock.' })
    } finally { setStockLoading(false) }
  }

  function startEdit(s) {
    setEditTicker(s.ticker)
    setStockForm({ ticker: s.ticker, initialPrice: String(s.initialPrice), totalShares: String(s.totalShares), description: s.description || '' })
    setStockMsg(null)
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }

  function cancelEdit() { setEditTicker(null); setStockForm(emptyStock); setStockMsg(null) }

  return (
    <div className="page">

      {/* ── Header ── */}
      <div className="page-header">
        <h1 className="page-title">{profile ? `🏢 ${profile.companyName}` : 'Company Dashboard'}</h1>
        <p className="page-subtitle">Stock performance, trader activity, and listing management</p>
      </div>

      {!profile && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          Your company profile is not set up yet. Complete it at the bottom of this page before listing stocks.
        </div>
      )}

      {/* ── 1. Stock Listings Summary ── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Stock Listings Summary</h2>
          <button className="btn-ghost" onClick={() => { loadStocks(); loadPrices() }}>Refresh</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th className="text-right">Current Price</th>
                <th className="text-right">Initial Price</th>
                <th className="text-right">IPO Shares</th>
                <th className="text-right">Trading Shares</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {stocks.length === 0 && (
                <tr><td colSpan={6} className="empty-row">No stocks listed yet. Use the form below to add your first stock.</td></tr>
              )}
              {stocks.map(s => {
                const p = prices[s.ticker]
                return (
                  <tr key={s.ticker}>
                    <td><span className="ticker-badge">{s.ticker}</span></td>
                    <td className="text-right">
                      {p ? `$${Number(p.currentPrice).toFixed(2)}` : <span className="text-muted">—</span>}
                    </td>
                    <td className="text-right">${Number(s.initialPrice).toFixed(2)}</td>
                    <td className="text-right">{Number(s.totalShares).toLocaleString()}</td>
                    <td className="text-right">{Number(s.totalShares).toLocaleString()}</td>
                    <td>
                      <button className="btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => startEdit(s)}>Edit</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 2. Last Trade Details ── */}
      {stocks.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Last Trade Details</h2>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '4px 0' }}>
            {stocks.map(s => {
              const p = prices[s.ticker]
              const isBuy = p?.lastTradeType === 'BUY'
              return (
                <div key={s.ticker} style={{
                  flex: '1 1 220px', border: '1px solid var(--border)', borderRadius: 10,
                  padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10,
                  background: 'var(--surface)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="ticker-badge">{s.ticker}</span>
                    {p?.lastTradeType
                      ? <span className={`badge ${isBuy ? 'badge-success' : 'badge-danger'}`} style={{ fontWeight: 700, fontSize: '0.8rem' }}>
                          {isBuy ? '▲ BUY' : '▼ SELL'}
                        </span>
                      : <span className="badge badge-warning">No trades yet</span>
                    }
                  </div>
                  {p?.lastTradeType ? (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Trade Price</span>
                          <span style={{ fontWeight: 600 }}>${Number(p.lastTradePrice).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Trade Value</span>
                          <span style={{ fontWeight: 600 }}>${Number(p.lastTradeValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Current Price</span>
                          <span style={{ fontWeight: 600 }}>${Number(p.currentPrice).toFixed(2)}</span>
                        </div>
                      </div>
                      {p.lastUpdatedAt && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                          {p.lastUpdatedAt}
                        </div>
                      )}
                    </>
                  ) : (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                      No trades have been placed for this stock yet.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 3. Traders ── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Traders</h2>
          <button className="btn-ghost" onClick={() => loadTraders(stocks.map(s => s.ticker))}>Refresh</button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Stock Holder</th>
              <th>Stocks Held</th>
              <th className="text-right">Total Shares</th>
            </tr>
          </thead>
          <tbody>
            {traders.length === 0 && (
              <tr><td colSpan={4} className="empty-row">No traders yet — no shares have been purchased.</td></tr>
            )}
            {traders.map((t, i) => (
              <tr key={t.userId}>
                <td style={{ color: 'var(--text-muted)', width: 36 }}>{i + 1}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0,
                    }}>
                      {t.username.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontWeight: 500 }}>{t.username}</span>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {t.holdings.map(h => (
                      <span key={h.ticker} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: '#f1f5f9', borderRadius: 6, padding: '2px 8px', fontSize: '0.8rem',
                      }}>
                        <span className="ticker-badge" style={{ fontSize: '0.7rem', padding: '1px 5px' }}>{h.ticker}</span>
                        <span style={{ fontWeight: 600 }}>{h.quantity.toLocaleString()}</span>
                      </span>
                    ))}
                  </div>
                </td>
                <td className="text-right" style={{ fontWeight: 700 }}>{t.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── 4. List / Edit Stock ── */}
      <div className="card">
        <div style={{
          background: editTicker ? 'linear-gradient(135deg, #fef3c7, #fffbeb)' : 'linear-gradient(135deg, #eff6ff, #f0fdf4)',
          borderRadius: 10, padding: '20px 24px', marginBottom: 20,
          border: `1px solid ${editTicker ? '#fde68a' : '#bbf7d0'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                {editTicker ? `✏️ Editing — ${editTicker}` : '📈 List a New Stock'}
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {editTicker ? 'Update the details for this listing.' : 'Add your company stock to the market for traders to buy and sell.'}
              </p>
            </div>
            {editTicker && <button className="btn-ghost" onClick={cancelEdit} style={{ flexShrink: 0 }}>Cancel</button>}
          </div>
        </div>

        {stockMsg && (
          <div className={`alert ${stockMsg.type === 'success' ? 'alert-success' : 'alert-error'}`}>
            {stockMsg.text}
          </div>
        )}

        <form onSubmit={submitStock} className="company-form">
          <div className="form-group">
            <label className="form-label">
              Ticker Symbol *
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6, fontSize: '0.78rem' }}>
                Short code used on the market (e.g. AAPL, TSLA)
              </span>
            </label>
            <input className="form-input" placeholder="e.g. ACME" maxLength={8}
              value={stockForm.ticker} disabled={!!editTicker}
              style={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.08em', fontSize: '1rem' }}
              onChange={e => setStockForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} required />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">
                IPO Price (USD) *
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6, fontSize: '0.78rem' }}>Opening price per share</span>
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 600, pointerEvents: 'none' }}>$</span>
                <input className="form-input" type="number" min="0.01" step="0.01" placeholder="0.00"
                  style={{ paddingLeft: 24 }} value={stockForm.initialPrice}
                  onChange={e => setStockForm(f => ({ ...f, initialPrice: e.target.value }))} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">
                Total Shares *
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6, fontSize: '0.78rem' }}>Total shares issued at IPO</span>
              </label>
              <input className="form-input" type="number" min="1" placeholder="e.g. 1,000,000"
                value={stockForm.totalShares}
                onChange={e => setStockForm(f => ({ ...f, totalShares: e.target.value }))} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Description
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6, fontSize: '0.78rem' }}>Optional</span>
            </label>
            <input className="form-input" placeholder="Brief description shown to traders on the market"
              value={stockForm.description}
              onChange={e => setStockForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          {!profile && (
            <div className="alert alert-error" style={{ marginBottom: 8 }}>
              Save your company profile first before listing stocks.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button type="submit" className="btn-primary" disabled={stockLoading || !profile} style={{ minWidth: 140 }}>
              {stockLoading ? 'Saving…' : editTicker ? '✓ Update Stock' : '+ List on Market'}
            </button>
            {editTicker && <button type="button" className="btn-ghost" onClick={cancelEdit}>Discard changes</button>}
          </div>
        </form>
      </div>

      {/* ── 5. Company Profile (settings) ── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{profile ? `🏢 ${profile.companyName}` : 'Company Profile'}</h2>
          {!profile && <span className="badge badge-warning">Profile not set up</span>}
        </div>
        {profileMsg && (
          <div className={`alert ${profileMsg.type === 'success' ? 'alert-success' : 'alert-error'}`}>
            {profileMsg.text}
          </div>
        )}
        <form onSubmit={saveProfile} className="company-form">
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Company Name *</label>
              <input className="form-input" placeholder="e.g. Acme Corp"
                value={profileForm.companyName}
                onChange={e => setProfileForm(f => ({ ...f, companyName: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Contact Email</label>
              <input className="form-input" type="email" placeholder="contact@company.com"
                value={profileForm.contactEmail || ''}
                onChange={e => setProfileForm(f => ({ ...f, contactEmail: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input form-textarea" rows={3} placeholder="Describe your company…"
              value={profileForm.description || ''}
              onChange={e => setProfileForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Website</label>
            <input className="form-input" placeholder="https://example.com"
              value={profileForm.website || ''}
              onChange={e => setProfileForm(f => ({ ...f, website: e.target.value }))} />
          </div>
          <div>
            <button type="submit" className="btn-primary" disabled={profileLoading}>
              {profileLoading ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

    </div>
  )
}
