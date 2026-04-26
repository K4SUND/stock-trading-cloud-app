import React, { useEffect, useRef, useState } from 'react'
import { notificationApi, authHeaders } from '../api'
import { useAuth } from '../context/AuthContext'

export default function NotificationBell() {
  const { token } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Track locally dismissed broadcast IDs so they don't reappear on next poll
  const dismissedBroadcasts = useRef(new Set())

  const unread = notifications.filter(n => !n.read).length

  async function fetchNotifications() {
    try {
      const res = await notificationApi.get('', { headers: authHeaders(token) })
      // Filter out locally dismissed broadcasts
      const filtered = res.data.filter(n =>
        !(n.broadcast && dismissedBroadcasts.current.has(n.id))
      )
      setNotifications(filtered)
    } catch {
      // silently ignore
    }
  }

  useEffect(() => {
    if (!token) {
      setNotifications([])
      dismissedBroadcasts.current = new Set()
      return
    }
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 5000)
    return () => clearInterval(interval)
  }, [token])

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleMarkAllRead() {
    try {
      await notificationApi.patch('/read-all', {}, { headers: authHeaders(token) })
      // Mark all broadcasts as dismissed locally
      notifications
        .filter(n => n.broadcast)
        .forEach(n => dismissedBroadcasts.current.add(n.id))
      setNotifications(prev =>
        prev
          .map(n => ({ ...n, read: true }))
          .filter(n => !n.broadcast) // remove broadcasts from view
      )
    } catch {}
  }

  async function handleClearAll() {
    try {
      await notificationApi.delete('/clear-all', { headers: authHeaders(token) })
      dismissedBroadcasts.current = new Set()
      setNotifications([])
    } catch {}
  }

  async function handleMarkRead(id) {
    try {
      await notificationApi.patch(`/${id}/read`, {}, { headers: authHeaders(token) })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    } catch {}
  }

  async function handleDelete(id, e) {
    e.stopPropagation()
    try {
      await notificationApi.delete(`/${id}`, { headers: authHeaders(token) })
      // If broadcast, track it locally so it doesn't reappear on poll
      const n = notifications.find(n => n.id === id)
      if (n?.broadcast) dismissedBroadcasts.current.add(id)
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch {}
  }

  function formatTime(iso) {
    const d = new Date(iso)
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const TYPE_BADGE = {
    ORDER_PLACED:     { label: 'OR', className: 'notif-type-order' },
    TRADE_EXECUTED:   { label: 'TR', className: 'notif-type-trade' },
    ORDER_CANCELLED:  { label: 'CN', className: 'notif-type-cancel' },
    IPO_PURCHASED:    { label: 'IP', className: 'notif-type-ipo' },
    STOCK_LISTED:     { label: 'LS', className: 'notif-type-listed' },
    SHARES_ISSUED:    { label: 'IS', className: 'notif-type-issued' },
    COMPANY_IPO_SALE: { label: 'CS', className: 'notif-type-company' },
    COMPANY_TRADE:    { label: 'CT', className: 'notif-type-company' },
  }

  return (
    <div className="notif-bell-wrapper" ref={ref}>
      <button
        className="notif-bell-btn"
        onClick={() => setOpen(prev => !prev)}
        title="Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <span className="notif-title">Notifications</span>
            <div className="notif-actions">
              {(unread > 0 || notifications.some(n => n.broadcast)) && (
                <button className="notif-mark-all" onClick={handleMarkAllRead}>
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button className="notif-clear-all" onClick={handleClearAll}>
                  Clear all
                </button>
              )}
            </div>
          </div>

          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">No notifications yet</div>
            ) : (
              notifications.map(n => {
                const typeBadge = TYPE_BADGE[n.type] || { label: 'NT', className: 'notif-type-default' }
                return (
                <div
                  key={n.id}
                  className={`notif-item ${
                    n.broadcast ? 'notif-broadcast' : n.read ? 'notif-read' : 'notif-unread'
                  }`}
                  onClick={() => !n.broadcast && !n.read && handleMarkRead(n.id)}
                >
                  <div className={`notif-item-icon ${typeBadge.className}`}>{typeBadge.label}</div>
                  <div className="notif-item-body">
                    <div className="notif-item-title">
                      {n.broadcast && <span className="notif-broadcast-tag">Announcement</span>}
                      {n.title}
                    </div>
                    <div className="notif-item-msg">{n.message}</div>
                    <div className="notif-item-time">{formatTime(n.createdAt)}</div>
                  </div>
                  {/* DELETE button now shows for ALL notifications including broadcasts */}
                  <button
                    className="notif-delete-btn"
                    onClick={(e) => handleDelete(n.id, e)}
                    title="Dismiss"
                  >×</button>
                </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}