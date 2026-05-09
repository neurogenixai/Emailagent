import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard, Megaphone, Users, CheckSquare,
  CalendarDays, Upload, BarChart3, Settings,
  LogOut, Zap, Menu, X, Bell, Mail, Inbox
} from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/campaigns',  icon: Megaphone,        label: 'Campaigns' },
  { to: '/leads',      icon: Users,            label: 'Leads' },
  { to: '/approval',   icon: CheckSquare,      label: 'Approval Queue', badgeKey: 'pending_approvals' },
  { to: '/timeline',   icon: CalendarDays,     label: 'Timeline' },
  { to: '/upload',     icon: Upload,           label: 'Upload Leads' },
  { to: '/analytics',  icon: BarChart3,        label: 'Analytics' },
  { to: '/replies',    icon: Inbox,            label: 'Inbox (Replies)' },
  { to: '/mailboxes',  icon: Mail,             label: 'Mailboxes' },
  { to: '/settings',   icon: Settings,         label: 'Settings' },
]

export default function Layout({ dashboardData }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }

  const SidebarContent = () => (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Logo */}
      <div style={{ padding:'20px 20px 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <div style={{
            width:40, height:40, borderRadius:12,
            background:'linear-gradient(135deg, #FF6B35, #E55A24)',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 0 20px rgba(255,107,53,0.35)',
          }}>
            <Zap size={18} color="white" fill="white" />
          </div>
          <div>
            <p style={{ color:'#64748B', fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:2 }}>
              Neurogenix AI
            </p>
            <p style={{ color:'#FFFFFF', fontSize:'0.95rem', fontWeight:700, lineHeight:1 }}>Email Agent</p>
          </div>
        </div>

        {/* User pill */}
        <div style={{
          display:'flex', alignItems:'center', gap:10,
          padding:'10px 12px', borderRadius:12,
          background:'#1A1E30', border:'1px solid #1E2436', marginBottom:20,
        }}>
          <div style={{
            width:32, height:32, borderRadius:9,
            background:'rgba(255,107,53,0.2)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'0.8125rem', fontWeight:700, color:'#FF6B35', flexShrink:0,
          }}>
            {user?.full_name?.[0] || user?.email?.[0] || 'A'}
          </div>
          <div style={{ minWidth:0 }}>
            <p style={{ color:'#FFFFFF', fontSize:'0.8125rem', fontWeight:600, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {user?.full_name || user?.email}
            </p>
            <p style={{ color:'#64748B', fontSize:'0.7rem', margin:0, textTransform:'capitalize' }}>{user?.role}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:'0 12px', overflowY:'auto' }}>
        <p style={{ color:'#64748B', fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', padding:'4px 12px 8px' }}>
          Platform
        </p>
        {navItems.map(({ to, icon: Icon, label, badgeKey }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => clsx('sidebar-link', isActive && 'active')}
          >
            <Icon size={16} style={{ flexShrink:0 }} />
            {label}
            {badgeKey && dashboardData?.[badgeKey] > 0 && (
              <span className="badge">{dashboardData[badgeKey]}</span>
            )}
          </NavLink>
        ))}
        {/* Admin-only section */}
        {user?.role === 'admin' && (
          <>
            <p style={{ color:'#64748B', fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', padding:'12px 12px 8px', marginTop:8, borderTop:'1px solid #1E2436' }}>
              Admin
            </p>
            <NavLink
              to="/clients"
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => clsx('sidebar-link', isActive && 'active')}
            >
              <Users size={16} style={{ flexShrink:0 }} />
              Client Portal
            </NavLink>
          </>
        )}
      </nav>

      {/* Bottom */}
      <div style={{ padding:12 }}>
        <div style={{
          padding:'10px 14px', borderRadius:12,
          background:'linear-gradient(135deg, rgba(255,107,53,0.08), rgba(0,214,143,0.08))',
          border:'1px solid rgba(255,107,53,0.15)', marginBottom:8,
        }}>
          <p style={{ color:'#8892A0', fontSize:'0.65rem', margin:'0 0 2px' }}>Sub-product of</p>
          <p className="text-gradient-orange" style={{ fontSize:'0.8rem', fontWeight:700, margin:0 }}>Neurogenix AI</p>
        </div>
        <button onClick={handleLogout} className="sidebar-link" style={{ width:'100%', color:'#F87171', background:'none', border:'none' }}>
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', height:'100vh', background:'#080B14', overflow:'hidden' }}>
      {/* Desktop Sidebar */}
      <aside style={{
        display:'none',
        width:235,
        background:'#0F1221',
        borderRight:'1px solid #1E2436',
        flexShrink:0,
        flexDirection:'column',
        ['@media (min-width: 1024px)']: { display: 'flex' }
      }} className="hidden lg:flex flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex' }}>
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)' }} onClick={() => setMobileOpen(false)} />
          <aside style={{ position:'relative', width:235, background:'#0F1221', borderRight:'1px solid #1E2436', display:'flex', flexDirection:'column' }}>
            <button style={{ position:'absolute', top:16, right:16, background:'none', border:'none', color:'#8892A0', cursor:'pointer' }} onClick={() => setMobileOpen(false)}>
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>
        {/* Topbar */}
        <header style={{
          height:56, display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'0 20px', borderBottom:'1px solid #1E2436',
          background:'rgba(15,18,33,0.85)', backdropFilter:'blur(10px)', flexShrink:0,
        }}>
          <button className="lg:hidden" onClick={() => setMobileOpen(true)} style={{ background:'none', border:'none', color:'#8892A0', cursor:'pointer', display:'flex' }}>
            <Menu size={20} />
          </button>
          <div style={{ flex:1 }} />
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {dashboardData?.pending_approvals > 0 && (
              <span style={{ fontSize:'0.75rem', color:'#FF6B35', fontWeight:600 }}>
                {dashboardData.pending_approvals} awaiting approval
              </span>
            )}
            {dashboardData?.bounce_alert && (
              <span style={{ fontSize:'0.75rem', color:'#F87171', fontWeight:600 }}>
                ⚠️ High bounce rate
              </span>
            )}
            <button style={{ background:'none', border:'none', color:'#8892A0', cursor:'pointer', position:'relative' }}>
              <Bell size={18} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex:1, overflowY:'auto', padding:'24px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
