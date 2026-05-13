import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { ArrowLeft, Save, Plus, Trash2, RefreshCw, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CampaignDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState(null)
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    api.get(`/campaigns/${id}`).then(res => {
      setCampaign(res.data)
      setSettings(res.data.settings || {})
      setLoading(false)
    }).catch(() => navigate('/campaigns'))

    // Check how many pending drafts exist for this campaign
    api.get(`/approval/queue?campaign_id=${id}`).then(res => {
      setPendingCount(res.data.total || 0)
    }).catch(() => {})
  }, [id, navigate])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put(`/campaigns/${id}/settings`, { settings })
      toast.success('Campaign settings saved!')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAndRegenerate = async () => {
    setShowConfirm(false)
    setRegenerating(true)
    try {
      // First save the new settings
      await api.put(`/campaigns/${id}/settings`, { settings })
      // Then trigger regeneration of all pending drafts
      const res = await api.post(`/approval/regenerate-all?campaign_id=${id}`)
      toast.success(res.data.message || `Regenerating ${res.data.queued} drafts…`)
      setPendingCount(0)
    } catch {
      toast.error('Failed to regenerate. Please try again.')
    } finally {
      setRegenerating(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Are you absolutely sure? This will delete the campaign, all uploaded leads, and all generated drafts permanently.')) return;
    
    try {
      await api.delete(`/campaigns/${id}`)
      toast.success('Campaign and all data deleted!')
      navigate('/campaigns')
    } catch {
      toast.error('Failed to delete campaign')
    }
  }

  const addStep = () => {
    const steps = settings.sequence_steps || []
    setSettings({...settings, sequence_steps: [...steps, { step: steps.length, label: `Follow-up ${steps.length}`, delay_days: steps.length * 3, prompt: '' }]})
  }

  const removeStep = (idx) => {
    const steps = [...(settings.sequence_steps || [])]
    steps.splice(idx, 1)
    setSettings({...settings, sequence_steps: steps.map((s, i) => ({...s, step: i}))})
  }

  const updateStep = (idx, key, val) => {
    const steps = [...(settings.sequence_steps || [])]
    steps[idx] = { ...steps[idx], [key]: val }
    setSettings({...settings, sequence_steps: steps})
  }

  if (loading) return <div className="text-white p-8">Loading…</div>

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/campaigns')} className="p-2 text-text-muted hover:text-white bg-bg-elevated rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
            <p className="text-text-secondary text-sm mt-1">Configure AI prompts and context for this campaign.</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange/10 border border-orange/20 text-orange text-sm">
              <AlertTriangle size={14} />
              <span className="font-semibold">{pendingCount} pending draft{pendingCount > 1 ? 's' : ''} in queue</span>
            </div>
          )}
          <button className="btn-secondary text-red-400 hover:text-red-500 hover:bg-red-400/10 border-red-400/20" onClick={handleDelete}>
            <Trash2 size={16} /> Delete Campaign
          </button>
          
          <button className="btn-secondary flex items-center gap-2" onClick={handleSave} disabled={saving}>
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={regenerating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange to-orange-dark text-white font-semibold text-sm shadow-[0_0_15px_rgba(255,107,53,0.3)] hover:shadow-[0_0_25px_rgba(255,107,53,0.5)] transition-all disabled:opacity-60"
          >
            <RefreshCw size={16} className={regenerating ? 'animate-spin' : ''} />
            {regenerating ? 'Regenerating…' : 'Save & Regenerate All Drafts'}
          </button>
        </div>
      </div>

      {/* Confirm Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
          <div className="glass-card p-8 rounded-2xl border border-white/10 w-full max-w-sm shadow-2xl animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange/15 border border-orange/20 flex items-center justify-center flex-shrink-0">
                <RefreshCw className="text-orange" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Regenerate All Drafts?</h3>
                <p className="text-text-muted text-xs">This will overwrite {pendingCount > 0 ? `all ${pendingCount} pending draft(s)` : 'all pending drafts'}</p>
              </div>
            </div>
            <p className="text-text-secondary text-sm mb-6">
              Your new prompts will be saved and Claude will rewrite every <strong className="text-white">unapproved draft</strong> in this campaign.
              Already-approved and already-sent emails will <strong className="text-white">not</strong> be affected.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button onClick={handleSaveAndRegenerate}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-gradient-to-r from-orange to-orange-dark text-white font-bold text-sm transition-all">
                <RefreshCw size={14} /> Yes, Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Context Configuration */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-bold text-white border-b border-border pb-3 mb-4">Product Context</h2>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Product Name</label>
            <input
              className="input-field"
              value={settings.product_name || ''}
              onChange={e => setSettings({...settings, product_name: e.target.value})}
              placeholder="e.g. Neurogenix AI"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Product Description</label>
            <textarea
              className="input-field min-h-[80px]"
              value={settings.product_description || ''}
              onChange={e => setSettings({...settings, product_description: e.target.value})}
              placeholder="What does your product do?"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Ideal Customer Profile (ICP)</label>
            <textarea
              className="input-field min-h-[80px]"
              value={settings.icp || ''}
              onChange={e => setSettings({...settings, icp: e.target.value})}
              placeholder="Who is your ideal customer?"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Value Proposition</label>
            <textarea
              className="input-field min-h-[80px]"
              value={settings.value_proposition || ''}
              onChange={e => setSettings({...settings, value_proposition: e.target.value})}
              placeholder="What makes you different?"
            />
          </div>
        </div>

        {/* AI Sequence Steps */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-border pb-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">AI Sequence Prompts</h2>
              <p className="text-xs text-text-muted mt-0.5">Each step is a separate Claude prompt</p>
            </div>
            <button className="btn-secondary py-1 text-xs" onClick={addStep}>
              <Plus size={14}/> Add Step
            </button>
          </div>

          <div className="space-y-5">
            {(settings.sequence_steps || []).map((s, idx) => (
              <div key={idx} className="bg-bg-dark rounded-xl border border-border p-4 relative">
                <div className="flex justify-between items-center mb-3 gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-orange/20 border border-orange/30 flex items-center justify-center text-orange text-xs font-bold flex-shrink-0">{idx + 1}</span>
                    <input
                      className="input-field py-1 text-xs font-semibold"
                      value={s.label || (idx === 0 ? 'Intro Email' : `Follow-up ${idx}`)}
                      onChange={e => updateStep(idx, 'label', e.target.value)}
                      placeholder="Step label"
                    />
                    {idx > 0 && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <input
                          type="number"
                          min="1"
                          className="input-field py-1 text-xs w-16 text-center"
                          value={s.delay_days || 0}
                          onChange={e => updateStep(idx, 'delay_days', parseInt(e.target.value) || 0)}
                        />
                        <span className="text-text-muted text-xs">days</span>
                      </div>
                    )}
                  </div>
                  {idx > 0 && (
                    <button onClick={() => removeStep(idx)} className="text-red-400 hover:text-red-500 flex-shrink-0">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <textarea
                  className="input-field min-h-[110px] text-sm font-mono"
                  value={s.prompt || ''}
                  onChange={e => updateStep(idx, 'prompt', e.target.value)}
                  placeholder={idx === 0
                    ? "Write a short personalized intro email to {name} at {company}. Mention {product}. Keep it under 100 words."
                    : "Write a short follow-up email to {name} who didn't reply. Reference the previous email briefly."
                  }
                />
                <p className="text-xs text-text-muted mt-1.5">
                  Available variables: <span className="font-mono text-orange/80">{'{name}'} {'{company}'} {'{product}'} {'{job_title}'} {'{icp}'}</span>
                </p>
              </div>
            ))}
            {(!settings.sequence_steps || settings.sequence_steps.length === 0) && (
              <div className="text-center py-8 text-text-muted">
                <p className="text-sm">No steps added yet.</p>
                <button onClick={addStep} className="mt-3 btn-secondary text-xs py-1">
                  <Plus size={12} /> Add Intro Email
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
