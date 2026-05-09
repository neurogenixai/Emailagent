import React, { useState, useEffect } from 'react'
import api from '../api/client'
import { Search } from 'lucide-react'

export default function Leads() {
  const [leads, setLeads] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get(`/leads?page=1&page_size=50${search ? '&search='+search : ''}`)
      .then(res => setLeads(res.data.leads)).catch()
  }, [search])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Leads Directory</h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input 
            className="input-field pl-9 py-2 text-sm" 
            placeholder="Search email or name..." 
            value={search} onChange={e=>setSearch(e.target.value)} 
          />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Company</th>
              <th>Status</th>
              <th>Date Added</th>
            </tr>
          </thead>
          <tbody>
            {leads.map(l => (
              <tr key={l.id} className="cursor-pointer hover:bg-bg-elevated">
                <td className="font-medium text-white">{l.full_name || '-'}</td>
                <td>{l.email}</td>
                <td>{l.company_name || '-'}</td>
                <td><span className={`badge-${l.status}`}>{l.status}</span></td>
                <td>{new Date(l.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {leads.length===0 && <tr><td colSpan="5" className="text-center py-6 text-text-muted">No leads found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
