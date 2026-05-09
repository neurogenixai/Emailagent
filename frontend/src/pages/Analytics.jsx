import React, { useState, useEffect } from 'react'
import api from '../api/client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

export default function Analytics() {
  const [trend, setTrend] = useState([])
  const [seqData, setSeqData] = useState([])
  const [mbData, setMbData] = useState([])

  useEffect(() => {
    api.get('/analytics/open-rate-trend?days=14').then(res => setTrend(res.data)).catch()
    api.get('/analytics/sequence-performance').then(res => setSeqData(res.data)).catch()
    api.get('/analytics/mailbox-performance').then(res => setMbData(res.data)).catch()
  }, [])

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">Analytics</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <h2 className="text-sm font-bold text-white mb-4">Open & Reply Trend (14 Days)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2436" vertical={false} />
                <XAxis dataKey="date" stroke="#64748B" fontSize={10} tickFormatter={v => v.slice(5)} />
                <YAxis stroke="#64748B" fontSize={10} />
                <Tooltip contentStyle={{background:'#161929', border:'1px solid #1E2436', borderRadius:8}} />
                <Line type="monotone" dataKey="sent" stroke="#64748B" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="opened" stroke="#FF6B35" strokeWidth={3} dot={{r: 3}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-5">
          <h2 className="text-sm font-bold text-white mb-4">Replies by Sequence Step</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={seqData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2436" vertical={false} />
                <XAxis dataKey="label" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={10} />
                <Tooltip contentStyle={{background:'#161929', border:'1px solid #1E2436', borderRadius:8}} cursor={{fill:'rgba(255,107,53,0.1)'}} />
                <Bar dataKey="replied" fill="#00D68F" radius={[4,4,0,0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass-card p-5">
        <h2 className="text-sm font-bold text-white mb-4">Mailbox Performance</h2>
        <table className="data-table">
          <thead>
            <tr><th>Mailbox</th><th>Total Sent</th><th>Replies</th><th>Reply Rate</th></tr>
          </thead>
          <tbody>
            {mbData.map(m => (
              <tr key={m.mailbox}>
                <td className="font-medium text-white">{m.mailbox}</td>
                <td>{m.sent}</td>
                <td className="text-green">{m.replied}</td>
                <td className="font-bold">{m.reply_rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
