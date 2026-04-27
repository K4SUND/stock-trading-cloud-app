import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'

const ROLE_LABELS = {
  ROLE_USER:    { label: 'Trader',  cls: 'role-user'    },
  ROLE_COMPANY: { label: 'Company', cls: 'role-company' },
  ROLE_ADMIN:   { label: 'Admin',   cls: 'role-admin'   },
}

export default function Navbar() {
  const { user, logout, isLoggedIn, isAdmin, isCompany } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const roleMeta = ROLE_LABELS[user?.role] || ROLE_LABELS.ROLE_USER

  function handleLogout() { logout(); navigate('/login') }
  function isActive(path) { return location.pathname === path ? 'nav-link-active' : '' }
  function isActiveTab(tab) {
    if (location.pathname !== '/admin') return ''
    const params = new URLSearchParams(location.search)
    const current = params.get('tab') || 'admin'
    return current === tab ? 'nav-link-active' : ''
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div className="navbar-brand">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
          </svg>
          <span className="brand-name">StockTrade</span>
        </div>

        {isLoggedIn && (
            <div className="navbar-links">
              {isAdmin ? (
                  <>
                    <Link to="/admin?tab=admin"     className={`nav-link ${isActiveTab('admin')}`}>Admin</Link>
                    <Link to="/admin?tab=dashboard" className={`nav-link ${isActiveTab('dashboard')}`}>Dashboard</Link>
                    <Link to="/admin?tab=market"    className={`nav-link ${isActiveTab('market')}`}>Market</Link>

                  </>
              ) : (
                  <>
                    <Link to="/dashboard" className={`nav-link ${isActive('/dashboard')}`}>Dashboard</Link>
                    <Link to="/markets"   className={`nav-link ${isActive('/markets')}`}>Markets</Link>
                    <Link to="/wallet"    className={`nav-link ${isActive('/wallet')}`}>Wallet</Link>
                    {isCompany && (
                        <Link to="/company" className={`nav-link ${isActive('/company')}`}>Company</Link>
                    )}
                  </>
              )}
            </div>
        )}

        <div className="navbar-right">
          {isLoggedIn ? (
            <>
              <NotificationBell />
              <div className="nav-user">
                <div className="nav-avatar">{user.username.charAt(0).toUpperCase()}</div>
                <div className="nav-user-info">
                  <span className="nav-username">{user.username}</span>
                  <span className={`role-badge ${roleMeta.cls}`}>{roleMeta.label}</span>
                </div>
              </div>
              <button className="btn-logout" onClick={handleLogout}>Sign Out</button>
            </>
          ) : (
            <span className="nav-tagline">Professional Trading Platform</span>
          )}
        </div>
      </div>
    </nav>
  )
}
