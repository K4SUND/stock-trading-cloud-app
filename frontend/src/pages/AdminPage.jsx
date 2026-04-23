import React, { useEffect, useState } from 'react'
import { authHeaders, userApi } from '../api'
import { useAuth } from '../context/AuthContext'

const ROLES = ['ROLE_USER', 'ROLE_COMPANY', 'ROLE_ADMIN']
const ROLE_META = {
  ROLE_USER:    { label: 'Trader',  cls: 'badge-info'    },
  ROLE_COMPANY: { label: 'Company', cls: 'badge-warning' },
  ROLE_ADMIN:   { label: 'Admin',   cls: 'badge-danger'  },
}

export default function AdminPage() {
  const { token, user: me } = useAuth()
  const headers = authHeaders(token)
  const [users,  setUsers]  = useState([])
  const [msg,    setMsg]    = useState(null)
  const [saving, setSaving] = useState(null)

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    try {
      const res = await userApi.get('/admin/users', { headers })
      setUsers(res.data)
    } catch { setMsg({ type: 'error', text: 'Failed to load users.' }) }
  }

  async function changeRole(userId, newRole) {
    setSaving(userId); setMsg(null)
    try {
      await userApi.patch(`/admin/users/${userId}/role`, { role: newRole }, { headers })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
      setMsg({ type: 'success', text: `Role updated successfully.` })
    } catch {
      setMsg({ type: 'error', text: 'Failed to update role.' })
    } finally { setSaving(null) }
  }

  const counts = ROLES.reduce((acc, r) => ({ ...acc, [r]: users.filter(u => u.role === r).length }), {})

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Admin Panel</h1>
        <p className="page-subtitle">Manage all platform users and their roles</p>
      </div>

      {/* Stats */}
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

      {msg && (
        <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {msg.text}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">User Management</h2>
          <button className="btn-ghost" onClick={loadUsers}>Refresh</button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Username</th>
              <th>Current Role</th>
              <th>Change Role</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && <tr><td colSpan={4} className="empty-row">Loading…</td></tr>}
            {users.map(u => {
              const meta = ROLE_META[u.role] || ROLE_META.ROLE_USER
              const isMe = u.id === me?.userId
              return (
                <tr key={u.id}>
                  <td className="text-muted">{u.id}</td>
                  <td>
                    <strong>{u.username}</strong>
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
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
