import React, { useState, useEffect } from 'react'
import api from '../api/client'
import { Megaphone, Mail, Users, AlertTriangle, Activity } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function Dashboard({ data }) {
  const [replies, setReplies] = useState([])

  useEffect(() => {
    api.get('/analytics/recent-replies').then(res => setReplies(res.data)).catch(console.error)
  }, [])

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>
          <p className="text-text-secondary text-sm mt-1">Real-time email agent performance</p>
        </div>
        <Link to="/upload" className="btn-primary">
          Upload New Leads
        </Link>
      </div>

      {data?.bounce_alert && (
        <div className="alert-danger animate-fade-in-delay">
          <AlertTriangle size={20} />
          <span><strong>High Bounce Rate ({data?.bounce_rate}%):</strong> Please check your lead quality or pause active campaigns.</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card stat-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-orange/10 text-orange"><Megaphone size={18} /></div>
            <p className="text-sm font-medium text-text-secondary">Active Campaigns</p>
          </div>
          <p className="text-3xl font-bold text-white">{data?.active_campaigns || 0}</p>
        </div>

        <div className="glass-card stat-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-accent/10 text-blue-accent"><Users size={18} /></div>
            <p className="text-sm font-medium text-text-secondary">Total Leads</p>
          </div>
          <p className="text-3xl font-bold text-white">{data?.total_leads || 0}</p>
        </div>

        <div className="glass-card stat-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-green/10 text-green"><Mail size={18} /></div>
            <p className="text-sm font-medium text-text-secondary">Emails Sent Today</p>
          </div>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-bold text-white">{data?.sent_today || 0}</p>
            <p className="text-xs text-text-muted mb-1">Total: {data?.total_sent || 0}</p>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400"><Activity size={18} /></div>
            <p className="text-sm font-medium text-text-secondary">Performance</p>
          </div>
          <div className="flex flex-col mt-2">
            <div className="flex items-end gap-2 mb-2">
              <p className="text-2xl font-bold text-white">{data?.reply_rate || 0}%</p>
              <p className="text-xs text-text-muted mb-1">Reply Rate</p>
            </div>
            <div className="flex items-center gap-4 border-t border-white/5 pt-2">
              <p className="text-xs text-text-muted flex items-center gap-1">
                Open Rate: <span className="text-white font-medium">{data?.open_rate || 0}%</span>
              </p>
              <p className="text-xs text-text-muted flex items-center gap-1">
                Bounce Rate: <span className="text-red-400 font-medium">{data?.bounce_rate || 0}%</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Connection Status */}
        <div className="glass-card p-5 lg:col-span-1">
          <h2 className="text-lg font-bold text-white mb-4">System Status</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-bg-elevated border border-border">
              <div>
                <p className="text-sm text-white font-medium">Mailboxes Ready</p>
                <p className="text-xs text-text-muted mt-0.5">{data?.mailboxes_connected || 0} active</p>
              </div>
              <span className="badge-active">Online</span>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-xl bg-bg-elevated border border-border">
              <div>
                <p className="text-sm text-white font-medium">Approval Queue</p>
                <p className="text-xs text-text-muted mt-0.5">Awaiting human review</p>
              </div>
              {data?.pending_approvals > 0 ? (
                <span className="badge-paused">{data?.pending_approvals} pending</span>
              ) : (
                <span className="badge-active">0 pending</span>
              )}
            </div>
          </div>
        </div>

        {/* Live Feed */}
        <div className="glass-card p-5 lg:col-span-2 flex flex-col h-full">
          <h2 className="text-lg font-bold text-white mb-4">Recent Replies Feed</h2>
          {replies.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-bg-elevated rounded-xl border border-border">
              <Mail className="text-text-muted mb-3" size={32} />
              <p className="text-text-secondary">No replies yet.</p>
              <p className="text-sm text-text-muted">When a lead responds, it will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2">
              {replies.map(reply => (
                <div key={reply.id} className="p-4 rounded-xl bg-bg-elevated border border-border flex items-start gap-4">
                  <div className="mt-1 w-2 h-2 rounded-full bg-green animate-pulse-dot" />
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">
                      {reply.lead_name || reply.lead_email} <span className="text-text-muted font-normal">({reply.lead_company})</span>
                    </p>
                    <p className="text-xs text-text-secondary mt-1">Replied to <strong>{reply.mailbox}</strong></p>
                  </div>
                  <p className="text-xs text-text-muted whitespace-nowrap">
                    {new Date(reply.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
