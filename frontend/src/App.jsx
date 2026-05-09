import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import api from './api/client'

// Pages
import Dashboard from './pages/Dashboard'
import Campaigns from './pages/Campaigns'
import Leads from './pages/Leads'
import ApprovalQueue from './pages/ApprovalQueue'
import Timeline from './pages/Timeline'
import UploadLeads from './pages/UploadLeads'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import Mailboxes from './pages/Mailboxes'
import Replies from './pages/Replies'
import CampaignDetails from './pages/CampaignDetails'
import Clients from './pages/Clients'
import Login from './pages/Login'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { user } = useAuth()
  if (user) return <Navigate to="/dashboard" replace />
  return children
}

function AppContent() {
  const { user } = useAuth()
  const [dashboardData, setDashboardData] = useState({})

  useEffect(() => {
    if (user) {
      api.get('/dashboard').then(r => setDashboardData(r.data)).catch(() => {})
    }
  }, [user])

  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      
      <Route path="/" element={<ProtectedRoute><Layout dashboardData={dashboardData} /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard data={dashboardData} />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="leads" element={<Leads />} />
        <Route path="approval" element={<ApprovalQueue />} />
        <Route path="timeline" element={<Timeline />} />
        <Route path="upload" element={<UploadLeads />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="mailboxes" element={<Mailboxes />} />
        <Route path="replies" element={<Replies />} />
        <Route path="settings" element={<Settings />} />
        <Route path="campaigns/:id" element={<CampaignDetails />} />
        <Route path="clients" element={<Clients />} />
      </Route>
      
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  )
}
