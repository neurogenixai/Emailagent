import React, { useState, useEffect } from 'react'
import api from '../api/client'

export default function Timeline() {
  const [timeline, setTimeline] = useState([])

  useEffect(() => {
    api.get('/timeline').then(res => setTimeline(res.data)).catch()
  }, [])

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Sending Timeline</h1>
        <p className="text-text-secondary text-sm mt-1">Calendar view of scheduled emails.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {timeline.map(day => (
          <div key={day.date} className="glass-card p-5 flex flex-col md:flex-row md:items-center gap-6">
            <div className="shrink-0 w-32 border-r border-border">
              <p className="text-xl font-bold text-white">{new Date(day.date).getDate()}</p>
              <p className="text-xs text-text-muted uppercase font-bold tracking-wider">
                {new Date(day.date).toLocaleString('default', { month: 'short', weekday: 'short' })}
              </p>
            </div>
            
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(day.counts).map(([label, count]) => (
                <div key={label} className="bg-bg-elevated p-3 rounded-xl border border-border">
                  <p className="text-xs text-text-secondary mb-1">{label}</p>
                  <p className="text-lg font-bold text-white">{count} <span className="text-xs font-normal text-text-muted">emails</span></p>
                </div>
              ))}
            </div>
          </div>
        ))}
        {timeline.length === 0 && (
          <div className="glass-card p-10 text-center text-text-muted">No specific schedules planned yet.</div>
        )}
      </div>
    </div>
  )
}
