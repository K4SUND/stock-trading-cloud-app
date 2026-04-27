import React, { useEffect, useRef, useState, useCallback } from 'react'
import axios from 'axios'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { useLocation, useNavigate } from 'react-router-dom'
import { GATEWAY, WS_URL, authHeaders, bookApi, companyApi, orderApi, paymentApi, priceApi, userApi } from '../api'
import { useAuth } from '../context/AuthContext'

const ROLES = ['ROLE_USER', 'ROLE_COMPANY', 'ROLE_ADMIN']
const ROLE_META = {
  ROLE_USER:    { label: 'Trader',  cls: 'badge-info'    },
  ROLE_COMPANY: { label: 'Company', cls: 'badge-warning' },
  ROLE_ADMIN:   { label: 'Admin',   cls: 'badge-danger'  },
}

function fmt$(n) { return `$${Number(n).toFixed(2)}` }

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}
function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
function ActivityIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}
function ServerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>
      <line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
    </svg>
  )
}
function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  )
}
function MarketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
    </svg>
  )
}

export default function AdminPage() {
  const { token, user: me } = useAuth()
  const headers = authHeaders(token)
  const location = useLocation()
  const navigate = useNavigate()

  const tabFromUrl = new URLSearchParams(location.search).get('tab') || 'admin'
  const [activeTab, setActiveTab] = useState(tabFromUrl)

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab') || 'admin'
    setActiveTab(tab)
  }, [location.search])

  // ── Admin tab state ────────────────────────────────────────────────────────
  const [users,         setUsers]         = useState([])
  const [health,        setHealth]        = useState(null)
  const [search,        setSearch]        = useState('')
  const [roleFilter,    setRoleFilter]    = useState('')
  const [msg,           setMsg]           = useState(null)
  const [saving,        setSaving]        = useState(null)
  const [deleting,      setDeleting]      = useState(null)
  const [selectedUser,  setSelectedUser]  = useState(null)
  const [userDetail,    setUserDetail]    = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailTab,     setDetailTab]     = useState('portfolio')
  const [marketOpen,    setMarketOpen]    = useState(null)
  const [marketBusy,    setMarketBusy]    = useState(false)

  // ── Dashboard tab state ────────────────────────────────────────────────────
  const [stocks,      setStocks]      = useState([])
  const [priceDirs,   setPriceDirs]   = useState({})
  const [marketTrades,setMarketTrades]= useState([])
  const [orderBook,   setOrderBook]   = useState(null)
  const [bookTicker,  setBookTicker]  = useState(null)
  const [bookLoading, setBookLoading] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const [activity,    setActivity]    = useState([])
  const prevPricesRef = useRef({})

  // ── Market tab state ───────────────────────────────────────────────────────
  const [listings,       setListings]       = useState([])
  const [ipoAllocations, setIpoAllocations] = useState([])

  // ── Load helpers ───────────────────────────────────────────────────────────
  const loadAdmin = useCallback(async () => {
    const [usersRes, healthRes, marketRes] = await Promise.allSettled([
      userApi.get('/admin/users', { headers }),
      axios.get(`${GATEWAY}/actuator/health`),
      orderApi.get('/market/status'),
    ])
    if (usersRes.status  === 'fulfilled') setUsers(usersRes.value.data)
    else setMsg({ type: 'error', text: 'Failed to load users.' })
    if (healthRes.status === 'fulfilled') setHealth(healthRes.value.data)
    if (marketRes.status === 'fulfilled') setMarketOpen(marketRes.value.data.open)
  }, [token])

  const loadDashboard = useCallback(async () => {
    const [stocksRes, tradesRes, marketRes] = await Promise.allSettled([
      priceApi.get('/stocks'),
      orderApi.get('/market/trades'),
      orderApi.get('/market/status'),
    ])
    if (stocksRes.status === 'fulfilled') setStocks(stocksRes.value.data)
    if (tradesRes.status === 'fulfilled') setMarketTrades(tradesRes.value.data)
    if (marketRes.status === 'fulfilled') setMarketOpen(marketRes.value.data.open)
  }, [token])

  const loadMarket = useCallback(async () => {
    const [listRes, ipoRes] = await Promise.allSettled([
      companyApi.get('/public/stocks'),
      orderApi.get('/ipo', { headers }),
    ])
    if (listRes.status === 'fulfilled') setListings(listRes.value.data)
    if (ipoRes.status  === 'fulfilled') setIpoAllocations(ipoRes.value.data)
  }, [token])

  useEffect(() => {
    loadAdmin()
    loadDashboard()
    loadMarket()
  }, [loadAdmin, loadDashboard, loadMarket])

  function pushActivity(text) {
    setActivity(prev => [`[${new Date().toLocaleTimeString()}] ${text}`, ...prev].slice(0, 30))
  }

  // WebSocket: live price feed (always active)
  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
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
                setTimeout(() => {
                  orderApi.get('/market/trades').then(r => setMarketTrades(r.data)).catch(() => {})
                }, 800)
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

  async function loadOrderBook(ticker) {
    setBookTicker(ticker)
    setBookLoading(true)
    setOrderBook(null)
    try {
      const r = await bookApi.get(`/${ticker}`)
      setOrderBook(r.data)
    } catch {
      setOrderBook({ ticker, bids: [], asks: [] })
    } finally {
      setBookLoading(false)
    }
  }

  // ── Admin tab handlers ─────────────────────────────────────────────────────
  async function toggleStatus(userId, currentActive) {
    setSaving(userId); setMsg(null)
    try {
      await userApi.patch(`/admin/users/${userId}/status`, {}, { headers })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, active: !currentActive } : u))
      setMsg({ type: 'success', text: currentActive ? 'User has been deactivated.' : 'User has been activated.' })
    } catch (err) {
      const detail = err?.response?.data?.error || 'Failed to update status.'
      setMsg({ type: 'error', text: detail })
    } finally { setSaving(null) }
  }

  async function deleteUser(userId, username) {
    if (!window.confirm(`Permanently delete user "${username}"?\n\nThis cannot be undone.`)) return
    setDeleting(userId); setMsg(null)
    try {
      await userApi.delete(`/admin/users/${userId}`, { headers })
      setUsers(prev => prev.filter(u => u.id !== userId))
      setMsg({ type: 'success', text: `User "${username}" has been deleted.` })
    } catch (err) {
      const detail = err?.response?.data?.error || 'Failed to delete user.'
      setMsg({ type: 'error', text: detail })
    } finally { setDeleting(null) }
  }

  async function toggleMarket() {
    setMarketBusy(true); setMsg(null)
    try {
      const endpoint = marketOpen ? '/admin/market/close' : '/admin/market/open'
      const res = await orderApi.post(endpoint, {}, { headers })
      setMarketOpen(res.data.open)
      setMsg({ type: 'success', text: `Market is now ${res.data.open ? 'OPEN' : 'CLOSED'}.` })
    } catch {
      setMsg({ type: 'error', text: 'Failed to update market status.' })
    } finally { setMarketBusy(false) }
  }

  async function openUserDetail(user) {
    const isCompany = user.role === 'ROLE_COMPANY'
    setSelectedUser(user); setUserDetail(null)
    setDetailLoading(true); setDetailTab(isCompany ? 'listings' : 'portfolio')

    const fetches = [
      paymentApi.get(`/admin/users/${user.id}/wallet`,  { headers }),
      orderApi.get(`/admin/users/${user.id}/portfolio`, { headers }),
      orderApi.get(`/admin/users/${user.id}/orders`,    { headers }),
    ]
    if (isCompany) fetches.push(companyApi.get('/public/all'))

    const [walletRes, portfolioRes, ordersRes, allCompaniesRes] = await Promise.allSettled(fetches)

    let companyProfile = null
    let companyStocks  = []
    if (isCompany && allCompaniesRes?.status === 'fulfilled') {
      companyProfile = allCompaniesRes.value.data.find(c => c.userId === user.id) || null
    }

    setUserDetail({
      wallet:        walletRes.status    === 'fulfilled' ? walletRes.value.data    : null,
      portfolio:     portfolioRes.status === 'fulfilled' ? portfolioRes.value.data : [],
      orders:        ordersRes.status    === 'fulfilled' ? ordersRes.value.data    : [],
      companyProfile,
      companyStocks,
    })
    setDetailLoading(false)
  }

  function closeDetail() { setSelectedUser(null); setUserDetail(null) }

  // ── Derived values ─────────────────────────────────────────────────────────
  const counts = ROLES.reduce((acc, r) => ({
    ...acc, [r]: users.filter(u => u.role === r).length
  }), {})
  const filtered = users.filter(u => {
    const matchSearch = u.username.toLowerCase().includes(search.toLowerCase())
    const matchRole = !roleFilter || u.role === roleFilter
    return matchSearch && matchRole
  })
  const healthStatus = health?.status ?? null
  const healthUp     = healthStatus === 'UP'
  const components   = health?.components ? Object.entries(health.components) : []

  const getPrice = (ticker) => stocks.find(s => s.ticker === ticker)
  const getIpo   = (ticker) => ipoAllocations.find(a => a.ticker === ticker)

  const selectedUserMeta = selectedUser ? (ROLE_META[selectedUser.role] || ROLE_META.ROLE_USER) : null
  const isCompanyUser    = selectedUser?.role === 'ROLE_COMPANY'
  const companyStocksForModal = isCompanyUser && userDetail?.companyProfile
    ? listings.filter(l => l.companyName === userDetail.companyProfile.companyName)
    : []
  const ipoActiveCount = listings.filter(l => {
    const ipo = getIpo(l.ticker)
    return ipo && ipo.remainingShares > 0
  }).length
  const totalVolume = marketTrades.reduce((s, t) => s + (t.value || 0), 0)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page">

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ADMIN TAB                                                           */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'admin' && (
        <>
          <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="stat-card" style={{ borderTop: '3px solid #2563eb' }}>
              <span className="stat-label">Total Users</span>
              <span className="stat-value" style={{ color: '#2563eb' }}>{users.length}</span>
            </div>
            <div className="stat-card" style={{ borderTop: '3px solid #16a34a' }}>
              <span className="stat-label">Traders</span>
              <span className="stat-value" style={{ color: '#16a34a' }}>{counts.ROLE_USER || 0}</span>
            </div>
            <div className="stat-card" style={{ borderTop: '3px solid #d97706' }}>
              <span className="stat-label">Companies</span>
              <span className="stat-value" style={{ color: '#d97706' }}>{counts.ROLE_COMPANY || 0}</span>
            </div>
            <div className="stat-card" style={{ borderTop: '3px solid #dc2626' }}>
              <span className="stat-label">Admins</span>
              <span className="stat-value" style={{ color: '#dc2626' }}>{counts.ROLE_ADMIN || 0}</span>
            </div>
          </div>

          {msg && (
            <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-error'}`}
                 style={{ margin: 0 }}>
              {msg.text}
            </div>
          )}

          {/* Market Control */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--text-sec)' }}><ActivityIcon /></span>
                <h2 className="card-title">Market Control</h2>
              </div>
              <button className="btn-ghost" onClick={loadAdmin}>Refresh</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '24px 24px 20px' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 16, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
                background: marketOpen === false ? 'var(--danger-bg)' : 'var(--success-bg)',
                border: `2px solid ${marketOpen === false ? 'var(--danger-border)' : 'var(--success-border)'}`,
              }}>
                {marketOpen === false ? '🔴' : '🟢'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 22, fontWeight: 800,
                  color: marketOpen === false ? 'var(--danger)' : marketOpen === true ? 'var(--success)' : 'var(--text-muted)',
                }}>
                  {marketOpen === null ? 'Loading…' : marketOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-sec)', marginTop: 4 }}>
                  {marketOpen === true  && 'Trading is enabled. All users can place buy and sell orders.'}
                  {marketOpen === false && 'Trading is halted. New orders are blocked until market reopens.'}
                  {marketOpen === null  && 'Fetching current market status…'}
                </div>
              </div>
              <button
                style={{
                  padding: '11px 28px', borderRadius: 8, fontWeight: 700, fontSize: 14,
                  border: 'none', cursor: marketBusy || marketOpen === null ? 'not-allowed' : 'pointer',
                  opacity: marketBusy || marketOpen === null ? 0.6 : 1, transition: 'opacity .15s',
                  background: marketOpen ? 'var(--danger)' : 'var(--success)',
                  color: '#fff', minWidth: 140,
                }}
                disabled={marketBusy || marketOpen === null}
                onClick={toggleMarket}
              >
                {marketBusy ? 'Updating…' : marketOpen ? 'Close Market' : 'Open Market'}
              </button>
            </div>
          </div>

          {/* System Health */}
          {components.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--text-sec)' }}><ServerIcon /></span>
                  <h2 className="card-title">System Health</h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`badge ${healthUp ? 'badge-success' : 'badge-danger'}`}>
                    <span className={`live-dot ${healthUp ? 'live-dot-on' : 'live-dot-off'}`} />
                    {healthStatus}
                  </span>
                  <button className="btn-ghost" onClick={loadAdmin}>Refresh</button>
                </div>
              </div>
              <div className="health-grid">
                {components.map(([name, comp]) => {
                  const up = comp.status === 'UP'
                  return (
                    <div key={name} className="health-item">
                      <span className={`live-dot ${up ? 'live-dot-on' : 'live-dot-off'}`} />
                      <span className="health-name">{name}</span>
                      <span className={`badge ${up ? 'badge-success' : 'badge-danger'}`}
                            style={{ fontSize: 11, padding: '2px 8px' }}>
                        {comp.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* User Management */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--text-sec)' }}><UsersIcon /></span>
                <h2 className="card-title">User Management</h2>
                <span className="badge badge-info" style={{ marginLeft: 4 }}>{users.length}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="form-input"
                  style={{ padding: '6px 10px', width: 200 }}
                  placeholder="Search by username…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setMsg(null) }}
                />
                <select
                  className="role-select"
                  value={roleFilter}
                  onChange={e => { setRoleFilter(e.target.value); setMsg(null) }}
                  style={{ padding: '6px 10px' }}
                >
                  <option value="">All Roles</option>
                  {ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_META[r].label}</option>
                  ))}
                </select>
                <button className="btn-ghost" onClick={loadAdmin}>Refresh</button>
              </div>
            </div>
            <div className="table-scroll">
              <table className="data-table" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: 48 }}>#</th>
                    <th style={{ width: '25%' }}>Username</th>
                    <th style={{ width: '20%' }}>Role</th>
                    <th style={{ width: '20%' }}>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} className="empty-row">No users found.</td></tr>
                  )}
                  {filtered.map((u, idx) => {
                    const meta = ROLE_META[u.role] || ROLE_META.ROLE_USER
                    const isMe = u.id === me?.userId
                    return (
                      <tr key={u.id}>
                        <td className="text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{idx + 1}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: '50%',
                              background: isMe ? '#eff6ff' : '#f1f5f9',
                              border: isMe ? '2px solid #bfdbfe' : '2px solid var(--border)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 12, fontWeight: 700,
                              color: isMe ? 'var(--primary)' : 'var(--text-sec)',
                              flexShrink: 0,
                            }}>
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                            <span className="username-link" onClick={() => openUserDetail(u)}>
                              <strong>{u.username}</strong>
                            </span>
                            {isMe && <span className="badge badge-info" style={{ fontSize: 10, padding: '1px 6px' }}>You</span>}
                          </div>
                        </td>
                        <td><span className={`badge ${meta.cls}`}>{meta.label}</span></td>
                        <td>
                          {u.active !== false ? (
                            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <span className="live-dot live-dot-on" />
                              Active
                            </span>
                          ) : (
                            <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <span className="live-dot live-dot-off" />
                              Deactivated
                            </span>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {isMe ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                style={{
                                  padding: '5px 12px', borderRadius: 6, fontWeight: 600, fontSize: 12,
                                  border: 'none', cursor: saving === u.id ? 'not-allowed' : 'pointer',
                                  opacity: saving === u.id ? 0.6 : 1, minWidth: 84,
                                  background: u.active !== false ? 'var(--danger-bg, #fee2e2)' : 'var(--success-bg, #dcfce7)',
                                  color: u.active !== false ? 'var(--danger, #dc2626)' : 'var(--success, #16a34a)',
                                }}
                                disabled={saving === u.id}
                                onClick={() => toggleStatus(u.id, u.active !== false)}
                              >
                                {saving === u.id ? '…' : u.active !== false ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                className="btn-delete-sm"
                                style={{ minWidth: 60 }}
                                disabled={deleting === u.id}
                                onClick={() => deleteUser(u.id, u.username)}
                              >
                                {deleting === u.id ? '…' : 'Delete'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* DASHBOARD TAB                                                       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'dashboard' && (
        <>
          {/* Stats row */}
          <div className="stats-row">
            <div className="stat-card" style={{ borderTop: '3px solid #2563eb' }}>
              <span className="stat-label">Listed Stocks</span>
              <span className="stat-value" style={{ color: '#2563eb' }}>{stocks.length}</span>
            </div>
            <div className="stat-card" style={{ borderTop: '3px solid #16a34a' }}>
              <span className="stat-label">Market Trades</span>
              <span className="stat-value" style={{ color: '#16a34a' }}>{marketTrades.length}</span>
            </div>
            <div className="stat-card" style={{ borderTop: '3px solid #7c3aed' }}>
              <span className="stat-label">Total Volume</span>
              <span className="stat-value" style={{ color: '#7c3aed', fontSize: 18 }}>
                {totalVolume > 0 ? fmt$(totalVolume) : '—'}
              </span>
            </div>
            <div className={`stat-card ${marketOpen ? 'stat-card-live' : 'stat-card-offline'}`}>
              <span className="stat-label">Market</span>
              <span className="stat-value-sm">
                <span className={`live-dot ${marketOpen ? 'live-dot-on' : 'live-dot-off'}`} />
                {marketOpen === null ? '…' : marketOpen ? 'Open' : 'Closed'}
              </span>
            </div>
            <div className={`stat-card ${wsConnected ? 'stat-card-live' : 'stat-card-offline'}`}>
              <span className="stat-label">Live Feed</span>
              <span className="stat-value-sm">
                <span className={`live-dot ${wsConnected ? 'live-dot-on' : 'live-dot-off'}`} />
                {wsConnected ? 'Connected' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Market Prices + Recent Trades */}
          <div className="dash-grid">

            {/* Market Prices */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Market Prices</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="card-hint">Click row to view order book</span>
                  <button className="btn-ghost" onClick={loadDashboard}>↺</button>
                </div>
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
                    return (
                      <tr key={s.ticker}
                        className={`table-row-clickable ${bookTicker === s.ticker ? 'row-selected' : ''}`}
                        onClick={() => loadOrderBook(s.ticker)}>
                        <td><span className="ticker-badge">{s.ticker}</span></td>
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

            {/* Recent Market Trades */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Recent Market Trades</h2>
                <button className="btn-ghost" onClick={() =>
                  orderApi.get('/market/trades').then(r => setMarketTrades(r.data)).catch(() => {})
                }>↺</button>
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
                    {marketTrades.map(t => (
                      <tr key={t.id}>
                        <td><span className="ticker-badge">{t.ticker}</span></td>
                        <td className="text-right font-med">{fmt$(t.price)}</td>
                        <td className="text-right">{t.quantity.toLocaleString()}</td>
                        <td className="text-right">{fmt$(t.value)}</td>
                        <td className="text-muted text-sm">
                          {new Date(t.executedAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Order Book for selected ticker */}
          {bookTicker && (
            <div className="card" style={{ padding: 0 }}>
              <div className="card-header" style={{ padding: '14px 16px' }}>
                <div>
                  <h2 className="card-title">Order Book — {bookTicker}</h2>
                  <span className="card-hint" style={{ display: 'block', marginTop: 2 }}>
                    Resting orders at each price level
                  </span>
                </div>
                <button className="btn-ghost" onClick={() => loadOrderBook(bookTicker)}>↺</button>
              </div>
              {bookLoading ? (
                <div className="book-empty">Loading…</div>
              ) : !orderBook ? null : (
                <div className="book-container">
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
                            <div key={i} className="book-row book-row-ask"
                              style={{ '--bar-pct': `${Math.round(lvl.quantity / maxQty * 100)}%` }}>
                              <span className="book-price">{fmt$(lvl.price)}</span>
                              <span className="book-qty">{lvl.quantity.toLocaleString()}</span>
                              <span className="book-orders">{lvl.orders}</span>
                            </div>
                          )
                        })
                    }
                  </div>
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
                            <div key={i} className="book-row book-row-bid"
                              style={{ '--bar-pct': `${Math.round(lvl.quantity / maxQty * 100)}%` }}>
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
          )}

          {/* Live Activity */}
          <div className="card activity-card">
            <div className="card-header">
              <h2 className="card-title">Live Activity</h2>
              <span className={`live-dot ${wsConnected ? 'live-dot-on' : 'live-dot-off'}`} />
            </div>
            <ul className="activity-list">
              {activity.length === 0 && <li className="activity-empty">Waiting for events…</li>}
              {activity.map((line, i) => <li key={i} className="activity-item">{line}</li>)}
            </ul>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MARKET TAB                                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'market' && (
        <>
          {/* Stats */}
          <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="stat-card" style={{ borderTop: '3px solid #2563eb' }}>
              <span className="stat-label">Listed Stocks</span>
              <span className="stat-value" style={{ color: '#2563eb' }}>{listings.length}</span>
            </div>
            <div className="stat-card" style={{ borderTop: '3px solid #16a34a' }}>
              <span className="stat-label">IPO Active</span>
              <span className="stat-value" style={{ color: '#16a34a' }}>{ipoActiveCount}</span>
            </div>
            <div className="stat-card" style={{ borderTop: '3px solid #6b7280' }}>
              <span className="stat-label">IPO Closed</span>
              <span className="stat-value" style={{ color: '#6b7280' }}>{listings.length - ipoActiveCount}</span>
            </div>
            <div className={`stat-card ${marketOpen ? 'stat-card-live' : 'stat-card-offline'}`}>
              <span className="stat-label">Market</span>
              <span className="stat-value-sm">
                <span className={`live-dot ${marketOpen ? 'live-dot-on' : 'live-dot-off'}`} />
                {marketOpen === null ? '…' : marketOpen ? 'Open' : 'Closed'}
              </span>
            </div>
          </div>

          {/* Listed Stocks */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--text-sec)' }}><MarketIcon /></span>
                <h2 className="card-title">Listed Stocks</h2>
                <span className="badge badge-info" style={{ marginLeft: 4 }}>{listings.length}</span>
              </div>
              <button className="btn-ghost" onClick={loadMarket}>Refresh</button>
            </div>

            {listings.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🏢</div>
                <p className="empty-state-title">No stocks listed yet</p>
                <p className="empty-state-sub">
                  Company accounts can list stocks from their Company Dashboard.
                </p>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th>Company</th>
                      <th className="text-right">IPO Price</th>
                      <th className="text-right">Total Shares</th>
                      <th className="text-right">IPO Remaining</th>
                      <th className="text-right">Sold</th>
                      <th className="text-right">Market Price</th>
                      <th className="text-right">Change</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listings.map(l => {
                      const mkt       = getPrice(l.ticker)
                      const ipo       = getIpo(l.ticker)
                      const chgPct    = mkt && mkt.changePct != null ? Number(mkt.changePct) : null
                      const ipoActive = ipo && ipo.remainingShares > 0
                      return (
                        <tr key={l.ticker}>
                          <td><span className="ticker-badge">{l.ticker}</span></td>
                          <td className="font-med">{l.companyName}</td>
                          <td className="text-right text-muted">{fmt$(l.initialPrice)}</td>
                          <td className="text-right">{Number(l.totalShares).toLocaleString()}</td>
                          <td className="text-right">
                            {ipo
                              ? <span className={ipo.remainingShares > 0 ? 'pnl-positive' : 'text-muted'}>
                                  {ipo.remainingShares > 0
                                    ? Number(ipo.remainingShares).toLocaleString()
                                    : 'Sold out'}
                                </span>
                              : <span className="text-muted">—</span>}
                          </td>
                          <td className="text-right text-muted">
                            {ipo ? Number(ipo.soldShares).toLocaleString() : '—'}
                          </td>
                          <td className="text-right font-med">
                            {mkt
                              ? fmt$(mkt.currentPrice)
                              : <span className="text-muted">—</span>}
                          </td>
                          <td className={`text-right ${chgPct === null ? '' : chgPct >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>
                            {chgPct !== null
                              ? `${chgPct >= 0 ? '+' : ''}${chgPct.toFixed(2)}%`
                              : '—'}
                          </td>
                          <td>
                            {ipoActive
                              ? <span className="badge badge-success">IPO Active</span>
                              : <span className="badge badge-neutral">Secondary</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* IPO Allocation Detail */}
          {ipoAllocations.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">IPO Allocation Summary</h2>
                <button className="btn-ghost" onClick={loadMarket}>Refresh</button>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th className="text-right">IPO Price</th>
                      <th className="text-right">Total IPO Shares</th>
                      <th className="text-right">Sold</th>
                      <th className="text-right">Remaining</th>
                      <th className="text-right">% Sold</th>
                      <th>Phase</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ipoAllocations.map(a => {
                      const pctSold = a.totalShares > 0
                        ? Math.round((a.soldShares / a.totalShares) * 100) : 0
                      return (
                        <tr key={a.ticker}>
                          <td><span className="ticker-badge">{a.ticker}</span></td>
                          <td className="text-right">{fmt$(a.ipoPrice)}</td>
                          <td className="text-right">{Number(a.totalShares).toLocaleString()}</td>
                          <td className="text-right">{Number(a.soldShares).toLocaleString()}</td>
                          <td className="text-right">
                            <span className={a.remainingShares > 0 ? 'pnl-positive' : 'text-muted'}>
                              {a.remainingShares > 0
                                ? Number(a.remainingShares).toLocaleString()
                                : 'Sold out'}
                            </span>
                          </td>
                          <td className="text-right">
                            <div className="fill-cell">
                              <span>{pctSold}%</span>
                              <div className="fill-bar">
                                <div className="fill-bar-inner" style={{ width: `${pctSold}%` }} />
                              </div>
                            </div>
                          </td>
                          <td>
                            {a.remainingShares > 0
                              ? <span className="badge badge-success">IPO Active</span>
                              : <span className="badge badge-neutral">Secondary</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── User Detail Modal (accessible from Admin tab) ──────────────────── */}
      {selectedUser && (
        <div className="modal-overlay" onClick={closeDetail}>
          <div className="modal" style={isCompanyUser ? { maxWidth: 820 } : {}} onClick={e => e.stopPropagation()}>

            {/* ── Header ── */}
            <div className="modal-header">
              <div className="modal-avatar" style={isCompanyUser ? {
                background: '#fef3c7', border: '2px solid #fcd34d', color: '#b45309',
              } : {}}>
                {isCompanyUser && userDetail?.companyProfile
                  ? userDetail.companyProfile.companyName.charAt(0).toUpperCase()
                  : selectedUser.username.charAt(0).toUpperCase()}
              </div>
              <div className="modal-user-info">
                <div className="modal-username">
                  {isCompanyUser && userDetail?.companyProfile
                    ? userDetail.companyProfile.companyName
                    : selectedUser.username}
                </div>
                <div className="modal-user-sub">
                  <span className={`badge ${selectedUserMeta.cls}`}>{selectedUserMeta.label}</span>
                  {isCompanyUser && userDetail?.companyProfile && (
                    <span style={{ marginLeft: 8, color: 'var(--text-sec)', fontSize: 12 }}>
                      @{selectedUser.username}
                    </span>
                  )}
                  <span style={{ marginLeft: 8 }}>ID: {selectedUser.id}</span>
                </div>
              </div>
              <button className="modal-close" onClick={closeDetail}>&#x2715;</button>
            </div>

            {/* ── Company profile info ── */}
            {isCompanyUser && !detailLoading && userDetail?.companyProfile && (
              <div className="company-profile-section">
                {userDetail.companyProfile.description && (
                  <p className="company-description">{userDetail.companyProfile.description}</p>
                )}
                {(userDetail.companyProfile.contactEmail || userDetail.companyProfile.website) && (
                  <div className="company-contact-row">
                    {userDetail.companyProfile.contactEmail && (
                      <div className="company-contact-item">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/>
                        </svg>
                        {userDetail.companyProfile.contactEmail}
                      </div>
                    )}
                    {userDetail.companyProfile.website && (
                      <div className="company-contact-item">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                        </svg>
                        {userDetail.companyProfile.website}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {isCompanyUser && !detailLoading && !userDetail?.companyProfile && (
              <div className="company-profile-empty">No company profile set up yet.</div>
            )}

            {/* ── Stats ── */}
            <div className="modal-stats" style={isCompanyUser ? { gridTemplateColumns: 'repeat(4, 1fr)' } : {}}>
              <div className="modal-stat">
                <span className="modal-stat-label">Wallet Balance</span>
                <span className="modal-stat-value">
                  {detailLoading ? '…' : userDetail?.wallet != null ? fmt$(userDetail.wallet.balance) : '—'}
                </span>
              </div>
              {isCompanyUser ? (
                <>
                  <div className="modal-stat">
                    <span className="modal-stat-label">Listed Stocks</span>
                    <span className="modal-stat-value" style={{ color: '#d97706' }}>
                      {detailLoading ? '…' : companyStocksForModal.length}
                    </span>
                  </div>
                  <div className="modal-stat">
                    <span className="modal-stat-label">Total Shares Issued</span>
                    <span className="modal-stat-value">
                      {detailLoading ? '…' :
                        companyStocksForModal.length > 0
                          ? companyStocksForModal.reduce((s, st) => s + Number(st.totalShares), 0).toLocaleString()
                          : '—'}
                    </span>
                  </div>
                  <div className="modal-stat">
                    <span className="modal-stat-label">Orders Placed</span>
                    <span className="modal-stat-value">
                      {detailLoading ? '…' : (userDetail?.orders?.length ?? '—')}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="modal-stat">
                    <span className="modal-stat-label">Holdings</span>
                    <span className="modal-stat-value">
                      {detailLoading ? '…' : (userDetail?.portfolio?.length ?? '—')}
                    </span>
                  </div>
                  <div className="modal-stat">
                    <span className="modal-stat-label">Total Orders</span>
                    <span className="modal-stat-value">
                      {detailLoading ? '…' : (userDetail?.orders?.length ?? '—')}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* ── Tabs ── */}
            <div className="modal-tabs">
              {isCompanyUser ? (
                <>
                  <button
                    className={`modal-tab ${detailTab === 'listings' ? 'modal-tab-active' : ''}`}
                    onClick={() => setDetailTab('listings')}
                  >Stock Listings</button>
                  <button
                    className={`modal-tab ${detailTab === 'orders' ? 'modal-tab-active' : ''}`}
                    onClick={() => setDetailTab('orders')}
                  >Order History</button>
                </>
              ) : (
                <>
                  <button
                    className={`modal-tab ${detailTab === 'portfolio' ? 'modal-tab-active' : ''}`}
                    onClick={() => setDetailTab('portfolio')}
                  >Portfolio</button>
                  <button
                    className={`modal-tab ${detailTab === 'orders' ? 'modal-tab-active' : ''}`}
                    onClick={() => setDetailTab('orders')}
                  >Order History</button>
                </>
              )}
            </div>

            {/* ── Body ── */}
            <div className="modal-body">
              {detailLoading && <div className="modal-loading">Loading…</div>}

              {/* Trader: Portfolio */}
              {!detailLoading && !isCompanyUser && detailTab === 'portfolio' && (
                userDetail?.portfolio?.length === 0
                  ? <div className="modal-empty">No portfolio holdings.</div>
                  : (
                    <div className="table-scroll">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Ticker</th>
                            <th className="text-right">Qty</th>
                            <th className="text-right">Avg Cost</th>
                            <th className="text-right">Market Price</th>
                            <th className="text-right">Est. Value</th>
                            <th className="text-right">P&amp;L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userDetail?.portfolio?.map(p => {
                            const mkt    = getPrice(p.stockTicker)
                            const mktPx  = mkt ? Number(mkt.currentPrice) : null
                            const avgCost = Number(p.avgCostBasis)
                            const estVal = mktPx != null ? p.quantity * mktPx : p.quantity * avgCost
                            const pnl    = mktPx != null ? p.quantity * (mktPx - avgCost) : null
                            return (
                              <tr key={p.stockTicker}>
                                <td><span className="ticker-badge">{p.stockTicker}</span></td>
                                <td className="text-right">{p.quantity.toLocaleString()}</td>
                                <td className="text-right text-muted">{fmt$(avgCost)}</td>
                                <td className="text-right font-med">
                                  {mktPx != null ? fmt$(mktPx) : <span className="text-muted">—</span>}
                                </td>
                                <td className="text-right price-cell">{fmt$(estVal)}</td>
                                <td className={`text-right ${pnl === null ? '' : pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>
                                  {pnl !== null ? `${pnl >= 0 ? '+' : ''}${fmt$(pnl)}` : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
              )}

              {/* Company: Stock Listings */}
              {!detailLoading && isCompanyUser && detailTab === 'listings' && (
                companyStocksForModal.length === 0
                  ? <div className="modal-empty">No stocks listed yet.</div>
                  : (
                    <div className="table-scroll">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Ticker</th>
                            <th className="text-right">Initial Price</th>
                            <th className="text-right">Total Shares</th>
                            <th className="text-right">Market Price</th>
                            <th className="text-right">Change</th>
                            <th className="text-right">IPO Remaining</th>
                            <th className="text-right">Sold</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {companyStocksForModal.map(s => {
                            const mkt      = getPrice(s.ticker)
                            const ipo      = getIpo(s.ticker)
                            const chgPct   = mkt?.changePct != null ? Number(mkt.changePct) : null
                            const ipoActive = ipo && ipo.remainingShares > 0
                            const pctSold  = ipo && ipo.totalShares > 0
                              ? Math.round((ipo.soldShares / ipo.totalShares) * 100)
                              : null
                            return (
                              <tr key={s.ticker}>
                                <td><span className="ticker-badge">{s.ticker}</span></td>
                                <td className="text-right text-muted">{fmt$(s.initialPrice)}</td>
                                <td className="text-right">{Number(s.totalShares).toLocaleString()}</td>
                                <td className="text-right font-med">
                                  {mkt ? fmt$(mkt.currentPrice) : <span className="text-muted">—</span>}
                                </td>
                                <td className={`text-right ${chgPct === null ? '' : chgPct >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>
                                  {chgPct !== null ? `${chgPct >= 0 ? '+' : ''}${chgPct.toFixed(2)}%` : '—'}
                                </td>
                                <td className="text-right">
                                  {ipo
                                    ? <span className={ipo.remainingShares > 0 ? 'pnl-positive' : 'text-muted'}>
                                        {ipo.remainingShares > 0
                                          ? Number(ipo.remainingShares).toLocaleString()
                                          : 'Sold out'}
                                      </span>
                                    : <span className="text-muted">—</span>}
                                </td>
                                <td className="text-right text-muted">
                                  {ipo
                                    ? `${Number(ipo.soldShares).toLocaleString()}${pctSold !== null ? ` (${pctSold}%)` : ''}`
                                    : '—'}
                                </td>
                                <td>
                                  {ipoActive
                                    ? <span className="badge badge-success">IPO Active</span>
                                    : ipo
                                      ? <span className="badge badge-neutral">Secondary</span>
                                      : <span className="badge badge-neutral">Listed</span>}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
              )}

              {/* Orders (shared — trader and company) */}
              {!detailLoading && detailTab === 'orders' && (
                userDetail?.orders?.length === 0
                  ? <div className="modal-empty">No orders found.</div>
                  : (
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
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userDetail?.orders?.slice().sort((a, b) => b.createdAt - a.createdAt).map(o => {
                            const statusCls = o.status === 'COMPLETED' ? 'badge-success'
                              : o.status === 'CANCELLED' ? 'badge-neutral'
                              : o.status === 'FAILED'    ? 'badge-danger'
                              : 'badge-open'
                            return (
                              <tr key={o.id}>
                                <td className="text-muted">{o.id}</td>
                                <td><span className="ticker-badge">{o.stockTicker}</span></td>
                                <td className={o.type === 'BUY' ? 'type-buy' : 'type-sell'}>{o.type}</td>
                                <td className="text-right">{o.quantity}</td>
                                <td className="text-right price-cell">
                                  {o.avgFillPrice != null
                                    ? fmt$(o.avgFillPrice)
                                    : o.limitPrice != null
                                      ? fmt$(o.limitPrice)
                                      : 'MKT'}
                                </td>
                                <td><span className={`badge ${statusCls}`}>{o.status}</span></td>
                                <td className="text-muted">
                                  {new Date(o.createdAt).toLocaleDateString()}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  )
}