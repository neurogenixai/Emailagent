import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import { Megaphone, Plus, Play, Pause, RefreshCw, MoreVertical, Settings } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  draft: 'badge-draft',
  active: 'badge-active',
  paused: 'badge-paused',
  completed: 'badge-completed',
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [polling, setPolling] = useState(false)
  const [togglingId, setTogglingId] = useState(null)

  const load = () => {
    api.get('/campaigns').then(res => setCampaigns(res.data)).catch()
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000) // refresh every 15s
    return () => clearInterval(interval)
  }, [])

  const handleCreate = async () => {
    if (!name) return
    try {
      const res = await api.post('/campaigns', { name })
      setCampaigns([res.data, ...campaigns])
      setShowModal(false)
      setName('')
      toast.success('Campaign created!')
    } catch {
      toast.error('Failed to create campaign')
    }
  }

  const toggleStatus = async (c) => {
    const next = c.status === 'active' ? 'paused' : c.status === 'paused' ? 'active' : 'active'
    setTogglingId(c.id)
    try {
      await api.patch(`/campaigns/${c.id}/status`, { status: next })
      setCampaigns(campaigns.map(x => x.id === c.id ? { ...x, status: next } : x))
      toast.success(`Campaign ${next === 'active' ? 'activated' : 'paused'}`)
    } catch {
      toast.error('Failed to update status')
    } finally {
      setTogglingId(null)
    }
  }

  const pollRepliesNow = async () => {
    setPolling(true)
    try {
      await api.post('/replies/poll-now')
      toast.success('Polling for replies... check the Replies tab in 30 seconds!')
      setTimeout(load, 3000)
    } catch {
      toast.error('Could not trigger reply poll')
    } finally {
      setPolling(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Campaigns</h1>
        <div className="flex items-center gap-3">
          <button
            className="btn-secondary text-sm"
            onClick={pollRepliesNow}
            disabled={polling}
          >
            <RefreshCw size={14} className={polling ? 'animate-spin' : ''} />
            {polling ? 'Polling…' : 'Poll Replies Now'}
          </button>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18}/> New Campaign
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Reply Rate</th>
              <th>Date Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map(c => (
              <tr key={c.id}>
                <td className="font-medium">
                  <Link to={`/campaigns/${c.id}`} className="text-white hover:text-green underline decoration-green/30 decoration-2 underline-offset-4 transition-colors">
                    {c.name}
                  </Link>
                </td>
                <td>
                  <span className={`badge-${c.status}`}>{c.status}</span>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-bg-elevated h-2 rounded-full overflow-hidden">
                      <div className="bg-orange h-full rounded-full" style={{width: `${c.progress}%`}} />
                    </div>
                    <span className="text-xs">{c.contacted}/{c.total_leads}</span>
                  </div>
                </td>
                <td className="text-green font-medium">{c.reply_rate}%</td>
                <td>{new Date(c.created_at).toLocaleDateString()}</td>
                <td>
                  <div className="flex items-center gap-2">
                    {/* Activate / Pause toggle */}
                    <button
                      onClick={() => toggleStatus(c)}
                      disabled={togglingId === c.id}
                      title={c.status === 'active' ? 'Pause campaign' : 'Activate campaign'}
                      className={`p-1.5 rounded-lg transition-all ${
                        c.status === 'active'
                          ? 'text-orange hover:bg-orange/10'
                          : 'text-green hover:bg-green/10'
                      }`}
                    >
                      {c.status === 'active'
                        ? <Pause size={15} />
                        : <Play size={15} />
                      }
                    </button>
                    {/* Settings */}
                    <Link
                      to={`/campaigns/${c.id}`}
                      title="Campaign settings"
                      className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-all"
                    >
                      <Settings size={15} />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && (
              <tr><td colSpan="6" className="text-center py-6 text-text-muted">No campaigns yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 w-full max-w-md animate-slide-in">
            <h2 className="text-xl font-bold text-white mb-4">Create Campaign</h2>
            <input
              className="input-field mb-6"
              placeholder="Campaign Name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <div className="flex gap-3 justify-end">
              <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreate}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
