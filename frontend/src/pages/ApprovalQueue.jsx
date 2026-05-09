import React, { useState, useEffect } from 'react'
import api from '../api/client'
import { Check, X, RefreshCw, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ApprovalQueue() {
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editBody, setEditBody] = useState('')

  const fetchQueue = () => {
    setLoading(true)
    api.get('/approval/queue').then(res => {
      setQueue(res.data.items)
      setLoading(false)
    }).catch(console.error)
  }

  useEffect(() => { fetchQueue() }, [])

  const handleApprove = async (id) => {
    try {
      await api.patch(`/approval/${id}/approve`)
      setQueue(q => q.filter(i => i.id !== id))
      toast.success('Approved')
    } catch { toast.error('Error approving') }
  }

  const handleReject = async (id) => {
    try {
      await api.patch(`/approval/${id}/reject`)
      setQueue(q => q.filter(i => i.id !== id))
      toast.success('Rejected — Redrafting...')
    } catch { toast.error('Error rejecting') }
  }

  const handleSaveEdit = async (id) => {
    try {
      await api.patch(`/approval/${id}/edit`, { body: editBody })
      setEditingId(null)
      toast.success('Edit saved')
      setQueue(q => q.map(i => i.id === id ? { ...i, body: editBody } : i))
    } catch { toast.error('Error saving edit') }
  }

  const handleApproveAll = async () => {
    if (!queue.length) return
    const cid = queue[0].campaign_id
    try {
      await api.post(`/approval/approve-all?campaign_id=${cid}`)
      fetchQueue()
      toast.success('All approved!')
    } catch { toast.error('Error approving all') }
  }

  if (loading) return <div className="text-center py-10">Loading queue...</div>

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Approval Queue</h1>
          <p className="text-text-secondary text-sm mt-1">{queue.length} emails waiting for human review.</p>
        </div>
        {queue.length > 0 && (
          <button className="btn-success" onClick={handleApproveAll}>
            <Check size={18} /> Approve All {queue.length}
          </button>
        )}
      </div>

      {queue.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <Check size={48} className="text-green mx-auto mb-4 opacity-50" />
          <p className="text-lg text-white font-medium">All caught up!</p>
          <p className="text-text-secondary">No emails waiting for approval right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map(item => (
            <div key={item.id} className="glass-card p-5 animate-slide-in flex flex-col gap-4 border-l-4" style={{borderLeftColor: item.ai_score > 0.5 ? '#F87171' : '#00D68F'}}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold text-white">{item.lead.full_name} <span className="text-text-muted font-normal">({item.lead.company_name})</span></p>
                  <p className="text-xs text-text-secondary">{item.lead.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge-new">{item.step_label}</span>
                  {item.rewritten && <span className="badge-paused">Auto-Rewritten</span>}
                  <span className="text-xs px-2 py-1 rounded-md bg-bg-elevated border border-border text-text-muted">
                    AI Score: {item.ai_score?.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="bg-bg-elevated border border-border p-4 rounded-xl">
                <p className="text-sm font-semibold text-white mb-3 pb-2 border-b border-border">Subj: <span className="font-normal">{item.subject}</span></p>
                
                {editingId === item.id ? (
                  <div className="space-y-2">
                    <textarea 
                      className="textarea-field font-sans min-h-[150px]" 
                      value={editBody} 
                      onChange={e => setEditBody(e.target.value)} 
                    />
                    <div className="flex justify-end gap-2">
                      <button className="btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                      <button className="btn-primary py-1.5" onClick={() => handleSaveEdit(item.id)}>Save Edit</button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed relative group">
                    <p>{item.body}</p>
                    <button 
                      className="absolute top-0 right-0 p-1.5 bg-bg-card rounded-lg opacity-0 group-hover:opacity-100 transition-opacity border border-border hover:text-orange"
                      onClick={() => { setEditingId(item.id); setEditBody(item.body); }}
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-2">
                <button className="btn-success flex-1" onClick={() => handleApprove(item.id)}>
                  <Check size={16} /> Approve
                </button>
                <button className="btn-danger w-32" onClick={() => handleReject(item.id)}>
                  <RefreshCw size={16} /> Redraft
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
