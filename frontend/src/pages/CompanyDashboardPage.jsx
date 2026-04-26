import React, { useEffect, useMemo, useState } from 'react'
import { authHeaders, companyApi, priceApi, orderApi, userApi } from '../api'
import { useAuth } from '../context/AuthContext'

// ─── Micro sparkline SVG ─────────────────────────────────────────────────────
function Sparkline({ data = [], color = '#2563eb', width = 80, height = 32 }) {
  if (!data || data.length < 2) return <span style={{ color: 'var(--muted)', fontSize: 11 }}>No data</span>
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ─── Simple bar chart ─────────────────────────────────────────────────────────
function BarChart({ data, height = 120 }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height, width: '100%' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: '100%',
            background: `linear-gradient(180deg, ${d.color || '#2563eb'} 0%, ${d.color || '#2563eb'}55 100%)`,
            height: `${(d.value / max) * 100}%`,
            borderRadius: '4px 4px 0 0',
            minHeight: 3,
            transition: 'height 0.8s cubic-bezier(0.34,1.56,0.64,1)',
          }} />
          <span style={{ fontSize: 9, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '100%', textAlign: 'center' }}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Donut chart ─────────────────────────────────────────────────────────────
function DonutChart({ segments, size = 90 }) {
  const r = 38, cx = 45, cy = 45, circ = 2 * Math.PI * r
  let offset = 0
  const total = segments.reduce((a, s) => a + s.value, 0) || 1
  return (
    <svg width={size} height={size} viewBox="0 0 90 90">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e8edf5" strokeWidth="12" />
      {segments.map((s, i) => {
        const pct = s.value / total
        const dash = pct * circ
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color} strokeWidth="12"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 45 45)"
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        )
        offset += dash
        return el
      })}
    </svg>
  )
}

