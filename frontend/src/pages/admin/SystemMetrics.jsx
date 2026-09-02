import { useState, useEffect, useMemo } from 'react'
import { adminApi } from '../../api/services'
import { Spinner, ErrorAlert } from '../../components/ui'

function RefreshIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3" />
    </svg>
  )
}

// Glow Green Pulse animation style
const pulseStyle = `
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 4px rgba(16, 185, 129, 0.4); transform: scale(1); }
  50% { box-shadow: 0 0 12px rgba(16, 185, 129, 0.8); transform: scale(1.08); }
}
.pulse-badge {
  animation: pulse-glow 2s infinite ease-in-out;
}
`

function formatUptime(secs) {
  if (!secs) return '0s'
  const d = Math.floor(secs / (3600 * 24))
  const h = Math.floor((secs % (3600 * 24)) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  
  const parts = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m}m`)
  parts.push(`${s}s`)
  return parts.join(' ')
}

export default function SystemMetrics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [pollingActive, setPollingActive] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [methodFilter, setMethodFilter] = useState('ALL')

  const fetchMetrics = async (isSilent = false) => {
    if (!isSilent) setError('')
    else setRefreshing(true)
    try {
      const res = await adminApi.getSystemMetrics()
      setData(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to retrieve system metrics.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Polling hook
  useEffect(() => {
    fetchMetrics()
    if (!pollingActive) return
    const interval = setInterval(() => {
      fetchMetrics(true)
    }, 3000) // Poll every 3 seconds for real-time feel!
    return () => clearInterval(interval)
  }, [pollingActive])

  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear the HTTP request logs history?')) return
    try {
      await adminApi.clearTrafficLogs()
      fetchMetrics(true)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to clear logs.')
    }
  }

  // Filter logs
  const filteredLogs = useMemo(() => {
    if (!data?.traffic?.logs) return []
    return data.traffic.logs.filter(log => {
      const matchSearch = log.path.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.client_ip.includes(searchQuery)
      const matchMethod = methodFilter === 'ALL' || log.method === methodFilter
      return matchSearch && matchMethod
    })
  }, [data, searchQuery, methodFilter])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Spinner size="lg" />
        <p className="text-sm font-medium text-slate-500">Connecting to system telemetry agent...</p>
      </div>
    )
  }

  const { performance, traffic } = data || {}

  // Calculate stats for logs currently in view
  const recentLogs = traffic?.logs || []
  const latencyPoints = recentLogs.slice(0, 30).map(l => l.process_time_ms).reverse()
  const maxLatency = Math.max(...latencyPoints, 50)

  return (
    <div className="space-y-6">
      <style>{pulseStyle}</style>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">System Performance & Traffic</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100 pulse-badge">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              ONLINE
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time server resource usage monitoring and request logging telemetry.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
          <button
            onClick={() => setPollingActive(p => !p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              pollingActive 
                ? 'bg-amber-50 text-amber-700 border-amber-250 hover:bg-amber-100' 
                : 'bg-emerald-50 text-emerald-750 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            {pollingActive ? 'Pause Polling' : 'Resume Polling'}
          </button>
          
          <button
            onClick={() => fetchMetrics(true)}
            disabled={refreshing}
            className="p-2 border border-slate-200 hover:border-slate-350 text-slate-500 hover:text-slate-800 bg-white rounded-lg transition-colors disabled:opacity-50"
            title="Refresh statistics"
          >
            <RefreshIcon className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleClearLogs}
            className="px-3 py-1.5 bg-red-50 text-red-650 border border-red-200 hover:bg-red-100 rounded-lg text-xs font-bold transition-all"
          >
            Clear Log Feed
          </button>
        </div>
      </div>

      <ErrorAlert message={error} />

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* CPU Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between group hover:border-primary-400 transition-all duration-300">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">CPU Utilization</span>
            <p className="text-2xl font-black text-slate-850">{performance.cpu_usage}%</p>
            <p className="text-[10px] text-slate-400">System load average</p>
          </div>
          {/* SVG Circular Meter */}
          <div className="relative w-14 h-14 shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="28" cy="28" r="22" stroke="#f1f5f9" strokeWidth="4.5" fill="transparent" />
              <circle cx="28" cy="28" r="22" stroke="url(#cpuGrad)" strokeWidth="4.5" fill="transparent" 
                      strokeDasharray={2 * Math.PI * 22} 
                      strokeDashoffset={2 * Math.PI * 22 * (1 - performance.cpu_usage / 100)} 
                      strokeLinecap="round" />
              <defs>
                <linearGradient id="cpuGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4f46e5" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Memory Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between group hover:border-primary-400 transition-all duration-300">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Memory Allocation</span>
            <p className="text-2xl font-black text-slate-850">{performance.memory_usage}%</p>
            <p className="text-[10px] text-slate-400">{performance.used_memory_gb}GB / {performance.total_memory_gb}GB</p>
          </div>
          {/* SVG Circular Meter */}
          <div className="relative w-14 h-14 shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="28" cy="28" r="22" stroke="#f1f5f9" strokeWidth="4.5" fill="transparent" />
              <circle cx="28" cy="28" r="22" stroke="url(#memGrad)" strokeWidth="4.5" fill="transparent" 
                      strokeDasharray={2 * Math.PI * 22} 
                      strokeDashoffset={2 * Math.PI * 22 * (1 - performance.memory_usage / 100)} 
                      strokeLinecap="round" />
              <defs>
                <linearGradient id="memGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ec4899" />
                  <stop offset="100%" stopColor="#f472b6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-5 h-5 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
        </div>

        {/* Database Connections */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between group hover:border-primary-400 transition-all duration-300">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Database pool</span>
            <p className="text-2xl font-black text-slate-850">{performance.db_connections}</p>
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              Status: 
              <span className={`font-bold ${performance.db_status === 'healthy' ? 'text-emerald-600' : 'text-rose-500'}`}>
                {performance.db_status === 'healthy' ? 'Healthy' : 'Unreachable'}
              </span>
            </p>
          </div>
          {/* Icon */}
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.58 4 8 4s8-1.79 8-4M4 7c0-2.21 3.58-4 8-4s8 1.79 8 4m0 5c0 2.21-3.58 4-8 4s-8-1.79-8-4" />
            </svg>
          </div>
        </div>

        {/* Uptime Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between group hover:border-primary-400 transition-all duration-300">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Process Uptime</span>
            <p className="text-2xl font-black text-slate-850">{formatUptime(performance.uptime_seconds)}</p>
            <p className="text-[10px] text-slate-400">Since last backend reload</p>
          </div>
          {/* Icon */}
          <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

      </div>

      {/* Traffic Metrics Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Latency History Chart */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Request Latency Telemetry</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Response times (ms) of the last 30 requests</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-450">Average</span>
              <p className="text-lg font-black text-primary-600">{traffic.avg_latency_ms} ms</p>
            </div>
          </div>

          {/* SVG Latency Chart */}
          <div className="w-full h-40 bg-slate-50 rounded-2xl border border-slate-200 relative overflow-hidden flex items-end p-2">
            {/* Oscilloscope Grid Lines */}
            <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 opacity-40 pointer-events-none">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="border-t border-l border-slate-200"></div>
              ))}
            </div>

            {latencyPoints.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-450">
                Awaiting incoming network traffic...
              </div>
            ) : (
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Latency Graph Path */}
                <path
                  d={`M ${latencyPoints.map((val, idx) => {
                    const x = (idx / (latencyPoints.length - 1)) * 100
                    const y = 90 - (val / maxLatency) * 80
                    return `${x} ${y}`
                  }).join(' L ')}`}
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                
                {/* Glow behind line */}
                <path
                  d={`M 0 100 L ${latencyPoints.map((val, idx) => {
                    const x = (idx / (latencyPoints.length - 1)) * 100
                    const y = 90 - (val / maxLatency) * 80
                    return `${x} ${y}`
                  }).join(' L ')} L 100 100 Z`}
                  fill="url(#latencyGlow)"
                  opacity="0.15"
                />
                
                <defs>
                  <linearGradient id="latencyGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#4f46e5" />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            )}
          </div>
        </div>

        {/* Status Codes Distribution */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-5">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Traffic Log Breakdown</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">HTTP status distribution (since server launch)</p>
          </div>

          <div className="space-y-4">
            {/* Status counts progress bars */}
            {[
              { key: '2xx', label: '2xx Successful', color: 'bg-emerald-500', textClass: 'text-emerald-600', count: traffic.status_counts['2xx'] || 0 },
              { key: '3xx', label: '3xx Redirection', color: 'bg-sky-500', textClass: 'text-sky-600', count: traffic.status_counts['3xx'] || 0 },
              { key: '4xx', label: '4xx Client Errors', color: 'bg-amber-500', textClass: 'text-amber-600', count: traffic.status_counts['4xx'] || 0 },
              { key: '5xx', label: '5xx Server Errors', color: 'bg-rose-500', textClass: 'text-rose-600', count: traffic.status_counts['5xx'] || 0 },
            ].map(item => {
              const pct = traffic.total_requests > 0 ? (item.count / traffic.total_requests) * 100 : 0
              return (
                <div key={item.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-650">{item.label}</span>
                    <span className={`${item.textClass} font-bold`}>{item.count} ({roundPct(pct)}%)</span>
                  </div>
                  <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden border border-slate-100/50">
                    <div className={`${item.color} h-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-slate-400">
            <span>Total Requests Tracked</span>
            <span className="font-bold text-slate-700 text-sm">{traffic.total_requests}</span>
          </div>
        </div>

      </div>

      {/* Log Feed Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        
        {/* Table Filters */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">HTTP request log feed</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Telemetry captured live from requests pool</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search route or IP..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="tt-input py-1.5 px-3 text-xs w-48"
            />
            {/* Method Select */}
            <select
              value={methodFilter}
              onChange={e => setMethodFilter(e.target.value)}
              className="tt-select py-1.5 px-3 text-xs"
            >
              <option value="ALL">All Methods</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>
        </div>

        {/* Table Grid */}
        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full border-collapse" style={{ minWidth: '600px' }}>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-450 uppercase tracking-wider">Method</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-450 uppercase tracking-wider">Route Path</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-450 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-450 uppercase tracking-wider">Client IP</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold text-slate-450 uppercase tracking-wider">Latency</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold text-slate-450 uppercase tracking-wider">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-xs text-slate-400">
                    No requests captured matching current search criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const statusColor = getStatusBadgeColor(log.status_code)
                  const methodColor = getMethodBadgeColor(log.method)
                  return (
                    <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold ${methodColor}`}>
                          {log.method}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs font-semibold text-slate-700 max-w-xs truncate" title={log.path}>
                        {log.path}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${statusColor}`}>
                          {log.status_code}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 font-mono whitespace-nowrap">
                        {log.client_ip}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <span className={`text-xs font-bold ${log.process_time_ms > 450 ? 'text-amber-500' : 'text-slate-650'}`}>
                          {log.process_time_ms} ms
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-slate-400 whitespace-nowrap">
                        {new Date(log.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  )
}

function roundPct(val) {
  return Math.round(val * 10) / 10
}

function getStatusBadgeColor(code) {
  if (code >= 200 && code < 300) return 'bg-emerald-50 text-emerald-700 border border-emerald-100'
  if (code >= 300 && code < 400) return 'bg-sky-50 text-sky-700 border border-sky-100'
  if (code >= 400 && code < 500) return 'bg-amber-50 text-amber-700 border border-amber-100'
  return 'bg-rose-50 text-rose-700 border border-rose-100'
}

function getMethodBadgeColor(method) {
  const colors = {
    GET: 'bg-emerald-100 text-emerald-800',
    POST: 'bg-indigo-100 text-indigo-800',
    PUT: 'bg-amber-100 text-amber-800',
    DELETE: 'bg-rose-100 text-rose-800',
    PATCH: 'bg-pink-100 text-pink-850',
  }
  return colors[method] || 'bg-slate-100 text-slate-700'
}
