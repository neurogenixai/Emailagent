import React, { useState, useEffect } from 'react'
import api from '../api/client'
import { Search, ChevronDown, ChevronRight, Mail, Eye, MessageSquare, AlertTriangle, Clock, CheckCircle, XCircle, SkipForward } from 'lucide-react'

const STATUS_CONFIG = {
  new:           { color: 'text-text-muted',    bg: 'bg-white/5',        label: 'New' },
  contacted:     { color: 'text-blue-400',       bg: 'bg-blue-400/10',    label: 'Contacted' },
  replied:       { color: 'text-green-400',      bg: 'bg-green-400/10',   label: 'Replied ✅' },
  bounced:       { color: 'text-red-400',        bg: 'bg-red-400/10',     label: 'Bounced ⛔' },
  unsubscribed:  { color: 'text-orange-400',     bg: 'bg-orange-400/10',  label: 'Unsubscribed' },
}

const STEP_STATUS_CONFIG = {
  pending:  { icon: <Clock size={12}/>,        color: 'text-text-muted',  label: 'Scheduled' },
  sent:     { icon: <CheckCircle size={12}/>,   color: 'text-blue-400',    label: 'Sent' },
  skipped:  { icon: <SkipForward size={12}/>,   color: 'text-text-muted',  label: 'Skipped' },
  failed:   { icon: <XCircle size={12}/>,       color: 'text-red-400',     label: 'Failed' },
}

function fmt(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
}

function LeadRow({ lead }) {
  const [expanded, setExpanded] = useState(false)
  const status = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Name */}
        <td>
          <div className="flex items-center gap-2">
            <span className="text-text-muted">{expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</span>
            <div>
              <div className="font-medium text-white text-sm">{lead.full_name}</div>
              <div className="text-text-muted text-xs">{lead.email}</div>
            </div>
          </div>
        </td>

        {/* Company */}
        <td>
          <div className="text-sm text-white">{lead.company_name}</div>
          <div className="text-xs text-text-muted">{lead.job_title}</div>
        </td>

        {/* Overall Status */}
        <td>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${status.color} ${status.bg}`}>
            {status.label}
          </span>
        </td>

        {/* Opened */}
        <td>
          {lead.opened ? (
            <div className="flex flex-col">
              <span className="flex items-center gap-1 text-green-400 text-xs font-semibold">
                <Eye size={12}/> Yes ({lead.open_count}x)
              </span>
              <span className="text-text-muted text-[10px]">{fmt(lead.opened_at)}</span>
            </div>
          ) : (
            <span className="text-text-muted text-xs">Not opened</span>
          )}
        </td>

        {/* Replied */}
        <td>
          {lead.replied ? (
            <div className="flex flex-col">
              <span className="flex items-center gap-1 text-green-400 text-xs font-semibold">
                <MessageSquare size={12}/> Replied
              </span>
              <span className="text-text-muted text-[10px]">{fmt(lead.replied_at)}</span>
            </div>
          ) : (
            <span className="text-text-muted text-xs">—</span>
          )}
        </td>

        {/* Bounced */}
        <td>
          {lead.bounced ? (
            <div className="flex flex-col">
              <span className="flex items-center gap-1 text-red-400 text-xs font-semibold">
                <AlertTriangle size={12}/> Bounced
              </span>
              <span className="text-text-muted text-[10px]">{fmt(lead.bounced_at)}</span>
            </div>
          ) : (
            <span className="text-text-muted text-xs">—</span>
          )}
        </td>

        {/* Added */}
        <td className="text-xs text-text-muted">{fmtDate(lead.created_at)}</td>
      </tr>

      {/* Expanded: per-step breakdown */}
      {expanded && (
        <tr className="bg-bg-dark/50">
          <td colSpan={7} className="px-6 py-4">
            <div className="space-y-2">
              <p className="text-xs font-bold text-text-secondary uppercase mb-3">Email Sequence Breakdown</p>
              {lead.steps.length === 0 && (
                <p className="text-text-muted text-xs">No emails scheduled yet.</p>
              )}
              {lead.steps.map((step, i) => {
                const sc = STEP_STATUS_CONFIG[step.status] || STEP_STATUS_CONFIG.pending
                return (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-bg-elevated border border-border">
                    <span className="w-20 text-xs font-bold text-orange">{step.label}</span>
                    <span className={`flex items-center gap-1 text-xs font-semibold ${sc.color}`}>
                      {sc.icon} {sc.label}
                    </span>
                    {step.status === 'sent' && (
                      <>
                        <span className="text-text-muted text-xs">Sent: <span className="text-white">{fmt(step.sent_at)}</span></span>
                        {step.from_mailbox && (
                          <span className="text-text-muted text-xs">From: <span className="text-white">{step.from_mailbox}</span></span>
                        )}
                      </>
                    )}
                    {step.status === 'pending' && step.scheduled_at && (
                      <span className="text-text-muted text-xs">
                        Scheduled: <span className="text-white">{fmt(step.scheduled_at)}</span>
                      </span>
                    )}
                    {step.status === 'failed' && (
                      <span className="text-red-400 text-xs">{step.failed_reason || 'Send failed'}</span>
                    )}
                    {step.status === 'skipped' && (
                      <span className="text-text-muted text-xs">Skipped — lead replied or bounced</span>
                    )}
                  </div>
                )
              })}
              {lead.bounce_reason && (
                <div className="mt-2 p-3 rounded-xl bg-red-400/5 border border-red-400/20">
                  <p className="text-xs text-red-400 font-semibold mb-1">⛔ Bounce Reason:</p>
                  <p className="text-xs text-text-muted">{lead.bounce_reason}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function Leads() {
  const [leads, setLeads] = useState([])
  const [search, setSearch] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, opened: 0, replied: 0, bounced: 0 })

  const load = (cid, s) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (cid) params.set('campaign_id', cid)
    if (s) params.set('search', s)
    api.get(`/leads/activity/all?${params.toString()}`)
      .then(res => {
        const data = res.data.leads || []
        setLeads(data)
        setStats({
          total: data.length,
          opened: data.filter(l => l.opened).length,
          replied: data.filter(l => l.replied).length,
          bounced: data.filter(l => l.bounced).length,
        })
      })
      .catch(() => setLeads([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    api.get('/campaigns').then(res => setCampaigns(res.data)).catch()
    load('', '')
  }, [])

  useEffect(() => {
    const t = setTimeout(() => load(campaignId, search), 400)
    return () => clearTimeout(t)
  }, [search, campaignId])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Contacts & Activity</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            className="input-field py-2 text-sm w-48"
            value={campaignId}
            onChange={e => setCampaignId(e.target.value)}
          >
            <option value="">All Campaigns</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16}/>
            <input
              className="input-field pl-9 py-2 text-sm"
              placeholder="Search name, email..."
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: stats.total, color: 'text-white' },
          { label: 'Opened Email', value: stats.opened, color: 'text-green-400' },
          { label: 'Replied', value: stats.replied, color: 'text-blue-400' },
          { label: 'Bounced', value: stats.bounced, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="glass-card p-4">
            <p className="text-xs text-text-muted uppercase font-semibold">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Contact</th>
              <th>Company</th>
              <th>Status</th>
              <th>Opened</th>
              <th>Replied</th>
              <th>Bounced</th>
              <th>Added</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-text-muted">Loading...</td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-text-muted">No contacts found.</td></tr>
            ) : (
              leads.map(l => <LeadRow key={l.id} lead={l}/>)
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-text-muted text-center">Click any row to see the full email sequence breakdown for that contact.</p>
    </div>
  )
}
