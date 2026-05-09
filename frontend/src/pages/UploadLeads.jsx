import React, { useState, useEffect } from 'react'
import api from '../api/client'
import { Upload, FileSpreadsheet, Plus, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

export default function UploadLeads() {
  const [campaigns, setCampaigns] = useState([])
  const [selectedCam, setSelectedCam] = useState('')
  const [file, setFile] = useState(null)
  
  const [detectedCols, setDetectedCols] = useState([])
  const [sampleRow, setSampleRow] = useState({})
  
  const [mapping, setMapping] = useState({
    email: '', first_name: '', last_name: '', company_name: '', company_description: '', job_title: '', linkedin_url: '', why_fit: ''
  })
  
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    api.get('/campaigns').then(res => setCampaigns(res.data)).catch(console.error)
    api.get('/settings').then(res => {
      if (res.data.column_mapping) setMapping(res.data.column_mapping)
    }).catch()
  }, [])

  const handleFileChange = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setResult(null)

    const fd = new FormData()
    fd.append('file', f)
    
    try {
      const res = await api.post('/upload/detect-columns', fd)
      setDetectedCols(res.data.columns)
      setSampleRow(res.data.sample_row)
    } catch (err) {
      toast.error('Failed to parse file columns')
    }
  }

  const handleUpload = async () => {
    if (!selectedCam || !file) return toast.error('Select campaign and file')
    
    setUploading(true)
    
    // Save mapping first
    try {
      await api.put('/settings/column-mapping', { column_mapping: mapping })
    } catch {}

    const fd = new FormData()
    fd.append('campaign_id', selectedCam)
    fd.append('file', file)

    try {
      const res = await api.post('/upload/leads', fd)
      setResult(res.data)
      toast.success('Leads uploaded successfully!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="animate-fade-in max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Upload Leads</h1>
          <p className="text-text-secondary text-sm mt-1">Import Excel or CSV and automatically deduplicate.</p>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="space-y-6">
          
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Select Campaign</label>
            <div className="flex items-center gap-3">
              <select className="input-field" value={selectedCam} onChange={e => setSelectedCam(e.target.value)}>
                <option value="">-- Choose Campaign --</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <Link to="/campaigns" className="btn-secondary whitespace-nowrap"><Plus size={16}/> New</Link>
            </div>
            {selectedCam && <p className="text-xs text-orange mt-2">Uploading mid-campaign will automatically skip duplicates.</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Excel / CSV File</label>
            <div className={`border-2 border-dashed ${file ? 'border-orange/50 bg-orange/5' : 'border-border bg-bg-elevated'} rounded-xl p-8 text-center transition-colors relative`}>
              <input type="file" accept=".xlsx,.csv" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileChange} />
              <FileSpreadsheet className={`mx-auto mb-3 ${file ? 'text-orange' : 'text-text-muted'}`} size={32} />
              {file ? (
                <div>
                  <p className="text-sm font-bold text-white">{file.name}</p>
                  <p className="text-xs text-text-muted mt-1">{(file.size / 1024).toFixed(1)} KB — Ready to map</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-bold text-text-secondary">Drag & drop or click to upload</p>
                  <p className="text-xs text-text-muted mt-1">Supports .xlsx and .csv files</p>
                </div>
              )}
            </div>
          </div>

          {detectedCols.length > 0 && (
            <div className="animate-slide-in">
              <h3 className="text-sm font-bold text-white mb-3">Map Columns</h3>
              <div className="grid grid-cols-2 gap-4 bg-bg-elevated border border-border rounded-xl p-4">
                {Object.keys(mapping).map(field => (
                  <div key={field} className="flex items-center gap-3">
                    <label className="text-xs text-text-secondary w-32 shrink-0">{field.replace('_', ' ').toUpperCase()}</label>
                    <select className="input-field py-1.5 text-xs" value={mapping[field]} onChange={e => setMapping({...mapping, [field]: e.target.value})}>
                      <option value="">-- Ignore --</option>
                      {detectedCols.map(c => <option key={c} value={c}>{c} (e.g. {sampleRow[c]?.substring(0,20)})</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result && (
            <div className="p-4 rounded-xl bg-green/10 border border-green/20 flex flex-col gap-2">
              <p className="text-green font-bold flex items-center gap-2"><Check size={18} /> Upload Complete</p>
              <p className="text-sm text-text-secondary">Added: <strong className="text-white">{result.added}</strong> new leads</p>
              <p className="text-sm text-text-secondary">Skipped: <strong className="text-white">{result.skipped}</strong> duplicates</p>
              <p className="text-xs text-orange mt-2">AI is now generating personalized drafts for the new leads.</p>
            </div>
          )}

          <button className="btn-primary w-full" onClick={handleUpload} disabled={!file || !selectedCam || uploading}>
            {uploading ? 'Processing...' : result ? 'Upload Another' : 'Upload & Process Leads'}
          </button>
        </div>
      </div>
    </div>
  )
}
