import React, { useState, useEffect } from 'react'
import api from '../api/client'
import { Save, Plus, X, Upload } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Settings() {
  const [activeTab, setActiveTab] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Extra hidden toggle click counter for prompt editor
  const [secretClicks, setSecretClicks] = useState(0)

  useEffect(() => {
    api.get('/settings').then(res => {
      setData(res.data)
      setLoading(false)
    }).catch(console.error)
  }, [])

  const handleChange = (field, value) => {
    setData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async (endpoint, payloadJSON) => {
    try {
      await api.put(`/settings/${endpoint}`, payloadJSON)
      toast.success('Settings saved successfully!')
    } catch (error) {
      toast.error('Failed to save settings')
    }
  }

  if (loading) return <div className="text-center py-10 text-text-muted">Loading settings...</div>

  return (
    <div className="animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Settings
            <span 
              className="w-4 h-4 cursor-pointer opacity-0 hover:opacity-100 transition-opacity" 
              onClick={() => setSecretClicks(prev => prev + 1)}
            >
              🤫
            </span>
          </h1>
          <p className="text-text-secondary text-sm mt-1">Configure your email engine.</p>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* Vertical Tabs */}
        <div className="w-64 glass-card p-2 shrink-0 sticky top-24">
          {[
            { id: 1, label: 'Product Context' },
            { id: 2, label: 'Sequence & Prompts' },
            { id: 5, label: 'Sending Schedule' },
            { id: 6, label: 'Mailbox Rotation' },
          ].map(t => (
            (!t.hidden) && (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`w-full text-left px-4 py-3 rounded-xl mb-1 text-sm font-medium transition-colors ${
                  activeTab === t.id ? 'bg-orange/10 text-orange' : 'text-text-secondary hover:bg-bg-elevated hover:text-white'
                }`}
              >
                {t.label}
              </button>
            )
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 space-y-6">
          
          {/* SEC 1: Product Context */}
          {activeTab === 1 && (
            <div className="glass-card p-6 animate-slide-in">
              <h2 className="text-lg font-bold text-white mb-4">Product Context</h2>
              <p className="text-sm text-text-secondary mb-6">This context is automatically injected into every AI email generation prompt. Set it once and forget it.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1 ml-1 uppercase">Product Name</label>
                  <input className="input-field" value={data.product_name || ''} onChange={e => handleChange('product_name', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1 ml-1 uppercase">Product Description (What it does)</label>
                  <textarea className="textarea-field" rows="3" value={data.product_description || ''} onChange={e => handleChange('product_description', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1 ml-1 uppercase">Ideal Customer Profile (Who needs it)</label>
                  <textarea className="textarea-field" rows="3" value={data.icp || ''} onChange={e => handleChange('icp', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1 ml-1 uppercase">Value Proposition (Key benefits)</label>
                  <textarea className="textarea-field" rows="3" value={data.value_proposition || ''} onChange={e => handleChange('value_proposition', e.target.value)} />
                </div>
                <div className="pt-2">
                  <button className="btn-primary" onClick={() => handleSave('product-context', {
                    product_name: data.product_name, product_description: data.product_description, icp: data.icp, value_proposition: data.value_proposition
                  })}>
                    <Save size={16} /> Save Product Context
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SEC 2: Sequence & Prompts */}
          {activeTab === 2 && (
            <div className="glass-card p-6 animate-slide-in">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-white">Dynamic Email Sequence</h2>
                <button 
                  className="btn-ghost text-orange text-xs py-1"
                  onClick={() => {
                    const newSteps = [...(data.sequence_steps || [])];
                    newSteps.push({
                      step: newSteps.length,
                      name: `Follow-up ${newSteps.length}`,
                      delay_days: 3,
                      prompt: ""
                    });
                    handleChange('sequence_steps', newSteps);
                  }}
                >
                  <Plus size={14}/> Add Follow-up
                </button>
              </div>
              <p className="text-sm text-text-secondary mb-6">Create infinite custom follow-ups. Delays are days after the previous email.</p>
              
              <div className="space-y-6">
                {(data.sequence_steps || []).map((step, index) => (
                  <div key={index} className="p-4 bg-bg-elevated border border-border rounded-xl space-y-4 relative">
                    {index > 0 && (
                      <button 
                        className="absolute top-4 right-4 text-text-muted hover:text-red-400"
                        onClick={() => {
                          const newSteps = [...data.sequence_steps];
                          newSteps.splice(index, 1);
                          // Re-index steps
                          newSteps.forEach((s, idx) => s.step = idx);
                          handleChange('sequence_steps', newSteps);
                        }}
                      >
                        <X size={16}/>
                      </button>
                    )}
                    <div className="flex items-center gap-4 border-b border-border pb-3">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-white">{index === 0 ? "Intro Email" : `Follow-up ${index}`}</p>
                        <p className="text-xs text-text-muted">{index === 0 ? "First touchpoint. Sent immediately." : "Gentle nudge."}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-text-muted uppercase">Delay (Days):</span>
                        <input 
                          type="number" 
                          min="0"
                          disabled={index === 0}
                          className="input-field w-20 py-1 font-bold text-center" 
                          value={step.delay_days} 
                          onChange={(e) => {
                            const newSteps = [...data.sequence_steps];
                            newSteps[index].delay_days = parseInt(e.target.value) || 0;
                            handleChange('sequence_steps', newSteps);
                          }} 
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-2">Claude Prompt</label>
                      <textarea 
                        className="textarea-field font-mono text-xs h-32" 
                        value={step.prompt} 
                        onChange={(e) => {
                          const newSteps = [...data.sequence_steps];
                          newSteps[index].prompt = e.target.value;
                          handleChange('sequence_steps', newSteps);
                        }} 
                      />
                    </div>
                  </div>
                ))}

                <div className="p-4 bg-bg-card border border-border rounded-xl">
                  <p className="text-xs font-bold text-white mb-2">Available Variables:</p>
                  <p className="text-xs text-text-muted font-mono leading-relaxed">
                    {'{name}'}, {'{first_name}'}, {'{company}'}, {'{company_description}'}, {'{job_title}'}, {'{why_fit}'}, {'{product}'}, {'{value_proposition}'}, {'{icp}'}
                  </p>
                </div>

                <div className="pt-2">
                  <button className="btn-primary" onClick={() => handleSave('sequence-steps', { sequence_steps: data.sequence_steps })}>
                    <Save size={16} /> Save Sequence
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SEC 5: Sending Schedule */}
          {activeTab === 5 && (
            <div className="glass-card p-6 animate-slide-in">
              <h2 className="text-lg font-bold text-white mb-4">Sending Schedule</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1 ml-1 uppercase">Start Time (Hour 0-23)</label>
                  <input type="number" max="23" min="0" className="input-field" value={data.send_start_hour || 9} onChange={e => handleChange('send_start_hour', parseInt(e.target.value))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1 ml-1 uppercase">End Time (Hour 0-23)</label>
                  <input type="number" max="23" min="0" className="input-field" value={data.send_end_hour || 18} onChange={e => handleChange('send_end_hour', parseInt(e.target.value))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-text-muted mb-1 ml-1 uppercase">Timezone</label>
                  <select className="input-field" value={data.timezone || 'IST'} onChange={e => handleChange('timezone', e.target.value)}>
                    <option value="IST">IST - Indian Standard Time</option>
                    <option value="EST">EST - Eastern Standard Time</option>
                    <option value="PST">PST - Pacific Standard Time</option>
                    <option value="GMT">GMT - Greenwich Mean Time</option>
                    <option value="UAE">UAE - Gulf Standard Time</option>
                  </select>
                </div>
              </div>

              <label className="block text-xs font-medium text-text-muted mb-2 ml-1 uppercase">Active Sending Days</label>
              <div className="flex flex-wrap gap-3 mb-6">
                {[
                  { k: 'send_monday', l: 'Mon' }, { k: 'send_tuesday', l: 'Tue' }, { k: 'send_wednesday', l: 'Wed' },
                  { k: 'send_thursday', l: 'Thu' }, { k: 'send_friday', l: 'Fri' }, { k: 'send_saturday', l: 'Sat' }, { k: 'send_sunday', l: 'Sun' }
                ].map(day => (
                  <label key={day.k} className="flex items-center gap-2 cursor-pointer bg-bg-elevated px-3 py-2 border border-border rounded-lg">
                    <input type="checkbox" checked={data[day.k] || false} onChange={e => handleChange(day.k, e.target.checked)} className="accent-orange" />
                    <span className="text-sm text-text-secondary">{day.l}</span>
                  </label>
                ))}
              </div>

              <button className="btn-primary" onClick={() => handleSave('sending-schedule', {
                send_start_hour: data.send_start_hour, send_end_hour: data.send_end_hour, timezone: data.timezone,
                send_monday: data.send_monday, send_tuesday: data.send_tuesday, send_wednesday: data.send_wednesday,
                send_thursday: data.send_thursday, send_friday: data.send_friday, send_saturday: data.send_saturday, send_sunday: data.send_sunday
              })}>
                <Save size={16} /> Save Schedule
              </button>
            </div>
          )}

          {/* SEC 6: Mailbox Rotation */}
          {activeTab === 6 && (
            <div className="glass-card p-6 animate-slide-in">
              <h2 className="text-lg font-bold text-white mb-4">Mailbox Rotation</h2>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1 ml-1 uppercase">Max Emails Per Mailbox Per Day</label>
                  <input type="number" min="1" max="100" className="input-field" value={data.max_per_mailbox_per_day || 40} onChange={e => handleChange('max_per_mailbox_per_day', parseInt(e.target.value))} />
                  <p className="text-xs text-text-muted ml-1 mt-1">Recommended: 30-40 per day to maintain reputation.</p>
                </div>

                <div className="pt-4">
                  <label className="block text-xs font-medium text-text-muted mb-2 ml-1 uppercase">Rotation Strategy</label>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-3 bg-bg-elevated border border-border rounded-xl cursor-pointer">
                      <input type="radio" name="rot" checked={data.rotation_strategy === 'round_robin'} onChange={() => handleChange('rotation_strategy', 'round_robin')} className="mt-1 accent-orange" />
                      <div>
                        <p className="text-sm font-bold text-white">Round Robin <span className="text-green text-xs font-normal ml-2">Recommended</span></p>
                        <p className="text-xs text-text-muted">Equally distributes sends across all active mailboxes one by one.</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 bg-bg-elevated border border-border rounded-xl cursor-pointer">
                      <input type="radio" name="rot" checked={data.rotation_strategy === 'block'} onChange={() => handleChange('rotation_strategy', 'block')} className="mt-1 accent-orange" />
                      <div>
                        <p className="text-sm font-bold text-white">Block Rotation</p>
                        <p className="text-xs text-text-muted">Fills one mailbox to its daily limit before moving to the next.</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <button className="btn-primary" onClick={() => handleSave('mailbox-rotation', {
                rotation_strategy: data.rotation_strategy, max_per_mailbox_per_day: data.max_per_mailbox_per_day
              })}>
                <Save size={16} /> Save Rotation
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
