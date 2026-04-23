import React, { useEffect, useState } from 'react'
import { authHeaders, companyApi } from '../api'
import { useAuth } from '../context/AuthContext'

const emptyProfile = { companyName: '', description: '', contactEmail: '', website: '' }
const emptyStock   = { ticker: '', initialPrice: '', totalShares: '', description: '' }

export default function CompanyDashboardPage() {
  const { token } = useAuth()
  const headers = authHeaders(token)

  const [profile,      setProfile]      = useState(null)
  const [profileForm,  setProfileForm]  = useState(emptyProfile)
  const [profileMsg,   setProfileMsg]   = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const [stocks,       setStocks]       = useState([])
  const [stockForm,    setStockForm]    = useState(emptyStock)
  const [editTicker,   setEditTicker]   = useState(null)
  const [stockMsg,     setStockMsg]     = useState(null)
  const [stockLoading, setStockLoading] = useState(false)

  useEffect(() => {
    loadProfile()
    loadStocks()
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
    } catch { setStocks([]) }
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
        setStockMsg({ type: 'success', text: `Stock ${editTicker} updated.` })
      } else {
        await companyApi.post('/stocks', payload, { headers })
        setStockMsg({ type: 'success', text: `Stock ${stockForm.ticker.toUpperCase()} listed and added to market.` })
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
  }

  function cancelEdit() { setEditTicker(null); setStockForm(emptyStock); setStockMsg(null) }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Company Dashboard</h1>
        <p className="page-subtitle">Manage your company profile and stock listings</p>
      </div>

      {/* Profile card */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            {profile ? `🏢 ${profile.companyName}` : 'Company Profile'}
          </h2>
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

      {/* Stock listings */}
      <div className="dash-grid">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Your Stock Listings</h2>
            <button className="btn-ghost" onClick={loadStocks}>Refresh</button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th className="text-right">Initial Price</th>
                <th className="text-right">Total Shares</th>
                <th>Description</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {stocks.length === 0 && (
                <tr><td colSpan={5} className="empty-row">No stocks listed yet. Use the form to add your first stock.</td></tr>
              )}
              {stocks.map(s => (
                <tr key={s.ticker}>
                  <td><span className="ticker-badge">{s.ticker}</span></td>
                  <td className="text-right">${Number(s.initialPrice).toFixed(2)}</td>
                  <td className="text-right">{Number(s.totalShares).toLocaleString()}</td>
                  <td className="text-muted">{s.description || '—'}</td>
                  <td><button className="btn-ghost" onClick={() => startEdit(s)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add / Edit stock form */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">{editTicker ? `Edit ${editTicker}` : 'List New Stock'}</h2>
            {editTicker && <button className="btn-ghost" onClick={cancelEdit}>Cancel</button>}
          </div>
          {stockMsg && (
            <div className={`alert ${stockMsg.type === 'success' ? 'alert-success' : 'alert-error'}`}>
              {stockMsg.text}
            </div>
          )}
          <form onSubmit={submitStock} className="company-form">
            <div className="form-group">
              <label className="form-label">Ticker Symbol *</label>
              <input className="form-input" placeholder="e.g. ACME" maxLength={8}
                value={stockForm.ticker}
                disabled={!!editTicker}
                onChange={e => setStockForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} required />
            </div>
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Initial Price (USD) *</label>
                <input className="form-input" type="number" min="0.01" step="0.01" placeholder="0.00"
                  value={stockForm.initialPrice}
                  onChange={e => setStockForm(f => ({ ...f, initialPrice: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Total Shares *</label>
                <input className="form-input" type="number" min="1" placeholder="e.g. 1000000"
                  value={stockForm.totalShares}
                  onChange={e => setStockForm(f => ({ ...f, totalShares: e.target.value }))} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" placeholder="Short description of this stock"
                value={stockForm.description}
                onChange={e => setStockForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <button type="submit" className="btn-primary" disabled={stockLoading || !profile}>
              {stockLoading ? 'Saving…' : editTicker ? 'Update Stock' : 'List Stock'}
            </button>
            {!profile && <p className="form-hint">Save your company profile first before listing stocks.</p>}
          </form>
        </div>
      </div>
    </div>
  )
}
