import React, { useState, useEffect } from 'react'
import api from '../api/client'
import {
  Users, CheckCircle2, XCircle, Building2, Mail,
  Phone, Clock, RefreshCw, ToggleLeft, ToggleRight,
  Key, ChevronRight, ArrowLeft, Megaphone, Inbox,
  X, Eye, EyeOff, Shield, BarChart2
} from 'lucide-react'
import toast from 'react-hot-toast'

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const STATUS_COLORS = {
  pending: 'bg-orange/15 text-orange border-orange/20',
  approved: 'bg-green/15 text-green border-green/20',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/20',
}

// ─── Client Detail Drawer ──────────────────────────────────────────────────────
function ClientDetail({ clientId, onBack, onPasswordChange }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showPwModal, setShowPwModal] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwResult, setPwResult] = useState(null)

  useEffect(() => {
    api.get(`/admin/clients/${clientId}`)
      .then(r => setDetail(r.data))
      .catch(() => toast.error('Failed to load client details'))
      .finally(() => setLoading(false))
  }, [clientId])

  const handleToggle = async () => {
    try {
      const res = await api.patch(`/admin/clients/${clientId}/toggle`)
      setDetail(d => ({ ...d, is_active: res.data.is_active }))
      toast.success(res.data.is_active ? 'Client activated' : 'Client deactivated')
    } catch { toast.error('Failed to toggle') }
  }

  const handlePasswordSave = async () => {
    setPwLoading(true)
    try {
      const res = await api.post(`/admin/clients/${clientId}/reset-password`, { new_password: newPw || null })
      setPwResult(res.data.temp_password)
      onPasswordChange && onPasswordChange()
    } catch { toast.error('Failed to reset password') }
    finally { setPwLoading(false) }
  }

  if (loading) return <div className="text-center text-text-muted py-20">Loading client details…</div>
  if (!detail) return null

  const statusBadge = (s) => {
    const map = { active: 'badge-active', draft: 'badge-draft', paused: 'badge-paused', completed: 'badge-paused' }
    return <span className={map[s] || 'badge-draft'}>{s}</span>
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back + Header */}
      <div className="flex items-start gap-4">
        <button onClick={onBack} className="mt-1 p-2 rounded-lg bg-bg-elevated hover:bg-orange/10 text-text-muted hover:text-orange transition-colors flex-shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange/30 to-orange-dark/30 border border-orange/20 flex items-center justify-center text-orange font-bold text-lg">
              {(detail.full_name || detail.email)[0].toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{detail.full_name}</h2>
              <p className="text-text-muted text-sm">{detail.email}</p>
            </div>
            {detail.company_name && (
              <span className="flex items-center gap-1 text-xs text-text-secondary bg-bg-elevated px-2 py-1 rounded-lg border border-border">
                <Building2 size={12} /> {detail.company_name}
              </span>
            )}
            <span className={`text-xs px-2 py-1 rounded-full border font-semibold ${detail.is_active ? 'bg-green/10 text-green border-green/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
              {detail.is_active ? 'Active' : 'Disabled'}
            </span>
          </div>
        </div>
        {/* Admin Actions */}
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={handleToggle}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${detail.is_active ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' : 'bg-green/10 text-green border-green/20 hover:bg-green/20'}`}>
            {detail.is_active ? <ToggleLeft size={15} /> : <ToggleRight size={15} />}
            {detail.is_active ? 'Disable' : 'Enable'}
          </button>
          <button onClick={() => { setShowPwModal(true); setPwResult(null); setNewPw('') }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-blue-accent/10 text-blue-accent border border-blue-accent/20 hover:bg-blue-accent/20 transition-colors">
            <Key size={15} /> Change Password
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Campaigns', value: detail.total_campaigns, icon: Megaphone, color: 'text-orange' },
          { label: 'Active Campaigns', value: detail.active_campaigns, icon: BarChart2, color: 'text-green' },
          { label: 'Total Leads', value: detail.total_leads, icon: Users, color: 'text-blue-accent' },
          { label: 'Mailboxes', value: detail.total_mailboxes, icon: Mail, color: 'text-text-secondary' },
        ].map(s => (
          <div key={s.label} className="glass-card p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-bg-elevated ${s.color}`}><s.icon size={18} /></div>
            <div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-text-muted text-xs">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Campaigns Table */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Megaphone size={16} className="text-orange" />
          <h3 className="font-semibold text-white text-sm">Campaigns</h3>
          <span className="ml-auto text-xs text-text-muted">{detail.campaigns.length} total</span>
        </div>
        {detail.campaigns.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm">No campaigns yet.</div>
        ) : (
          <table className="data-table w-full">
            <thead><tr><th>Campaign</th><th>Status</th><th>Leads</th><th>Replies</th><th>Reply Rate</th><th>Created</th></tr></thead>
            <tbody>
              {detail.campaigns.map(c => (
                <tr key={c.id}>
                  <td className="font-semibold text-white">{c.name}</td>
                  <td>{statusBadge(c.status)}</td>
                  <td className="text-white">{c.total_leads}</td>
                  <td className="text-white">{c.replied}</td>
                  <td className={c.reply_rate > 0 ? 'text-green font-semibold' : 'text-text-muted'}>{c.reply_rate}%</td>
                  <td className="text-text-muted text-xs">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Mailboxes */}
      {detail.mailboxes.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Mail size={16} className="text-blue-accent" />
            <h3 className="font-semibold text-white text-sm">Connected Mailboxes</h3>
          </div>
          <table className="data-table w-full">
            <thead><tr><th>Email</th><th>Status</th><th>Emails Sent</th></tr></thead>
            <tbody>
              {detail.mailboxes.map(m => (
                <tr key={m.email}>
                  <td className="text-white">{m.email}</td>
                  <td><span className={m.is_active ? 'badge-active' : 'badge-paused'}>{m.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="text-white font-semibold">{m.total_sent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Password Change Modal */}
      {showPwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card p-8 rounded-2xl border border-white/10 w-full max-w-sm relative shadow-2xl animate-fade-in">
            <button onClick={() => setShowPwModal(false)} className="absolute top-4 right-4 text-text-muted hover:text-white transition-colors">
              <X size={18} />
            </button>

            {pwResult ? (
              <div className="text-center py-2">
                <div className="w-12 h-12 rounded-full bg-green/15 border border-green/30 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="text-green" size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Password Updated</h3>
                <p className="text-text-muted text-sm mb-4">Share this with the client:</p>
                <div className="flex items-center gap-2 bg-green/10 border border-green/20 rounded-xl px-4 py-3 justify-center">
                  <Key size={14} className="text-green flex-shrink-0" />
                  <span className="text-green font-mono font-bold text-lg tracking-wider">{pwResult}</span>
                </div>
                <button onClick={() => setShowPwModal(false)} className="mt-5 btn-primary w-full justify-center">Done</button>
              </div>
            ) : (
              <>
                <div className="mb-5">
                  <h3 className="text-lg font-bold text-white mb-1">Change Password</h3>
                  <p className="text-text-muted text-sm">For <span className="text-white font-medium">{detail.email}</span></p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold uppercase text-text-muted tracking-wider mb-1.5 block">New Password</label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={15} />
                      <input
                        type={showPw ? 'text' : 'password'}
                        className="input-field"
                        style={{ paddingLeft: 34, paddingRight: 34 }}
                        placeholder="Leave blank to auto-generate"
                        value={newPw}
                        onChange={e => setNewPw(e.target.value)}
                      />
                      <button type="button" onClick={() => setShowPw(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors">
                        {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <p className="text-xs text-text-muted mt-1">Leave blank to auto-generate a secure password.</p>
                  </div>
                  <button onClick={handlePasswordSave} disabled={pwLoading}
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-orange to-orange-dark text-white font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(255,107,53,0.3)] hover:shadow-[0_0_30px_rgba(255,107,53,0.5)] active:scale-[0.98]">
                    {pwLoading ? 'Saving…' : 'Set Password'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


// ─── Main Clients Page ─────────────────────────────────────────────────────────
export default function Clients() {
  const [tab, setTab] = useState('pending')
  const [requests, setRequests] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [tempPasswords, setTempPasswords] = useState({})
  const [selectedClientId, setSelectedClientId] = useState(null)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [reqRes, clientRes] = await Promise.all([
        api.get('/admin/access-requests'),
        api.get('/admin/clients'),
      ])
      setRequests(reqRes.data)
      setClients(clientRes.data)
    } catch { toast.error('Failed to load data') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  const approve = async (id) => {
    try {
      const res = await api.post(`/admin/access-requests/${id}/approve`)
      toast.success(`✅ Account created for ${res.data.email}`)
      if (res.data.temp_password) {
        setTempPasswords(p => ({ ...p, [id]: res.data.temp_password }))
      }
      fetchAll()
      setTab('clients') // Switch to clients tab after approval
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to approve') }
  }

  const reject = async (id) => {
    try {
      await api.post(`/admin/access-requests/${id}/reject`)
      toast.success('Request rejected')
      fetchAll()
    } catch { toast.error('Failed to reject') }
  }

  // If a client is selected, show their detail view
  if (selectedClientId) {
    return (
      <ClientDetail
        clientId={selectedClientId}
        onBack={() => setSelectedClientId(null)}
        onPasswordChange={fetchAll}
      />
    )
  }

  const pendingRequests = requests.filter(r => r.status === 'pending')
  const reviewedRequests = requests.filter(r => r.status !== 'pending')

  const TabButton = ({ id, label, count }) => (
    <button
      onClick={() => setTab(id)}
      className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors border-b-2 -mb-px flex items-center gap-2 ${
        tab === id ? 'border-orange text-orange bg-orange/5' : 'border-transparent text-text-muted hover:text-white'
      }`}
    >
      {label}
      {count > 0 && <span className="px-1.5 py-0.5 rounded-full text-xs bg-orange text-white font-bold">{count}</span>}
    </button>
  )

  const RequestCard = ({ r }) => (
    <div className="glass-card p-5 flex flex-col lg:flex-row lg:items-start gap-4">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange/30 to-orange-dark/30 border border-orange/20 flex items-center justify-center text-orange font-bold text-sm flex-shrink-0">
            {r.full_name[0].toUpperCase()}
          </div>
          <p className="font-bold text-white">{r.full_name}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${STATUS_COLORS[r.status]}`}>{r.status}</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-text-secondary flex-wrap pl-10">
          <span className="flex items-center gap-1"><Mail size={12}/> {r.email}</span>
          {r.company_name && <span className="flex items-center gap-1"><Building2 size={12}/> {r.company_name}</span>}
          {r.phone && <span className="flex items-center gap-1"><Phone size={12}/> {r.phone}</span>}
          <span className="flex items-center gap-1 text-text-muted"><Clock size={12}/> {timeAgo(r.created_at)}</span>
        </div>
        {r.use_case && (
          <p className="text-sm text-text-muted mt-2 bg-bg-elevated p-3 rounded-lg border border-border italic ml-10">
            "{r.use_case}"
          </p>
        )}
        {tempPasswords[r.id] && (
          <div className="mt-2 ml-10 flex items-center gap-2 bg-green/10 border border-green/20 rounded-lg px-3 py-2">
            <Key size={13} className="text-green flex-shrink-0" />
            <span className="text-sm text-green font-mono font-bold">{tempPasswords[r.id]}</span>
            <span className="text-xs text-green/70 ml-1">— share with client!</span>
          </div>
        )}
      </div>
      {r.status === 'pending' && (
        <div className="flex gap-2 flex-shrink-0 pl-10 lg:pl-0">
          <button onClick={() => approve(r.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green/10 text-green border border-green/20 hover:bg-green/20 font-semibold text-sm transition-colors">
            <CheckCircle2 size={15}/> Approve
          </button>
          <button onClick={() => reject(r.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 font-semibold text-sm transition-colors">
            <XCircle size={15}/> Reject
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="text-orange" size={24} /> Client Portal
          </h1>
          <p className="text-text-secondary text-sm mt-1">Manage access requests and oversee client accounts.</p>
        </div>
        <button onClick={fetchAll} className="p-2 rounded-lg bg-bg-elevated hover:bg-orange/10 text-text-muted hover:text-orange transition-colors" title="Refresh">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pending Requests', value: pendingRequests.length, color: pendingRequests.length > 0 ? 'text-orange' : 'text-text-muted' },
          { label: 'Approved', value: requests.filter(r => r.status === 'approved').length, color: 'text-green' },
          { label: 'Active Clients', value: clients.filter(c => c.is_active).length, color: 'text-blue-accent' },
          { label: 'Rejected', value: requests.filter(r => r.status === 'rejected').length, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="glass-card stat-card">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-text-muted text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <TabButton id="pending" label="Pending Requests" count={pendingRequests.length} />
        <TabButton id="reviewed" label={`Reviewed (${reviewedRequests.length})`} count={0} />
        <TabButton id="clients" label={`Active Clients (${clients.length})`} count={0} />
      </div>

      {/* Pending Requests */}
      {tab === 'pending' && (
        <div className="space-y-3">
          {loading ? <div className="text-center text-text-muted py-12">Loading…</div>
          : pendingRequests.length === 0 ? (
            <div className="glass-card p-12 text-center text-text-muted">
              <CheckCircle2 className="mx-auto mb-3 opacity-30 text-green" size={36} />
              <p className="font-semibold">All caught up!</p>
              <p className="text-xs mt-1">No pending access requests.</p>
            </div>
          ) : pendingRequests.map(r => <RequestCard key={r.id} r={r} />)}
        </div>
      )}

      {/* Reviewed Requests */}
      {tab === 'reviewed' && (
        <div className="space-y-3">
          {loading ? <div className="text-center text-text-muted py-12">Loading…</div>
          : reviewedRequests.length === 0 ? (
            <div className="glass-card p-12 text-center text-text-muted">
              <Clock className="mx-auto mb-3 opacity-30" size={36} />
              <p>No reviewed requests yet.</p>
            </div>
          ) : reviewedRequests.map(r => <RequestCard key={r.id} r={r} />)}
        </div>
      )}

      {/* Active Clients */}
      {tab === 'clients' && (
        <div className="glass-card overflow-hidden">
          {loading ? <div className="text-center text-text-muted py-12">Loading…</div>
          : clients.length === 0 ? (
            <div className="p-12 text-center text-text-muted">
              <Users className="mx-auto mb-3 opacity-30" size={36} />
              <p>No client accounts yet.</p>
              <p className="text-xs mt-1">Approve access requests to create them.</p>
            </div>
          ) : (
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Company</th>
                  <th>Campaigns</th>
                  <th>Mailboxes</th>
                  <th>Status</th>
                  <th>View</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id} className="cursor-pointer hover:bg-orange/5 transition-colors" onClick={() => setSelectedClientId(c.id)}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange/30 to-orange-dark/30 border border-orange/20 flex items-center justify-center text-orange font-bold text-xs flex-shrink-0">
                          {(c.full_name || c.email)[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white text-sm">{c.full_name}</p>
                          <p className="text-xs text-text-muted">{c.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-text-secondary text-sm">{c.company_name || '—'}</td>
                    <td className="text-white font-semibold">{c.campaign_count}</td>
                    <td className="text-white font-semibold">{c.mailbox_count}</td>
                    <td>
                      <span className={c.is_active ? 'badge-active' : 'badge-paused'}>
                        {c.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedClientId(c.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange/10 text-orange border border-orange/20 hover:bg-orange/20 font-semibold text-xs transition-colors"
                      >
                        View Dashboard <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
