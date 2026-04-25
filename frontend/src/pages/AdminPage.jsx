import React, { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { authHeaders, userApi, orderApi, paymentApi } from '../api'
import { useAuth } from '../context/AuthContext'

const GATEWAY = 'http://localhost:8080'
const ROLES = ['ROLE_USER', 'ROLE_COMPANY', 'ROLE_ADMIN']
const ROLE_META = {
  ROLE_USER:    { label: 'Trader',  cls: 'badge-info'    },
  ROLE_COMPANY: { label: 'Company', cls: 'badge-warning' },
  ROLE_ADMIN:   { label: 'Admin',   cls: 'badge-danger'  },
}

function ShieldIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

export default function AdminPage() {
  const { token, user: me } = useAuth()
  const headers = authHeaders(token)

  const [users,         setUsers]         = useState([])
  const [health,        setHealth]        = useState(null)
  const [search,        setSearch]        = useState('')
  const [msg,           setMsg]           = useState(null)
  const [saving,        setSaving]        = useState(null)
  const [deleting,      setDeleting]      = useState(null)
  const [selectedUser,  setSelectedUser]  = useState(null)
  const [userDetail,    setUserDetail]    = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailTab,     setDetailTab]     = useState('portfolio')

  const load = useCallback(async () => {
    const [usersRes, healthRes] = await Promise.allSettled([
      userApi.get('/admin/users', { headers }),
      axios.get(`${GATEWAY}/actuator/health`),
    ])
    if (usersRes.status === 'fulfilled')  setUsers(usersRes.value.data)
    else setMsg({ type: 'error', text: 'Failed to load users.' })
    if (healthRes.status === 'fulfilled') setHealth(healthRes.value.data)
  }, [token])

  useEffect(() => { load() }, [load])

  async function changeRole(userId, newRole) {
    setSaving(userId); setMsg(null)
    try {
      await userApi.patch(`/admin/users/${userId}/role`, { role: newRole }, { headers })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
      setMsg({ type: 'success', text: 'Role updated successfully.' })
    } catch {
      setMsg({ type: 'error', text: 'Failed to update role.' })
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

  async function openUserDetail(user) {
    setSelectedUser(user)
    setUserDetail(null)
    setDetailLoading(true)
    setDetailTab('portfolio')
    const [walletRes, portfolioRes, ordersRes] = await Promise.allSettled([
      paymentApi.get(`/admin/users/${user.id}/wallet`, { headers }),
      orderApi.get(`/admin/users/${user.id}/portfolio`, { headers }),
      orderApi.get(`/admin/users/${user.id}/orders`,   { headers }),
    ])
    setUserDetail({
      wallet:    walletRes.status    === 'fulfilled' ? walletRes.value.data    : null,
      portfolio: portfolioRes.status === 'fulfilled' ? portfolioRes.value.data : [],
      orders:    ordersRes.status    === 'fulfilled' ? ordersRes.value.data    : [],
    })
    setDetailLoading(false)
  }

  function closeDetail() {
    setSelectedUser(null)
    setUserDetail(null)
  }

  const counts = ROLES.reduce((acc, r) => ({
    ...acc, [r]: users.filter(u => u.role === r).length
  }), {})

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  )

  const healthStatus = health?.status ?? null
  const healthUp     = healthStatus === 'UP'
  const components   = health?.components ? Object.entries(health.components) : []

  return (
    <div className="page">

      {/* ── Admin identity banner ──────────────────────────────────── */}
      <div className="admin-banner">
        <div className="admin-banner-icon">
          <ShieldIcon />
        </div>
        <div className="admin-banner-body">
          <div className="admin-banner-title">System Administration</div>
          <div className="admin-banner-sub">
            Signed in as <strong>{me?.username}</strong> &middot; Full platform access
          </div>
        </div>
        <div className="admin-banner-right">
          {healthStatus && (
            <div className="admin-health-pill">
              <span className={`live-dot ${healthUp ? 'live-dot-on' : 'live-dot-off'}`} />
              Gateway {healthStatus}
            </div>
          )}
          <span className="admin-env-badge">PROTOTYPE</span>
        </div>
      </div>

      {/* ── Platform stats ─────────────────────────────────────────── */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Total Users</span>
          <span className="stat-value">{users.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Traders</span>
          <span className="stat-value">{counts.ROLE_USER || 0}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Companies</span>
          <span className="stat-value">{counts.ROLE_COMPANY || 0}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Admins</span>
          <span className="stat-value">{counts.ROLE_ADMIN || 0}</span>
        </div>
      </div>

      {/* ── System health ──────────────────────────────────────────── */}
      {components.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">System Health</h2>
            <button className="btn-ghost" onClick={load}>Refresh</button>
          </div>
          <div className="health-grid">
            {components.map(([name, comp]) => {
              const up = comp.status === 'UP'
              return (
                <div key={name} className="health-item">
                  <span className={`live-dot ${up ? 'live-dot-on' : 'live-dot-off'}`} />
                  <span className="health-name">{name}</span>
                  <span className={`health-status ${up ? 'health-up' : 'health-down'}`}>
                    {comp.status}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Alert banner ───────────────────────────────────────────── */}
      {msg && (
        <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-error'}`}
             style={{ margin: 0 }}>
          {msg.text}
        </div>
      )}

      {/* ── User management ────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">User Management</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="form-input"
              style={{ padding: '6px 10px', width: 200 }}
              placeholder="Search by name or role…"
              value={search}
              onChange={e => { setSearch(e.target.value); setMsg(null) }}
            />
            <button className="btn-ghost" onClick={load}>Refresh</button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Username</th>
                <th>Role</th>
                <th>Change Role</th>
                <th style={{ width: 90 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="empty-row">No users found.</td></tr>
              )}
              {filtered.map(u => {
                const meta = ROLE_META[u.role] || ROLE_META.ROLE_USER
                const isMe = u.id === me?.userId
                return (
                  <tr key={u.id}>
                    <td className="text-muted">{u.id}</td>
                    <td>
                      <span className="username-link" onClick={() => openUserDetail(u)}>
                        <strong>{u.username}</strong>
                      </span>
                      {isMe && <span className="you-badge"> (you)</span>}
                    </td>
                    <td><span className={`badge ${meta.cls}`}>{meta.label}</span></td>
                    <td>
                      {isMe ? (
                        <span className="text-muted">Cannot change own role</span>
                      ) : (
                        <select
                          className="role-select"
                          value={u.role}
                          disabled={saving === u.id}
                          onChange={e => changeRole(u.id, e.target.value)}
                        >
                          {ROLES.map(r => (
                            <option key={r} value={r}>{ROLE_META[r].label}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>
                      {isMe ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <button
                          className="btn-delete-sm"
                          disabled={deleting === u.id}
                          onClick={() => deleteUser(u.id, u.username)}
                        >
                          {deleting === u.id ? '…' : 'Delete'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── User detail modal ──────────────────────────────────────── */}
      {selectedUser && (
        <div className="modal-overlay" onClick={closeDetail}>
          <div className="modal" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="modal-header">
              <div className="modal-avatar">
                {selectedUser.username.charAt(0).toUpperCase()}
              </div>
              <div className="modal-user-info">
                <div className="modal-username">{selectedUser.username}</div>
                <div className="modal-user-sub">
                  <span className={`badge ${(ROLE_META[selectedUser.role] || ROLE_META.ROLE_USER).cls}`}>
                    {(ROLE_META[selectedUser.role] || ROLE_META.ROLE_USER).label}
                  </span>
                  <span style={{ marginLeft: 8 }}>User ID: {selectedUser.id}</span>
                </div>
              </div>
              <button className="modal-close" onClick={closeDetail}>&#x2715;</button>
            </div>

            {/* Stats */}
            <div className="modal-stats">
              <div className="modal-stat">
                <span className="modal-stat-label">Wallet Balance</span>
                <span className="modal-stat-value">
                  {detailLoading ? '…' :
                    userDetail?.wallet != null
                      ? `$${Number(userDetail.wallet.balance).toFixed(2)}`
                      : '—'}
                </span>
              </div>
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
            </div>

            {/* Tabs */}
            <div className="modal-tabs">
              <button
                className={`modal-tab ${detailTab === 'portfolio' ? 'modal-tab-active' : ''}`}
                onClick={() => setDetailTab('portfolio')}
              >Portfolio</button>
              <button
                className={`modal-tab ${detailTab === 'orders' ? 'modal-tab-active' : ''}`}
                onClick={() => setDetailTab('orders')}
              >Order History</button>
            </div>

            {/* Body */}
            <div className="modal-body">
              {detailLoading && <div className="modal-loading">Loading…</div>}

              {!detailLoading && detailTab === 'portfolio' && (
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
                            <th className="text-right">Est. Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userDetail?.portfolio?.map(p => (
                            <tr key={p.stockTicker}>
                              <td><span className="ticker-badge">{p.stockTicker}</span></td>
                              <td className="text-right">{p.quantity}</td>
                              <td className="text-right price-cell">${Number(p.avgCostBasis).toFixed(2)}</td>
                              <td className="text-right price-cell">
                                ${(p.quantity * Number(p.avgCostBasis)).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
              )}

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
                                    ? `$${Number(o.avgFillPrice).toFixed(2)}`
                                    : o.limitPrice != null
                                      ? `$${Number(o.limitPrice).toFixed(2)}`
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