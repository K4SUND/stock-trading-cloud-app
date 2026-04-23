import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RegisterPage() {
  const { register, isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '', confirm: '', role: 'ROLE_USER' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  if (isLoggedIn) { navigate('/', { replace: true }); return null }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    if (form.password.length < 4) { setError('Password must be at least 4 characters.'); return }
    setLoading(true)
    try {
      await register({ username: form.username, password: form.password, role: form.role })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Username may already exist.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          </div>
          <h1 className="auth-title">StockTrade</h1>
          <p className="auth-subtitle">Create your trading account</p>
        </div>

        {error   && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">Account created! Redirecting to login…</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Account Type</label>
            <div className="account-type-grid">
              <label className={`account-type-card ${form.role === 'ROLE_USER' ? 'selected' : ''}`}>
                <input type="radio" name="role" value="ROLE_USER"
                  checked={form.role === 'ROLE_USER'}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
                <div className="account-type-icon">👤</div>
                <div className="account-type-label">Trader</div>
                <div className="account-type-desc">Buy &amp; sell stocks</div>
              </label>
              <label className={`account-type-card ${form.role === 'ROLE_COMPANY' ? 'selected' : ''}`}>
                <input type="radio" name="role" value="ROLE_COMPANY"
                  checked={form.role === 'ROLE_COMPANY'}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
                <div className="account-type-icon">🏢</div>
                <div className="account-type-label">Company</div>
                <div className="account-type-desc">List &amp; manage stocks</div>
              </label>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input className="form-input" type="text" placeholder="Choose a username"
              value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="Choose a password"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input className="form-input" type="password" placeholder="Repeat your password"
              value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} required />
          </div>
          <button type="submit" className="btn-primary btn-full" disabled={loading || success}>
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" className="auth-link">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
