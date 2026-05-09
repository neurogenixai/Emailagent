import React, { useState, useEffect } from 'react'
import api from '../api/client'
import { Plus, Trash2, Power } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Mailboxes() {
  const [mailboxes, setMailboxes] = useState([])

  const fetchMB = () => api.get('/mailboxes').then(res => setMailboxes(res.data)).catch()
  useEffect(() => { fetchMB() }, [])

  const connectGoogle = async () => {
    try {
      const res = await api.get('/mailboxes/oauth/google-url')
      window.location.href = res.data.url
    } catch { toast.error('OAuth configuration missing') }
  }

  const toggle = async (id) => {
    try {
      await api.patch(`/mailboxes/${id}/toggle`)
      fetchMB()
    } catch {}
  }

  const remove = async (id) => {
    if(!confirm('Remove this mailbox?')) return
    try {
      await api.delete(`/mailboxes/${id}`)
      fetchMB()
    } catch {}
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Sending Mailboxes</h1>
          <p className="text-text-secondary text-sm mt-1">Connect Gmail accounts via OAuth.</p>
        </div>
        <button className="btn-primary" onClick={connectGoogle}>
          <Plus size={18}/> Connect Gmail
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mailboxes.map(m => (
          <div key={m.id} className={`glass-card p-5 border-t-4 ${m.is_active ? 'border-t-green' : 'border-t-text-muted'}`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="font-bold text-white">{m.display_name}</p>
                <p className="text-xs text-text-secondary">{m.email}</p>
              </div>
              {m.is_active ? <span className="badge-active">Active</span> : <span className="badge-draft">Paused</span>}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-bg-elevated p-2 rounded-lg text-center border border-border">
                <p className="text-[10px] text-text-muted uppercase font-bold">Sent Today</p>
                <p className="text-lg font-bold text-white">{m.daily_sent_count}</p>
              </div>
              <div className="bg-bg-elevated p-2 rounded-lg text-center border border-border">
                <p className="text-[10px] text-text-muted uppercase font-bold">Total Sent</p>
                <p className="text-lg font-bold text-white">{m.total_sent}</p>
              </div>
              <div className="bg-bg-elevated p-2 rounded-lg text-center border border-border">
                <p className="text-[10px] text-text-muted uppercase font-bold">Reply Rate</p>
                <p className="text-lg font-bold text-green">{m.reply_rate}%</p>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-border">
              <button className="btn-secondary flex-1 py-1.5" onClick={() => toggle(m.id)}>
                <Power size={14} className={m.is_active ? 'text-text-muted' : 'text-green'} /> 
                {m.is_active ? 'Pause' : 'Activate'}
              </button>
              <button className="btn-ghost text-red-400 hover:bg-red-500/10" onClick={() => remove(m.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
