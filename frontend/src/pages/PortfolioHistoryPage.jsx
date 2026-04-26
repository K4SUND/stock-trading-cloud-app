import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { authHeaders, orderApi, priceApi } from '../api'
import { useAuth } from '../context/AuthContext'

function fmt$(n) {
  return `$${Number(n).toFixed(2)}`
}

function fmtTime(ms) {
  if (!ms) return '—'
  return new Date(ms).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PortfolioHistoryPage() {
  const { ticker: tickerParam } = useParams()
  const ticker = (tickerParam || '').toUpperCase()
  const { token } = useAuth()
  const headers = authHeaders(token)

  const [stocks, setStocks] = useState([])
  const [portfolio, setPortfolio] = useState([])
  const [orders, setOrders] = useState([])
  const [trades, setTrades] = useState([])
  const [ipoPurchases, setIpoPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function loadData() {
    if (!ticker) return
    setLoading(true)
    setError(null)
    try {
      const [stocksRes, portfolioRes, ordersRes, tradesRes, ipoRes] = await Promise.all([
        priceApi.get('/stocks'),
        orderApi.get('/portfolio', { headers }),
        orderApi.get('', { headers }),
        orderApi.get('/trades', { headers }),
        orderApi.get('/ipo-purchases', { headers }),
      ])
      setStocks(stocksRes.data || [])
      setPortfolio(portfolioRes.data || [])
      setOrders(ordersRes.data || [])
      setTrades(tradesRes.data || [])
      setIpoPurchases(ipoRes.data || [])
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to load ticker history.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, token])

  const currentStock = stocks.find(s => s.ticker === ticker)
  const holding = portfolio.find(p => p.stockTicker === ticker)
  const myOrderIds = useMemo(() => new Set(orders.map(o => o.id)), [orders])

  const transactions = useMemo(() => {
    const secondary = trades
      .filter(t => t.ticker === ticker)
      .map(t => {
        const isBuy = myOrderIds.has(t.buyOrderId)
        return {
          key: `trade-${t.id}`,
          ts: t.executedAt,
          source: 'Secondary',
          side: isBuy ? 'BUY' : 'SELL',
          quantity: t.quantity,
          price: t.price,
          total: t.value,
          ref: `Order #${isBuy ? t.sellOrderId : t.buyOrderId}`,
        }
      })

    const ipo = ipoPurchases
      .filter(p => p.ticker === ticker)
      .map(p => ({
        key: `ipo-${p.id}`,
        ts: p.purchasedAt,
        source: 'IPO',
        side: 'BUY',
        quantity: p.quantity,
        price: p.pricePerShare,
        total: p.totalValue,
        ref: 'Primary issue',
      }))

    return [...secondary, ...ipo].sort((a, b) => b.ts - a.ts)
  }, [ticker, trades, ipoPurchases, myOrderIds])

  const holdingValue = holding && currentStock ? Number(holding.quantity) * Number(currentStock.currentPrice) : null
  const avgCost = holding?.avgCostBasis != null ? Number(holding.avgCostBasis) : null
  const pnl = holdingValue != null && avgCost != null ? holdingValue - Number(holding.quantity) * avgCost : null
  const pnlPct = avgCost != null && avgCost > 0 && currentStock
    ? ((Number(currentStock.currentPrice) - avgCost) / avgCost) * 100
    : null

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <Link to="/" style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 600 }}>
            ← Back to dashboard
          </Link>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            {ticker || 'Ticker'} transaction history
          </h1>
          <p className="page-subtitle">
            All transactions for this ticker, newest first. IPO purchases and secondary market trades are combined here.
          </p>
        </div>
        <button className="btn-ghost" onClick={loadData} disabled={loading}>
          ↺ Refresh
        </button>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Ticker</span>
          <span className="stat-value" style={{ fontSize: 24 }}>{ticker || '—'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Shares Held</span>
          <span className="stat-value">{holding ? holding.quantity.toLocaleString() : '—'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Avg Cost</span>
          <span className="stat-value">{avgCost != null ? fmt$(avgCost) : '—'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Current Price</span>
          <span className="stat-value">{currentStock ? fmt$(currentStock.currentPrice) : '—'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Transactions</span>
          <span className="stat-value">{transactions.length}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Position Summary</h2>
          <span className="card-hint">Updated from your portfolio and live market prices</span>
        </div>
        <div style={{ padding: '18px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <div>
            <div className="card-hint">Market Value</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{holdingValue != null ? fmt$(holdingValue) : '—'}</div>
          </div>
          <div>
            <div className="card-hint">Unrealized P&amp;L</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: pnl == null ? 'inherit' : pnl >= 0 ? 'var(--buy)' : 'var(--sell)' }}>
              {pnl != null ? `${pnl >= 0 ? '+' : ''}${fmt$(pnl)}` : '—'}
            </div>
          </div>
          <div>
            <div className="card-hint">P&amp;L %</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: pnlPct == null ? 'inherit' : pnlPct >= 0 ? 'var(--buy)' : 'var(--sell)' }}>
              {pnlPct != null ? `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%` : '—'}
            </div>
          </div>
          <div>
            <div className="card-hint">Last Updated</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{currentStock?.lastUpdatedAt || '—'}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Transaction History</h2>
          <span className="card-hint">Newest transactions appear at the top</span>
        </div>
        {loading ? (
          <div className="empty-state">
            <div className="empty-state-icon">⏳</div>
            <p className="empty-state-title">Loading transactions…</p>
          </div>
        ) : error ? (
          <div className="empty-state">
            <div className="empty-state-icon">⚠️</div>
            <p className="empty-state-title">Could not load history</p>
            <p className="empty-state-sub">{error}</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <p className="empty-state-title">No transactions found</p>
            <p className="empty-state-sub">
              This ticker has no IPO purchases or matched trades in your account yet.
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Side</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Total</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(txn => (
                  <tr key={txn.key}>
                    <td className="text-muted text-sm">{fmtTime(txn.ts)}</td>
                    <td>
                      <span className="ticker-badge">{txn.source}</span>
                    </td>
                    <td className={txn.side === 'BUY' ? 'type-buy' : 'type-sell'}>
                      {txn.side === 'BUY' ? '▲ Bought' : '▼ Sold'}
                    </td>
                    <td className="text-right">{txn.quantity.toLocaleString()}</td>
                    <td className="text-right font-med">{fmt$(txn.price)}</td>
                    <td className="text-right">{fmt$(txn.total)}</td>
                    <td className="text-muted text-sm">{txn.ref}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

