import React, { useEffect, useState } from 'react'
import { authHeaders, paymentApi } from '../api'
import { useAuth } from '../context/AuthContext'

function fmt$(value) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export default function WalletPage() {
  const { token } = useAuth()
  const headers = authHeaders(token)

  const [balance, setBalance] = useState(null)
  const [transactions, setTransactions] = useState([])

  const [manualAmount, setManualAmount] = useState('1000')
  const [manualPassword, setManualPassword] = useState('')
  const [cardAmount, setCardAmount] = useState('500')
  const [cardPassword, setCardPassword] = useState('')
  const [cardHolderName, setCardHolderName] = useState('')
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242')
  const [expiryMonth, setExpiryMonth] = useState('12')
  const [expiryYear, setExpiryYear] = useState(String(new Date().getFullYear() + 1))
  const [cvv, setCvv] = useState('123')
  const [withdrawAmount, setWithdrawAmount] = useState('250')
  const [withdrawPassword, setWithdrawPassword] = useState('')

  const [activeMethod, setActiveMethod] = useState('card')

  const [manualLoading, setManualLoading] = useState(false)
  const [cardLoading, setCardLoading] = useState(false)
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [msg, setMsg] = useState(null)

  async function loadWalletData() {
    const [walletRes, txRes] = await Promise.all([
      paymentApi.get('/wallet', { headers }),
      paymentApi.get('/wallet/transactions', { headers }).catch(() => ({ data: [] })),
    ])
    setBalance(walletRes.data.balance)
    setTransactions(txRes.data || [])
  }

  useEffect(() => { loadWalletData() }, [])

  async function handleManualTopup(e) {
    e.preventDefault()
    const value = Number(manualAmount)
    if (!value || value <= 0) {
      setMsg({ type: 'error', text: 'Enter a valid positive amount.' })
      return
    }
    if (!manualPassword.trim()) {
      setMsg({ type: 'error', text: 'Enter your account password to confirm this deposit.' })
      return
    }
    setManualLoading(true)
    setMsg(null)
    try {
      await paymentApi.post('/wallet/topup', { amount: value, password: manualPassword }, { headers })
      setMsg({ type: 'success', text: `Successfully added $${value.toFixed(2)} to your wallet.` })
      setManualAmount('1000')
      setManualPassword('')
      loadWalletData()
    } catch (err) {
      const errorText = err.response?.data?.error || 'Top-up failed. Please try again.'
      setMsg({ type: 'error', text: String(errorText) })
    } finally {
      setManualLoading(false)
    }
  }

  async function handleCardTopup(e) {
    e.preventDefault()
    const value = Number(cardAmount)
    if (!value || value <= 0) {
      setMsg({ type: 'error', text: 'Enter a valid top-up amount for card payment.' })
      return
    }
    if (!cardPassword.trim()) {
      setMsg({ type: 'error', text: 'Enter your account password to confirm this card deposit.' })
      return
    }

    setCardLoading(true)
    setMsg(null)
    try {
      const res = await paymentApi.post('/wallet/topup/card', {
        amount: value,
        password: cardPassword,
        cardHolderName,
        cardNumber,
        expiryMonth,
        expiryYear,
        cvv,
      }, { headers })

      setMsg({
        type: 'success',
        text: `Payment approved. ${fmt$(value)} added. Reference: ${res.data.gatewayReference}`,
      })
      setCardAmount('500')
      setCardHolderName('')
      setCvv('')
      setCardPassword('')
      loadWalletData()
    } catch (err) {
      const errorText = err.response?.data?.error || 'Card payment failed in sandbox. Try a different test card.'
      setMsg({ type: 'error', text: String(errorText) })
    } finally {
      setCardLoading(false)
    }
  }

  async function handleWithdraw(e) {
    e.preventDefault()
    const value = Number(withdrawAmount)
    if (!value || value <= 0) {
      setMsg({ type: 'error', text: 'Enter a valid positive withdrawal amount.' })
      return
    }
    if (!withdrawPassword.trim()) {
      setMsg({ type: 'error', text: 'Enter your account password to confirm this withdrawal.' })
      return
    }

    setWithdrawLoading(true)
    setMsg(null)
    try {
      await paymentApi.post('/wallet/withdraw', { amount: value, password: withdrawPassword }, { headers })
      setMsg({ type: 'success', text: `Withdrawal successful. ${fmt$(value)} was deducted from your wallet.` })
      setWithdrawAmount('250')
      setWithdrawPassword('')
      loadWalletData()
    } catch (err) {
      const errorText = err.response?.data?.error || 'Withdraw failed. Please try again.'
      setMsg({ type: 'error', text: String(errorText) })
    } finally {
      setWithdrawLoading(false)
    }
  }

  function formatCardInput(raw) {
    const digits = raw.replace(/\D/g, '').slice(0, 19)
    const groups = digits.match(/.{1,4}/g)
    return groups ? groups.join(' ') : ''
  }

  const presets = [100, 500, 1000, 5000]
  const successfulTopups = transactions.filter(t => t.type === 'TOPUP' && t.status === 'SUCCESS').length
  const latestTopup = transactions.find(t => t.type === 'TOPUP')

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Wallet</h1>
        <p className="page-subtitle">Manage funding, card payments, and wallet transaction records</p>
      </div>

      <div className="wallet-pro-grid">
        <div className="wallet-pro-main">
          <div className="card balance-card wallet-balance-pro">
            <div>
              <p className="balance-label">Available Balance</p>
              <p className="balance-amount">
                {balance === null ? '…' : fmt$(balance)}
              </p>
              <p className="balance-currency">USD</p>
            </div>
            <div className="wallet-balance-meta">
              <div className="wallet-meta-chip">
                <span className="wallet-meta-label">Successful top-ups</span>
                <strong>{successfulTopups}</strong>
              </div>
              <div className="wallet-meta-chip">
                <span className="wallet-meta-label">Last top-up</span>
                <strong>{latestTopup ? new Date(latestTopup.createdAt).toLocaleString() : 'No records yet'}</strong>
              </div>
            </div>
          </div>

          <div className="card wallet-payment-card">
            <div className="card-header">
              <h2 className="card-title">Add Funds</h2>
              <span className="card-hint">Card and wallet operations with password confirmation</span>
            </div>

            <div className="wallet-method-tabs">
              <button
                type="button"
                className={`wallet-method-tab ${activeMethod === 'card' ? 'wallet-method-tab-active' : ''}`}
                onClick={() => setActiveMethod('card')}
              >
                Card Payment
              </button>
              <button
                type="button"
                className={`wallet-method-tab ${activeMethod === 'manual' ? 'wallet-method-tab-active' : ''}`}
                onClick={() => setActiveMethod('manual')}
              >
                Manual Credit
              </button>
              <button
                type="button"
                className={`wallet-method-tab ${activeMethod === 'withdraw' ? 'wallet-method-tab-active' : ''}`}
                onClick={() => setActiveMethod('withdraw')}
              >
                Withdraw
              </button>
            </div>

            {msg && (
              <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                {msg.text}
              </div>
            )}

            {activeMethod === 'card' ? (
              <form className="wallet-payment-form" onSubmit={handleCardTopup}>
                <div className="wallet-card-preview">
                  <div className="wallet-card-brand">SANDBOX GATEWAY</div>
                  <div className="wallet-card-number">{cardNumber || '•••• •••• •••• ••••'}</div>
                  <div className="wallet-card-row">
                    <span>{cardHolderName || 'CARD HOLDER'}</span>
                    <span>{String(expiryMonth).padStart(2, '0')}/{String(expiryYear).slice(-2)}</span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Amount (USD)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    step="0.01"
                    value={cardAmount}
                    onChange={e => setCardAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <input
                    className="form-input"
                    type="password"
                    value={cardPassword}
                    onChange={e => setCardPassword(e.target.value)}
                    placeholder="Enter account password"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Card Holder Name</label>
                  <input
                    className="form-input"
                    type="text"
                    value={cardHolderName}
                    onChange={e => setCardHolderName(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Card Number</label>
                  <input
                    className="form-input"
                    type="text"
                    value={cardNumber}
                    onChange={e => setCardNumber(formatCardInput(e.target.value))}
                    placeholder="4242 4242 4242 4242"
                    required
                  />
                </div>

                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">Expiry Month</label>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      max="12"
                      value={expiryMonth}
                      onChange={e => setExpiryMonth(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expiry Year</label>
                    <input
                      className="form-input"
                      type="number"
                      min={new Date().getFullYear()}
                      value={expiryYear}
                      onChange={e => setExpiryYear(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">CVV</label>
                    <input
                      className="form-input"
                      type="password"
                      value={cvv}
                      onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="123"
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="btn-primary btn-full" disabled={cardLoading}>
                  {cardLoading ? 'Processing Card Payment…' : `Pay ${fmt$(cardAmount)} via Card`}
                </button>
              </form>
            ) : activeMethod === 'manual' ? (
              <form className="wallet-payment-form" onSubmit={handleManualTopup}>
                <div className="form-group">
                  <label className="form-label">Amount (USD)</label>
                  <input
                    className="form-input form-input-lg"
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="0.00"
                    value={manualAmount}
                    onChange={e => setManualAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <input
                    className="form-input"
                    type="password"
                    value={manualPassword}
                    onChange={e => setManualPassword(e.target.value)}
                    placeholder="Enter account password"
                    required
                  />
                </div>

                <div className="preset-row">
                  {presets.map(p => (
                    <button
                      key={p}
                      type="button"
                      className={`preset-btn ${Number(manualAmount) === p ? 'preset-btn-active' : ''}`}
                      onClick={() => setManualAmount(String(p))}
                    >
                      ${p.toLocaleString()}
                    </button>
                  ))}
                </div>

                <button type="submit" className="btn-primary btn-full" disabled={manualLoading}>
                  {manualLoading ? 'Processing…' : `Add ${fmt$(manualAmount)}`}
                </button>
              </form>
            ) : (
              <form className="wallet-payment-form" onSubmit={handleWithdraw}>
                <div className="form-group">
                  <label className="form-label">Withdraw Amount (USD)</label>
                  <input
                    className="form-input form-input-lg"
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="0.00"
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <input
                    className="form-input"
                    type="password"
                    value={withdrawPassword}
                    onChange={e => setWithdrawPassword(e.target.value)}
                    placeholder="Enter account password"
                    required
                  />
                </div>

                <button type="submit" className="btn-sell btn-full" disabled={withdrawLoading}>
                  {withdrawLoading ? 'Processing Withdrawal…' : `Withdraw ${fmt$(withdrawAmount)}`}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="card wallet-transactions-card">
          <div className="card-header">
            <h2 className="card-title">Recent Transactions</h2>
            <span className="card-hint">Latest 20 entries</span>
          </div>

          {transactions.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 18px' }}>
              <p className="empty-state-title">No wallet transactions yet</p>
              <p className="empty-state-sub">Card payments and manual top-ups will appear here.</p>
            </div>
          ) : (
            <div className="wallet-tx-list">
              {transactions.map(tx => (
                <div key={tx.id} className="wallet-tx-item">
                  <div>
                    <div className="wallet-tx-head">
                      <span className="wallet-tx-type">{tx.type}</span>
                      <span className={`badge ${tx.status === 'SUCCESS' ? 'badge-success' : 'badge-danger'}`}>
                        {tx.status}
                      </span>
                    </div>
                    <div className="wallet-tx-sub">
                      {tx.paymentMethod || 'N/A'}
                      {tx.cardLast4 ? ` • **** ${tx.cardLast4}` : ''}
                      {tx.gateway ? ` • ${tx.gateway}` : ''}
                    </div>
                    <div className="wallet-tx-time">{new Date(tx.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="wallet-tx-right">
                    <div className="wallet-tx-amount">{fmt$(tx.amount)}</div>
                    {tx.note && <div className="wallet-tx-note">{tx.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="info-box wallet-info-box">
        <strong>Security Notes:</strong> Deposits and withdrawals now require password confirmation. For sandbox card testing, use 4242 4242 4242 4242 for approval, 4000 0000 0000 0002 for insufficient funds, and 4000 0000 0000 9995 for security decline.
      </div>
    </div>
  )
}