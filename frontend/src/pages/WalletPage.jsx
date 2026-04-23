import React, { useEffect, useState } from 'react'
import { authHeaders, paymentApi } from '../api'
import { useAuth } from '../context/AuthContext'

export default function WalletPage() {
  const { token } = useAuth()
  const headers = authHeaders(token)

  const [balance, setBalance] = useState(null)
  const [amount, setAmount] = useState('1000')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)

  async function loadBalance() {
    const res = await paymentApi.get('/wallet', { headers })
    setBalance(res.data.balance)
  }

  useEffect(() => { loadBalance() }, [])

  async function handleTopup(e) {
    e.preventDefault()
    const value = Number(amount)
    if (!value || value <= 0) {
      setMsg({ type: 'error', text: 'Enter a valid positive amount.' })
      return
    }
    setLoading(true)
    setMsg(null)
    try {
      await paymentApi.post('/wallet/topup', { amount: value }, { headers })
      setMsg({ type: 'success', text: `Successfully added $${value.toFixed(2)} to your wallet.` })
      setAmount('1000')
      loadBalance()
    } catch {
      setMsg({ type: 'error', text: 'Top-up failed. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const presets = [100, 500, 1000, 5000]

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Wallet</h1>
        <p className="page-subtitle">Manage your trading funds</p>
      </div>

      <div className="wallet-grid">
        {/* Balance card */}
        <div className="card balance-card">
          <p className="balance-label">Available Balance</p>
          <p className="balance-amount">
            {balance === null ? '…' : `$${Number(balance).toFixed(2)}`}
          </p>
          <p className="balance-currency">USD</p>
        </div>

        {/* Top-up card */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Add Funds</h2>
          </div>

          {msg && (
            <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-error'}`}>
              {msg.text}
            </div>
          )}

          <form onSubmit={handleTopup}>
            <div className="form-group">
              <label className="form-label">Amount (USD)</label>
              <input
                className="form-input form-input-lg"
                type="number"
                min="1"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
              />
            </div>

            <div className="preset-row">
              {presets.map(p => (
                <button
                  key={p}
                  type="button"
                  className={`preset-btn ${Number(amount) === p ? 'preset-btn-active' : ''}`}
                  onClick={() => setAmount(String(p))}
                >
                  ${p.toLocaleString()}
                </button>
              ))}
            </div>

            <button type="submit" className="btn-primary btn-full" disabled={loading}>
              {loading ? 'Processing…' : `Add $${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </button>
          </form>
        </div>
      </div>

      <div className="info-box">
        <strong>Demo Note:</strong> This is a simulated wallet. Funds added here are for paper trading only and have no real monetary value.
      </div>
    </div>
  )
}