const PALETTE = ['#2563eb', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#06b6d4']

const emptyProfile = { companyName: '', description: '', contactEmail: '', website: '' }
const emptyStock = { ticker: '', initialPrice: '', totalShares: '', description: '' }

const TABS = ['Overview', 'Listing', 'Traders', 'Settings']
const CHART_RANGES = ['1D', '1W', '1M', '3M', '1Y', 'ALL']

export default function CompanyDashboardPage() {
  const { token } = useAuth()
  const headers = authHeaders(token)

  const [activeTab, setActiveTab] = useState('Overview')
  const [profile, setProfile] = useState(null)
  const [profileForm, setProfileForm] = useState(emptyProfile)
  const [profileMsg, setProfileMsg] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [stocks, setStocks] = useState([])
  const [prices, setPrices] = useState({})
  const [marketTrades, setMarketTrades] = useState([])
  const [traders, setTraders] = useState([])
  const [stockForm, setStockForm] = useState(emptyStock)
  const [stockMsg, setStockMsg] = useState(null)
  const [stockLoading, setStockLoading] = useState(false)
  const [isEditingStock, setIsEditingStock] = useState(false)
  const [chartRange, setChartRange] = useState('ALL')

  // Single listing: if exists, update it; otherwise create
  const existingStock = stocks[0] || null

  useEffect(() => {
    if (!token) return
    loadProfile()
    loadStocks()
    loadPrices()
  }, [token])

  useEffect(() => {
    if (!token) return
    if (!existingStock?.ticker) {
      setMarketTrades([])
      return
    }
    loadMarketTrades(existingStock.ticker, chartRange)
    const timer = setInterval(() => {
      loadPrices()
      loadMarketTrades(existingStock.ticker, chartRange)
    }, 5000)
    return () => clearInterval(timer)
  }, [token, existingStock?.ticker, chartRange])

  async function loadProfile() {
    try {
      const res = await companyApi.get('/profile', { headers })
      setProfile(res.data); setProfileForm(res.data)
    } catch { }
  }

  async function loadStocks() {
    try {
      const res = await companyApi.get('/stocks', { headers })
      setStocks(res.data)
      if (res.data.length > 0) await loadTraders(res.data.map(s => s.ticker))
    } catch { setStocks([]) }
  }

  async function loadPrices() {
    try {
      const res = await priceApi.get('/stocks')
      const map = {}
      for (const p of res.data) map[p.ticker] = p
      setPrices(map)
    } catch { setPrices({}) }
  }

  async function loadMarketTrades(ticker, range) {
    if (!ticker) {
      setMarketTrades([])
      return
    }
    try {
      const res = await orderApi.get('/market/trades', {
        headers,
        params: { ticker, range },
      })
      setMarketTrades(res.data)
    } catch {}
  }

  async function loadTraders(tickers) {
    if (!tickers?.length) { setTraders([]); return }
    try {
      const holdersRes = await orderApi.get('/holders', { headers, params: { tickers: tickers.join(',') } })
      const holders = holdersRes.data
      if (!holders.length) { setTraders([]); return }
      const uniqueIds = [...new Set(holders.map(h => h.userId))]
      const usersRes = await userApi.get('/batch', { headers, params: { ids: uniqueIds.join(',') } })
      const userMap = {}
      for (const u of usersRes.data) userMap[u.id] = u.username
      const byUser = {}
      for (const h of holders) {
        if (!byUser[h.userId]) byUser[h.userId] = { userId: h.userId, username: userMap[h.userId] || `User #${h.userId}`, holdings: [], total: 0 }
        byUser[h.userId].holdings.push({ ticker: h.stockTicker, quantity: h.quantity })
        byUser[h.userId].total += h.quantity
      }
      setTraders(Object.values(byUser).sort((a, b) => b.total - a.total))
    } catch { setTraders([]) }
  }

  async function saveProfile(e) {
    e.preventDefault(); setProfileMsg(null); setProfileLoading(true)
    try {
      const res = await companyApi.post('/profile', profileForm, { headers })
      setProfile(res.data); setProfileMsg({ type: 'success', text: 'Company profile saved successfully.' })
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.message || 'Failed to save profile.' })
    } finally { setProfileLoading(false) }
  }


  function startEditStock() {
    if (existingStock) {
      setStockForm({
        ticker: existingStock.ticker,
        initialPrice: String(existingStock.initialPrice),
        totalShares: String(existingStock.totalShares),
        description: existingStock.description || '',
      })
    } else {
      setStockForm(emptyStock)
    }
    setIsEditingStock(true)
    setStockMsg(null)
  }

  function cancelEditStock() {
    setIsEditingStock(false)
    setStockForm(emptyStock)
    setStockMsg(null)
  }

  async function submitStock(e) {
    e.preventDefault(); setStockMsg(null); setStockLoading(true)
    const payload = { ...stockForm, initialPrice: Number(stockForm.initialPrice), totalShares: Number(stockForm.totalShares) }
    try {
      if (existingStock) {
        await companyApi.put(`/stocks/${existingStock.ticker}`, payload, { headers })
        setStockMsg({ type: 'success', text: 'Listing updated successfully.' })
      } else {
        await companyApi.post('/stocks', payload, { headers })
        setStockMsg({ type: 'success', text: `${stockForm.ticker.toUpperCase()} is now live on the market.` })
      }
      setIsEditingStock(false)
      await loadStocks()
      await loadPrices()
    } catch (err) {
      setStockMsg({ type: 'error', text: err.response?.data?.message || 'Failed to save stock.' })
    } finally { setStockLoading(false) }
  }

  // ── derived stats ──
  const totalMarketCap = stocks.reduce((acc, s) => {
    const p = prices[s.ticker]
    return acc + (p ? Number(p.currentPrice) * Number(s.totalShares) : Number(s.initialPrice) * Number(s.totalShares))
  }, 0)
  const totalTraders = traders.length
  const totalShares = stocks.reduce((acc, s) => acc + Number(s.totalShares), 0)
  const totalSharesHeld = traders.reduce((acc, t) => acc + t.total, 0)

  function buildTransactionSeries(ticker, ipoPrice, currentPrice) {
    const trades = marketTrades
      .filter(t => t.ticker === ticker)
      .slice()
      .sort((a, b) => a.executedAt - b.executedAt)

    const start = Number(ipoPrice ?? currentPrice ?? 0)
    const series = Number.isFinite(start) && start > 0 ? [start] : []

    for (const trade of trades) {
      const price = Number(trade.price)
      if (Number.isFinite(price) && price > 0) series.push(price)
    }

    const fallback = Number(currentPrice ?? ipoPrice ?? 0)
    if (series.length === 0 && Number.isFinite(fallback) && fallback > 0) {
      return [fallback, fallback]
    }
    if (series.length === 1) series.push(series[0])
    return series.length > 0 ? series : [1, 1]
  }

  const listedTicker = existingStock?.ticker || null
  const liveChartData = useMemo(() => {
    if (!existingStock) return []
    const p = prices[existingStock.ticker]
    const current = p ? Number(p.currentPrice) : Number(existingStock.initialPrice)
    return buildTransactionSeries(existingStock.ticker, existingStock.initialPrice, current)
  }, [existingStock, prices, marketTrades])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&family=Nunito+Sans:wght@300;400;500;600&family=Fira+Code:wght@400;500&display=swap');

        :root {
          --bg:        #f4f7fb;
          --surface:   #ffffff;
          --surface2:  #f0f4f9;
          --border:    #e2e8f2;
          --border2:   #cdd7e8;
          --accent:    #2563eb;
          --accent2:   #1d4ed8;
          --accent-lt: #eff6ff;
          --green:     #059669;
          --green-lt:  #ecfdf5;
          --red:       #dc2626;
          --red-lt:    #fef2f2;
          --amber:     #d97706;
          --amber-lt:  #fffbeb;
          --violet:    #7c3aed;
          --text:      #0f172a;
          --text2:     #334155;
          --muted:     #64748b;
          --muted2:    #94a3b8;
          --mono:      'Fira Code', monospace;
          --display:   'Nunito', sans-serif;
          --body:      'Nunito Sans', sans-serif;
          --shadow-sm: 0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04);
          --shadow:    0 4px 12px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06);
          --radius:    12px;
        }

        .cdb-wrap * { box-sizing: border-box; margin: 0; padding: 0; }
        .cdb-wrap {
          font-family: var(--body);
          background: var(--bg);
          color: var(--text);
          min-height: 100vh;
          -webkit-font-smoothing: antialiased;
        }

        /* ── Top bar ── */
        .cdb-topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 28px; height: 58px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          position: sticky; top: 0; z-index: 100;
          box-shadow: var(--shadow-sm);
        }
        .cdb-topbar-left {
          display: flex; align-items: center; gap: 10px;
        }
        .cdb-topbar-icon {
          width: 32px; height: 32px; border-radius: 8px;
          background: linear-gradient(135deg, var(--accent), var(--accent2));
          display: flex; align-items: center; justify-content: center;
          font-size: 16px;
        }
        .cdb-topbar-title {
          font-family: var(--display); font-size: 15px; font-weight: 800;
          color: var(--text); letter-spacing: -0.01em;
        }
        .cdb-topbar-company {
          font-size: 13px; font-weight: 500; color: var(--muted);
        }
        .cdb-topbar-company strong { color: var(--text2); margin-left: 5px; font-weight: 700; }
        .cdb-live-dot {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11.5px; font-weight: 600; color: var(--green); font-family: var(--mono);
          background: var(--green-lt); border: 1px solid #a7f3d0; border-radius: 20px;
          padding: 4px 10px;
        }
        .cdb-live-dot::before {
          content: ''; width: 7px; height: 7px; border-radius: 50%;
          background: var(--green);
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }

        /* ── Tab nav ── */
        .cdb-tabnav {
          display: flex; align-items: center; gap: 2px;
          padding: 0 24px; border-bottom: 1px solid var(--border);
          background: var(--surface);
        }
        .cdb-tab {
          padding: 15px 18px; font-size: 13px; font-weight: 600;
          font-family: var(--display); color: var(--muted); cursor: pointer;
          border: none; background: none; border-bottom: 2.5px solid transparent;
          transition: color 0.2s, border-color 0.2s; letter-spacing: -0.01em;
          margin-bottom: -1px;
        }
        .cdb-tab:hover { color: var(--text2); }
        .cdb-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

        /* ── Content ── */
        .cdb-content { padding: 28px; max-width: 1440px; }

        /* ── Stat cards row ── */
        .cdb-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 22px; }
        @media(max-width:900px){ .cdb-stats{grid-template-columns:repeat(2,1fr)} }
        @media(max-width:500px){ .cdb-stats{grid-template-columns:1fr} }

        .cdb-stat {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 20px 22px;
          box-shadow: var(--shadow-sm); position: relative; overflow: hidden;
        }
        .cdb-stat::after {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: var(--accent-line, var(--accent));
          border-radius: var(--radius) var(--radius) 0 0;
        }
        .cdb-stat-label {
          font-size: 11px; font-weight: 700; color: var(--muted);
          letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 10px;
          font-family: var(--display);
        }
        .cdb-stat-value {
          font-family: var(--mono); font-size: 22px; font-weight: 500;
          color: var(--text); line-height: 1;
        }
        .cdb-stat-sub { margin-top: 7px; font-size: 11.5px; color: var(--muted); }

        /* ── Panel grid ── */
        .cdb-grid { display: grid; grid-template-columns: 1fr 320px; gap: 16px; margin-bottom: 22px; }
        @media(max-width:1100px){ .cdb-grid{grid-template-columns:1fr} }

        /* ── Card ── */
        .cdb-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); overflow: hidden;
          box-shadow: var(--shadow-sm);
        }
        .cdb-card-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 15px 20px; border-bottom: 1px solid var(--border);
          background: var(--surface2);
        }
        .cdb-card-title {
          font-family: var(--display); font-size: 13px; font-weight: 800;
          letter-spacing: -0.01em; color: var(--text);
        }
        .cdb-card-body { padding: 20px; }

        /* ── Table ── */
        .cdb-table { width: 100%; border-collapse: collapse; }
        .cdb-table th {
          font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
          color: var(--muted); padding: 11px 16px; text-align: left;
          border-bottom: 1px solid var(--border); white-space: nowrap;
          background: var(--surface2); font-family: var(--display);
        }
        .cdb-table th.r { text-align: right; }
        .cdb-table td {
          padding: 13px 16px; font-size: 13.5px; border-bottom: 1px solid var(--border);
          vertical-align: middle; color: var(--text2);
        }
        .cdb-table tr:last-child td { border-bottom: none; }
        .cdb-table tr:hover td { background: #f8fafd; }
        .cdb-table td.r { text-align: right; }
        .cdb-table td.mono { font-family: var(--mono); color: var(--text); }

        /* ── Ticker badge ── */
        .cdb-ticker {
          display: inline-block; font-family: var(--mono); font-size: 11px; font-weight: 500;
          background: var(--accent-lt); color: var(--accent);
          border: 1px solid #bfdbfe; border-radius: 6px; padding: 2px 8px; letter-spacing: 0.06em;
        }

        /* ── Buy/Sell badge ── */
        .badge-buy  { display:inline-block; padding:3px 9px; border-radius:6px; font-size:10.5px; font-weight:700; font-family:var(--mono); background:var(--green-lt); color:var(--green); border:1px solid #a7f3d0; }
        .badge-sell { display:inline-block; padding:3px 9px; border-radius:6px; font-size:10.5px; font-weight:700; font-family:var(--mono); background:var(--red-lt); color:var(--red); border:1px solid #fecaca; }
        .badge-none { display:inline-block; padding:3px 9px; border-radius:6px; font-size:10.5px; font-weight:700; font-family:var(--mono); background:var(--surface2); color:var(--muted); border:1px solid var(--border); }

        /* ── Price delta ── */
        .delta-up   { color: var(--green); font-family: var(--mono); font-size: 12.5px; font-weight: 500; }
        .delta-down { color: var(--red);   font-family: var(--mono); font-size: 12.5px; font-weight: 500; }

        /* ── Alert banner ── */
        .cdb-alert { border-radius: 10px; padding: 12px 16px; font-size: 13px; margin-bottom: 16px; font-weight: 500; }
        .cdb-alert.warn { background: var(--amber-lt); border: 1px solid #fcd34d; color: var(--amber); }
        .cdb-alert.ok   { background: var(--green-lt); border: 1px solid #a7f3d0; color: var(--green); }
        .cdb-alert.err  { background: var(--red-lt); border: 1px solid #fecaca; color: var(--red); }

        /* ── Form ── */
        .cdb-form-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        @media(max-width:600px){ .cdb-form-grid2{grid-template-columns:1fr} }
        .cdb-label {
          display: block; font-size: 12px; font-weight: 700;
          letter-spacing: 0.02em; color: var(--text2); margin-bottom: 7px;
          font-family: var(--display);
        }
        .cdb-label span { font-weight: 400; font-size: 11px; margin-left: 5px; color: var(--muted); }
        .cdb-input {
          width: 100%; background: var(--surface);
          border: 1.5px solid var(--border2);
          border-radius: 9px; padding: 10px 14px; font-size: 14px; color: var(--text);
          font-family: var(--body); outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .cdb-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px #2563eb18; }
        .cdb-input::placeholder { color: var(--muted2); }
        .cdb-input.mono { font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.08em; font-size: 14px; }
        .cdb-input-wrap { position: relative; }
        .cdb-input-prefix {
          position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
          color: var(--muted); font-family: var(--mono); font-weight: 600; pointer-events: none;
        }
        .cdb-input.prefixed { padding-left: 26px; }
        textarea.cdb-input { resize: vertical; min-height: 82px; }
        .cdb-input:disabled { background: var(--surface2); color: var(--muted); cursor: not-allowed; }

        /* ── Buttons ── */
        .cdb-btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          background: linear-gradient(135deg, var(--accent), var(--accent2));
          color: #fff; font-family: var(--display); font-size: 13px; font-weight: 800;
          letter-spacing: -0.01em;
          border: none; border-radius: 9px; padding: 10px 22px; cursor: pointer;
          transition: opacity 0.2s, transform 0.1s, box-shadow 0.2s;
          box-shadow: 0 2px 8px rgba(37,99,235,0.3);
        }
        .cdb-btn-primary:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(37,99,235,0.35); }
        .cdb-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
        .cdb-btn-ghost {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--surface); color: var(--text2); font-size: 13px; font-family: var(--display);
          font-weight: 600; border: 1.5px solid var(--border2); border-radius: 9px;
          padding: 8px 16px; cursor: pointer;
          transition: color 0.15s, border-color 0.15s, background 0.15s;
        }
        .cdb-btn-ghost:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-lt); }
        .cdb-btn-link {
          background: none; border: none; color: var(--accent); font-size: 12.5px;
          font-family: var(--display); font-weight: 700; cursor: pointer; padding: 0;
          text-decoration: underline; text-underline-offset: 3px; letter-spacing: -0.01em;
        }

        /* ── Trader avatar ── */
        .cdb-avatar {
          width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-family: var(--display); font-size: 13px; font-weight: 800; color: #fff;
        }

        /* ── Holdings chip ── */
        .cdb-chip {
          display: inline-flex; align-items: center; gap: 5px;
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 6px; padding: 3px 9px; font-size: 11.5px;
        }

        /* ── Empty row ── */
        .cdb-empty { padding: 40px 0; text-align: center; color: var(--muted); font-size: 13.5px; }

        /* ── Section heading ── */
        .cdb-section-head {
          display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px;
        }
        .cdb-section-title {
          font-family: var(--display); font-size: 20px; font-weight: 800;
          color: var(--text); letter-spacing: -0.02em;
        }

        /* ── Divider ── */
        .cdb-divider { border: none; border-top: 1px solid var(--border); margin: 24px 0; }

        /* ── Distribution bar ── */
        .dist-bar { height: 5px; border-radius: 3px; background: var(--border); overflow: hidden; margin-top: 5px; }
        .dist-bar-fill { height: 100%; border-radius: 3px; transition: width 0.8s ease; }

        /* Scrollable table wrapper */
        .table-scroll { overflow-x: auto; }

        /* Stagger animation */
        .fade-in { animation: fadeUp 0.35s ease both; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }

        /* ── Listing status card ── */
        .cdb-listing-card {
          background: var(--surface); border: 1.5px solid var(--border);
          border-radius: var(--radius); padding: 24px 26px;
          box-shadow: var(--shadow-sm); margin-bottom: 20px;
        }
        .cdb-listing-header {
          display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 16px;
          margin-bottom: 22px;
        }
        .cdb-listing-meta { display: flex; flex-direction: column; gap: 6px; }
        .cdb-listing-name {
          font-family: var(--display); font-size: 22px; font-weight: 800;
          color: var(--text); letter-spacing: -0.02em; display: flex; align-items: center; gap: 10px;
        }
        .cdb-listing-desc { font-size: 13px; color: var(--muted); max-width: 500px; line-height: 1.5; }
        .cdb-listing-kpis {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
          padding-top: 18px; border-top: 1px solid var(--border);
        }
        .cdb-kpi { display: flex; flex-direction: column; gap: 4px; }
        .cdb-kpi-label { font-size: 10.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.07em; font-family: var(--display); }
        .cdb-kpi-value { font-family: var(--mono); font-size: 17px; font-weight: 500; color: var(--text); }

        /* ── Create listing prompt ── */
        .cdb-create-prompt {
          border: 2px dashed var(--border2); border-radius: var(--radius);
          padding: 48px 32px; text-align: center; background: var(--surface);
          margin-bottom: 24px;
        }
        .cdb-create-icon { font-size: 40px; margin-bottom: 14px; }
        .cdb-create-title { font-family: var(--display); font-size: 18px; font-weight: 800; color: var(--text); margin-bottom: 6px; letter-spacing: -0.02em; }
        .cdb-create-sub { font-size: 13px; color: var(--muted); margin-bottom: 20px; line-height: 1.5; }

        /* ── Inline form wrapper ── */
        .cdb-inline-form {
          background: var(--surface); border: 1.5px solid var(--border);
          border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow-sm);
        }
        .cdb-inline-form-head {
          padding: 16px 22px; background: var(--accent-lt);
          border-bottom: 1px solid #bfdbfe;
          display: flex; align-items: center; justify-content: space-between;
        }
        .cdb-inline-form-head-title { font-family: var(--display); font-size: 14px; font-weight: 800; color: var(--accent); }
        .cdb-inline-form-body { padding: 24px 22px; }
        .cdb-form-row { margin-bottom: 20px; }

        .cdb-range-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
        .cdb-range-btn {
          border: 1px solid var(--border2);
          background: var(--surface);
          color: var(--muted);
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 11px;
          font-family: var(--mono);
          cursor: pointer;
          transition: all 0.15s;
        }
        .cdb-range-btn:hover { color: var(--accent); border-color: #93c5fd; background: var(--accent-lt); }
        .cdb-range-btn.active { color: var(--accent); border-color: var(--accent); background: var(--accent-lt); }
      `}</style>

      <div className="cdb-wrap">
        {/* ── Top bar ── */}
        <div className="cdb-topbar">
          <div className="cdb-topbar-left">
            <span className="cdb-topbar-title">Dashboard</span>
          </div>
          <div className="cdb-topbar-company">
            {profile
              ? <><strong>{profile.companyName}</strong></>
              : <span style={{ color: 'var(--muted2)' }}>No profile set up</span>
            }
          </div>
          <div className="cdb-live-dot">Live</div>
        </div>

        {/* ── Tab nav ── */}
        <div className="cdb-tabnav">
          {TABS.map(t => (
            <button key={t} className={`cdb-tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
              {t}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="cdb-content">

          {!profile && activeTab !== 'Settings' && (
            <div className="cdb-alert warn fade-in" style={{ marginBottom: 20 }}>
              ⚠ Your company profile isn't set up yet. Head to <strong>Settings</strong> to complete it before listing a stock.
            </div>
          )}

          {/* ════════════════════════════ OVERVIEW ════════════════════════════ */}
          {activeTab === 'Overview' && (
            <div className="fade-in">
              <div className="cdb-stats">
                {[
                  { label: 'Market Cap', value: `$${totalMarketCap >= 1e9 ? (totalMarketCap / 1e9).toFixed(2) + 'B' : totalMarketCap >= 1e6 ? (totalMarketCap / 1e6).toFixed(2) + 'M' : totalMarketCap.toFixed(2)}`, sub: existingStock ? existingStock.ticker : 'no listing', color: 'linear-gradient(90deg, #2563eb, #1d4ed8)' },
                  { label: 'Shares Issued', value: totalShares.toLocaleString(), sub: `${totalSharesHeld.toLocaleString()} in circulation`, color: 'linear-gradient(90deg, #7c3aed, #6d28d9)' },
                  { label: 'Active Traders', value: totalTraders.toLocaleString(), sub: 'holding your stock', color: 'linear-gradient(90deg, #059669, #047857)' },
                  { label: 'Float Held', value: totalShares > 0 ? `${((totalSharesHeld / totalShares) * 100).toFixed(1)}%` : '—', sub: 'shares in circulation', color: 'linear-gradient(90deg, #d97706, #b45309)' },
                ].map((s, i) => (
                  <div key={i} className="cdb-stat" style={{ '--accent-line': s.color }}>
                    <div className="cdb-stat-label">{s.label}</div>
                    <div className="cdb-stat-value">{s.value}</div>
                    <div className="cdb-stat-sub">{s.sub}</div>
                  </div>
                ))}
              </div>

              <div className="cdb-grid">
                {/* Live listing panel */}
                <div className="cdb-card">
                  <div className="cdb-card-head">
                    <span className="cdb-card-title">Live Listing</span>
                    <button className="cdb-btn-ghost" onClick={() => { loadStocks(); loadPrices() }}>↻ Refresh</button>
                  </div>
                  {!existingStock ? (
                    <div className="cdb-empty" style={{ padding: '50px 20px' }}>
                      No stock listed yet.{' '}
                      <button className="cdb-btn-link" onClick={() => setActiveTab('Listing')}>Create one →</button>
                    </div>
                  ) : (() => {
                    const s = existingStock
                    const p = prices[s.ticker]
                    const curr = p ? Number(p.currentPrice) : Number(s.initialPrice)
                    const init = Number(s.initialPrice)
                    const delta = ((curr - init) / init) * 100
                    const isBuy = p?.lastTradeType === 'BUY'
                    return (
                      <div style={{ padding: '24px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{
                              width: 48, height: 48, borderRadius: 12,
                              background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                              border: '1.5px solid #bfdbfe',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13, color: 'var(--accent)',
                            }}>{s.ticker.slice(0, 2)}</div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span className="cdb-ticker">{s.ticker}</span>
                                {p?.lastTradeType
                                  ? <span className={isBuy ? 'badge-buy' : 'badge-sell'}>{isBuy ? '▲ BUY' : '▼ SELL'}</span>
                                  : <span className="badge-none">NO TRADES</span>
                                }
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.description || 'No description'}</div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 26, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                              ${curr.toFixed(2)}
                            </div>
                            <div className={delta >= 0 ? 'delta-up' : 'delta-down'} style={{ fontSize: 13 }}>
                              {delta >= 0 ? '+' : ''}{delta.toFixed(2)}% from IPO
                            </div>
                          </div>
                        </div>
                        <div style={{ marginBottom: 20 }}>
                          <div className="cdb-range-row">
                            {CHART_RANGES.map(r => (
                              <button
                                key={r}
                                className={`cdb-range-btn ${chartRange === r ? 'active' : ''}`}
                                onClick={() => setChartRange(r)}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <Sparkline data={liveChartData} color={delta >= 0 ? 'var(--green)' : 'var(--red)'} width={420} height={56} />
                            <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
                              History {chartRange} from executed trades{listedTicker ? ` for ${listedTicker}` : ''}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
                          {[
                            ['IPO Price', `$${init.toFixed(2)}`],
                            ['Current Price', p ? `$${curr.toFixed(2)}` : '—'],
                            ['Total Shares', Number(s.totalShares).toLocaleString()],
                          ].map(([k, v]) => (
                            <div key={k}>
                              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--display)', marginBottom: 4 }}>{k}</div>
                              <div style={{ fontFamily: 'var(--mono)', fontSize: 15, color: 'var(--text)' }}>{v}</div>
                            </div>
                          ))}
                        </div>
                        {p?.lastTradeType && (
                          <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                            {[
                              ['Last Trade Price', `$${Number(p.lastTradePrice).toFixed(2)}`],
                              ['Last Trade Value', `$${Number(p.lastTradeValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
                            ].map(([k, v]) => (
                              <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{k}</span>
                                <span style={{ fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text)' }}>{v}</span>
                              </div>
                            ))}
                            {p.lastUpdatedAt && <span style={{ fontSize: 11, color: 'var(--muted2)', marginLeft: 'auto' }}>{p.lastUpdatedAt}</span>}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>

                {/* Right column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="cdb-card">
                    <div className="cdb-card-head">
                      <span className="cdb-card-title">Shareholder Split</span>
                    </div>
                    <div className="cdb-card-body">
                      {traders.length === 0 ? (
                        <div className="cdb-empty" style={{ padding: '20px 0' }}>No holders yet.</div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                          <DonutChart
                            segments={traders.slice(0, 6).map((t, i) => ({ value: t.total, color: PALETTE[i % PALETTE.length] }))}
                          />
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
                            {traders.slice(0, 5).map((t, i) => {
                              const pct = totalSharesHeld > 0 ? (t.total / totalSharesHeld) * 100 : 0
                              return (
                                <div key={t.userId}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
                                    <span style={{ color: 'var(--text2)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{t.username}</span>
                                    <span style={{ fontFamily: 'var(--mono)', color: PALETTE[i % PALETTE.length], fontSize: 11 }}>{pct.toFixed(1)}%</span>
                                  </div>
                                  <div className="dist-bar">
                                    <div className="dist-bar-fill" style={{ width: `${pct}%`, background: PALETTE[i % PALETTE.length] }} />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="cdb-card">
                    <div className="cdb-card-head">
                      <span className="cdb-card-title">Shares Issued</span>
                    </div>
                    <div className="cdb-card-body">
                      {stocks.length === 0 ? (
                        <div className="cdb-empty" style={{ padding: '16px 0' }}>No listings.</div>
                      ) : (
                        <BarChart
                          data={stocks.map((s, i) => ({ label: s.ticker, value: Number(s.totalShares), color: PALETTE[i % PALETTE.length] }))}
                          height={110}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════ LISTING ════════════════════════════ */}
          {activeTab === 'Listing' && (
            <div className="fade-in">
              <div className="cdb-section-head">
                <div className="cdb-section-title">{existingStock ? 'Your Listing' : 'Create a Listing'}</div>
                {existingStock && !isEditingStock && (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="cdb-btn-ghost" onClick={() => { loadStocks(); loadPrices() }}>↻ Refresh</button>
                    <button className="cdb-btn-primary" onClick={startEditStock}>✏ Edit Listing</button>
                  </div>
                )}
              </div>

              {stockMsg && (
                <div className={`cdb-alert ${stockMsg.type === 'success' ? 'ok' : 'err'}`}>
                  {stockMsg.text}
                </div>
              )}

              {/* ── Has a listing: show details card ── */}
              {existingStock && !isEditingStock && (() => {
                const s = existingStock
                const p = prices[s.ticker]
                const curr = p ? Number(p.currentPrice) : Number(s.initialPrice)
                const init = Number(s.initialPrice)
                const delta = ((curr - init) / init) * 100
                const isBuy = p?.lastTradeType === 'BUY'
                return (
                  <div className="cdb-listing-card">
                    <div className="cdb-listing-header">
                      <div className="cdb-listing-meta">
                        <div className="cdb-listing-name">
                          <span className="cdb-ticker" style={{ fontSize: 14, padding: '3px 10px' }}>{s.ticker}</span>
                          {p?.lastTradeType
                            ? <span className={isBuy ? 'badge-buy' : 'badge-sell'}>{isBuy ? '▲ BUY' : '▼ SELL'}</span>
                            : <span className="badge-none">NO TRADES</span>
                          }
                        </div>
                        <div className="cdb-listing-desc">{s.description || <em style={{ color: 'var(--muted2)' }}>No description set</em>}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 30, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                          ${curr.toFixed(2)}
                        </div>
                        <div className={delta >= 0 ? 'delta-up' : 'delta-down'} style={{ fontSize: 13, marginTop: 4 }}>
                          {delta >= 0 ? '+' : ''}{delta.toFixed(2)}% from IPO (${init.toFixed(2)})
                        </div>
                        <div className="cdb-range-row" style={{ justifyContent: 'flex-end', marginTop: 8, marginBottom: 8 }}>
                          {CHART_RANGES.map(r => (
                            <button
                              key={r}
                              className={`cdb-range-btn ${chartRange === r ? 'active' : ''}`}
                              onClick={() => setChartRange(r)}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                        <Sparkline data={liveChartData} color={delta >= 0 ? 'var(--green)' : 'var(--red)'} width={140} height={40} />
                      </div>
                    </div>
                    <div className="cdb-listing-kpis">
                      {[
                        ['IPO Price', `$${init.toFixed(2)}`],
                        ['Total Shares', Number(s.totalShares).toLocaleString()],
                        ['Shares Held', totalSharesHeld.toLocaleString()],
                        ['Float %', totalShares > 0 ? `${((totalSharesHeld / totalShares) * 100).toFixed(1)}%` : '—'],
                        ['Shareholders', totalTraders.toString()],
                        ['Market Cap', `$${(curr * Number(s.totalShares)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
                      ].map(([k, v]) => (
                        <div key={k} className="cdb-kpi">
                          <span className="cdb-kpi-label">{k}</span>
                          <span className="cdb-kpi-value">{v}</span>
                        </div>
                      ))}
                    </div>
                    {p?.lastTradePrice && (
                      <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                        {[
                          ['Last Trade Price', `$${Number(p.lastTradePrice).toFixed(2)}`],
                          ['Last Trade Value', `$${Number(p.lastTradeValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
                          ...(p.lastUpdatedAt ? [['Last Updated', p.lastUpdatedAt]] : []),
                        ].map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--display)' }}>{k}</span>
                            <span style={{ fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 500, color: 'var(--text2)' }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* ── No listing yet: create prompt ── */}
              {!existingStock && !isEditingStock && (
                <div className="cdb-create-prompt">
                  <div className="cdb-create-icon">📈</div>
                  <div className="cdb-create-title">You haven't listed a stock yet</div>
                  <div className="cdb-create-sub">
                    Create your company's stock listing to go live on the market.<br />
                    Traders will be able to discover and trade your shares.
                  </div>
                  <button className="cdb-btn-primary" onClick={startEditStock} disabled={!profile}>
                    + Create Stock Listing
                  </button>
                  {!profile && <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 12 }}>Set up your company profile in Settings first.</div>}
                </div>
              )}

              {/* ── Edit / Create Form ── */}
              {isEditingStock && (
                <div className="cdb-inline-form">
                  <div className="cdb-inline-form-head">
                    <span className="cdb-inline-form-head-title">
                      {existingStock ? `✏ Editing — ${existingStock.ticker}` : '+ New Stock Listing'}
                    </span>
                    <button className="cdb-btn-ghost" onClick={cancelEditStock}>Cancel</button>
                  </div>
                  <div className="cdb-inline-form-body">
                    <form onSubmit={submitStock}>
                      <div className="cdb-form-row">
                        <label className="cdb-label">Ticker Symbol <span>Short code used on the market (e.g. AAPL, TSLA)</span></label>
                        <input
                          className="cdb-input mono"
                          placeholder="e.g. ACME"
                          maxLength={8}
                          value={stockForm.ticker}
                          disabled={!!existingStock}
                          onChange={e => setStockForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                          required
                        />
                      </div>
                      <div className="cdb-form-grid2" style={{ marginBottom: 20 }}>
                        <div>
                          <label className="cdb-label">IPO Price (USD) <span>Opening price per share</span></label>
                          <div className="cdb-input-wrap">
                            <span className="cdb-input-prefix">$</span>
                            <input
                              className="cdb-input prefixed"
                              type="number" min="0.01" step="0.01" placeholder="0.00"
                              value={stockForm.initialPrice}
                              onChange={e => setStockForm(f => ({ ...f, initialPrice: e.target.value }))}
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <label className="cdb-label">Total Shares <span>Shares issued at IPO</span></label>
                          <input
                            className="cdb-input"
                            type="number" min="1" placeholder="e.g. 1,000,000"
                            value={stockForm.totalShares}
                            onChange={e => setStockForm(f => ({ ...f, totalShares: e.target.value }))}
                            required
                          />
                        </div>
                      </div>
                      <div className="cdb-form-row">
                        <label className="cdb-label">Description <span>Optional — shown to traders on the market</span></label>
                        <input
                          className="cdb-input"
                          placeholder="Brief description shown to traders…"
                          value={stockForm.description}
                          onChange={e => setStockForm(f => ({ ...f, description: e.target.value }))}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingTop: 6 }}>
                        <button type="submit" className="cdb-btn-primary" disabled={stockLoading || !profile}>
                          {stockLoading ? 'Saving…' : existingStock ? '✓ Save Changes' : '+ List on Market'}
                        </button>
                        <button type="button" className="cdb-btn-ghost" onClick={cancelEditStock}>Discard</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════ TRADERS ════════════════════════════ */}
          {activeTab === 'Traders' && (
            <div className="fade-in">
              <div className="cdb-section-head">
                <div className="cdb-section-title">Shareholders</div>
                <button className="cdb-btn-ghost" onClick={() => loadTraders(stocks.map(s => s.ticker))}>↻ Refresh</button>
              </div>

              <div className="cdb-stats" style={{ marginBottom: 22 }}>
                {[
                  { label: 'Total Shareholders', value: totalTraders.toString(), color: 'linear-gradient(90deg, #2563eb, #1d4ed8)' },
                  { label: 'Shares in Circulation', value: totalSharesHeld.toLocaleString(), color: 'linear-gradient(90deg, #059669, #047857)' },
                  { label: 'Float %', value: totalShares > 0 ? `${((totalSharesHeld / totalShares) * 100).toFixed(1)}%` : '—', color: 'linear-gradient(90deg, #d97706, #b45309)' },
                  { label: 'Avg Shares / Holder', value: totalTraders > 0 ? Math.round(totalSharesHeld / totalTraders).toLocaleString() : '—', color: 'linear-gradient(90deg, #7c3aed, #6d28d9)' },
                ].map((s, i) => (
                  <div key={i} className="cdb-stat" style={{ '--accent-line': s.color }}>
                    <div className="cdb-stat-label">{s.label}</div>
                    <div className="cdb-stat-value">{s.value}</div>
                  </div>
                ))}
              </div>

              <div className="cdb-card">
                <div className="table-scroll">
                  <table className="cdb-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Shareholder</th>
                        <th>Holdings</th>
                        <th className="r">Total Shares</th>
                        <th className="r">Portfolio %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {traders.length === 0 && (
                        <tr><td colSpan={5}><div className="cdb-empty">No traders yet — no shares have been purchased.</div></td></tr>
                      )}
                      {traders.map((t, i) => {
                        const pct = totalSharesHeld > 0 ? (t.total / totalSharesHeld) * 100 : 0
                        const color = PALETTE[i % PALETTE.length]
                        return (
                          <tr key={t.userId}>
                            <td style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 11.5 }}>{String(i + 1).padStart(2, '0')}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div className="cdb-avatar" style={{ background: color }}>
                                  {t.username.charAt(0).toUpperCase()}
                                </div>
                                <span style={{ fontWeight: 600 }}>{t.username}</span>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                {t.holdings.map(h => (
                                  <span key={h.ticker} className="cdb-chip">
                                    <span className="cdb-ticker" style={{ fontSize: 10, padding: '1px 5px' }}>{h.ticker}</span>
                                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, fontWeight: 700 }}>{h.quantity.toLocaleString()}</span>
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="r mono" style={{ fontWeight: 700, color: 'var(--text)' }}>{t.total.toLocaleString()}</td>
                            <td className="r">
                              <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color, fontWeight: 600 }}>{pct.toFixed(1)}%</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════ SETTINGS ════════════════════════════ */}
          {activeTab === 'Settings' && (
            <div className="fade-in">
              <div className="cdb-section-head">
                <div className="cdb-section-title">Company Profile</div>
                {!profile && (
                  <span style={{ fontSize: 11.5, background: 'var(--amber-lt)', color: 'var(--amber)', border: '1px solid #fcd34d', borderRadius: 6, padding: '4px 11px', fontFamily: 'var(--mono)', fontWeight: 600 }}>
                    NOT CONFIGURED
                  </span>
                )}
              </div>

              {profileMsg && (
                <div className={`cdb-alert ${profileMsg.type === 'success' ? 'ok' : 'err'}`} style={{ marginBottom: 20 }}>
                  {profileMsg.text}
                </div>
              )}

              <div className="cdb-card">
                <div className="cdb-card-head">
                  <span className="cdb-card-title">{profile ? `🏢 ${profile.companyName}` : 'New Company Profile'}</span>
                </div>
                <div className="cdb-card-body">
                  <form onSubmit={saveProfile}>
                    <div className="cdb-form-grid2" style={{ marginBottom: 20 }}>
                      <div>
                        <label className="cdb-label">Company Name <span>Required</span></label>
                        <input className="cdb-input" placeholder="e.g. Acme Corporation"
                          value={profileForm.companyName}
                          onChange={e => setProfileForm(f => ({ ...f, companyName: e.target.value }))} required />
                      </div>
                      <div>
                        <label className="cdb-label">Contact Email</label>
                        <input className="cdb-input" type="email" placeholder="contact@company.com"
                          value={profileForm.contactEmail || ''}
                          onChange={e => setProfileForm(f => ({ ...f, contactEmail: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ marginBottom: 20 }}>
                      <label className="cdb-label">Description</label>
                      <textarea className="cdb-input" rows={4} placeholder="Describe your company, its purpose, and what it does…"
                        value={profileForm.description || ''}
                        onChange={e => setProfileForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                    <div style={{ marginBottom: 28 }}>
                      <label className="cdb-label">Website</label>
                      <input className="cdb-input" placeholder="https://example.com"
                        value={profileForm.website || ''}
                        onChange={e => setProfileForm(f => ({ ...f, website: e.target.value }))} />
                    </div>
                    <button type="submit" className="cdb-btn-primary" disabled={profileLoading}>
                      {profileLoading ? 'Saving…' : profile ? '✓ Save Changes' : 'Create Profile'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}