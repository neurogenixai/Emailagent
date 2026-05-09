import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Zap, Mail, Shield, BrainCircuit, BarChart3, ChevronRight, CheckCircle2, TrendingUp, Eye, EyeOff, X, User, Building2, Phone, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/client'
import { GoogleLogin } from '@react-oauth/google'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showRequest, setShowRequest] = useState(false)
  const [reqLoading, setReqLoading] = useState(false)
  const [reqDone, setReqDone] = useState(false)
  const [reqForm, setReqForm] = useState({ full_name: '', email: '', company_name: '', phone: '', use_case: '' })
  const { login, loginWithGoogle } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Welcome back to Dashboard!')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleRequestAccess = async (e) => {
    e.preventDefault()
    setReqLoading(true)
    try {
      await api.post('/admin/access-requests', reqForm)
      setReqDone(true)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit. Please try again.')
    } finally {
      setReqLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-bg-base relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-orange opacity-[0.03] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-accent opacity-[0.03] blur-[120px] pointer-events-none" />

      {/* LEFT COLUMN: Branding & Value Prop */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 xl:p-20 relative z-10 border-r border-border bg-[#0a0d18] shadow-[10px_0_30px_rgba(0,0,0,0.5)]">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange to-orange-dark shadow-orange-glow flex items-center justify-center">
              <Zap size={20} color="white" fill="white" />
            </div>
            <h1 className="text-xl font-bold tracking-wider uppercase text-white">Neurogenix</h1>
          </div>

          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange/10 border border-orange/20 text-orange text-xs font-semibold uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-orange animate-pulse-dot" />
              Email Outreach Agent
            </div>
            <h2 className="text-5xl xl:text-6xl font-extrabold text-white leading-[1.1] tracking-tight">
              Personalized emails that <br /> <span className="text-gradient-orange">actually convert.</span>
            </h2>
            <p className="text-lg text-text-secondary max-w-lg leading-relaxed mt-4">
              Hyper-personalized AI cold outreach at scale. Automate lead management, auto-generate human-like emails, and close more deals.
            </p>
          </div>

          <div className="mt-12 space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-orange/10 text-orange mt-1 shadow-orange-glow">
                <BrainCircuit size={20} />
              </div>
              <div>
                <h3 className="text-white font-bold mb-1">Human-Like AI Personalization</h3>
                <p className="text-sm text-text-muted leading-relaxed">Claude integration analyzes your ICP and outputs highly personalized drafts that read naturally (0% AI detection score).</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-blue-accent/10 text-blue-accent mt-1 box-shadow-[0_0_15px_rgba(77,156,255,0.2)]">
                <Shield size={20} />
              </div>
              <div>
                <h3 className="text-white font-bold mb-1">Smart Mailbox Rotation</h3>
                <p className="text-sm text-text-muted leading-relaxed">Rotate sending over multiple accounts to completely protect your domain reputation and maximize deliverability.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-green/10 text-green mt-1">
                <TrendingUp size={20} />
              </div>
              <div>
                <h3 className="text-white font-bold mb-1">Intelligent Reply Halts</h3>
                <p className="text-sm text-text-muted leading-relaxed">Constant IMAP polling detects lead replies instantly and automatically pauses any further followup sequences.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <p className="text-text-muted text-sm font-medium">Powered by Neurogenix — AI Growth Infrastructure</p>
          <p className="text-text-muted text-xs mt-2 opacity-50">&copy; 2026 Neurogenix AI. All rights reserved.</p>
        </div>
      </div>

      {/* RIGHT COLUMN: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative z-10 bg-bg-base/40">
        
        {/* Subtle decorative grid background for the right side */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-50" />

        {/* Floating badge for visual flair */}
        <div className="absolute bottom-10 right-10 hidden xl:flex items-center gap-3 glass-card px-4 py-3 rounded-2xl animate-fade-in-delay border border-green/20">
          <div className="w-10 h-10 rounded-full bg-green/20 flex flex-shrink-0 items-center justify-center border border-green/30">
            <CheckCircle2 className="text-green" size={20} />
          </div>
          <div>
            <p className="text-white text-sm font-bold">99.8% Delivery</p>
            <p className="text-text-muted text-xs">Verified by Neurogenix</p>
          </div>
        </div>
        
        {/* Mobile Header (Only visible on small screens) */}
        <div className="absolute top-6 left-6 lg:hidden flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange to-orange-dark shadow-orange-glow flex items-center justify-center">
            <Zap size={16} color="white" fill="white" />
          </div>
          <h1 className="text-lg font-bold tracking-wider uppercase text-white">Neurogenix</h1>
        </div>

        <div className="w-full max-w-md animate-fade-in relative z-20">
          
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
            <p className="text-text-secondary">Sign in to your outreach dashboard</p>
          </div>

          <div className="glass-card p-8 rounded-2xl border border-white/10 relative overflow-hidden shadow-2xl bg-[#161929]/80 backdrop-blur-xl">
            {/* Subtle inner top highlight */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-orange/40 to-transparent" />

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-text-muted tracking-wider ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                  <input
                    type="email"
                    placeholder="you@company.com"
                    className="input-field h-12 bg-bg-elevated/70 border-white/5 focus:border-orange/50 transition-colors placeholder:text-text-muted/50 text-white"
                    style={{ paddingLeft: '44px' }}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-semibold uppercase text-text-muted tracking-wider">Password</label>
                  <span 
                    className="text-[11px] font-medium text-orange hover:text-orange-dark cursor-pointer transition-colors"
                    onClick={() => toast('Please contact your administrator to reset your password.', { icon: '🔑' })}
                  >Forgot Password?</span>
                </div>
                <div className="relative">
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="input-field h-12 bg-bg-elevated/70 border-white/5 focus:border-orange/50 transition-colors text-white"
                    style={{ paddingLeft: '44px', paddingRight: '44px' }}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button 
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-4 h-12 rounded-xl bg-gradient-to-r from-orange to-orange-dark hover:from-orange-dark hover:to-[#cc461b] text-white font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(255,107,53,0.3)] hover:shadow-[0_0_30px_rgba(255,107,53,0.5)] active:scale-[0.98]"
                disabled={loading}
              >
                {loading ? 'Authenticating...' : 'Sign In'}
                {!loading && <ChevronRight size={18} className="opacity-80" />}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-[#161929]/80 text-text-muted">Or continue with</span>
                </div>
              </div>

              <div className="flex justify-center mt-4">
                <GoogleLogin
                  onSuccess={async (credentialResponse) => {
                    setLoading(true)
                    try {
                      await loginWithGoogle(credentialResponse.credential)
                      toast.success('Welcome back to Dashboard!')
                    } catch (error) {
                      toast.error(error.response?.data?.detail || 'Google Login failed')
                    } finally {
                      setLoading(false)
                    }
                  }}
                  onError={() => {
                    toast.error('Google Login Failed')
                  }}
                  theme="filled_black"
                  size="large"
                  shape="rectangular"
                  width="100%"
                />
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-white/5 text-center">
              <p className="text-text-muted text-sm">
                Don't have an account?{' '}
                <span
                  className="text-white hover:text-orange cursor-pointer font-medium transition-colors"
                  onClick={() => setShowRequest(true)}
                >Request Access</span>
              </p>
            </div>
          </div>
          
        </div>
      </div>
      
      {/* Request Access Modal */}
      {showRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card p-8 rounded-2xl border border-white/10 w-full max-w-md relative shadow-2xl animate-fade-in">
            <button onClick={() => { setShowRequest(false); setReqDone(false) }} className="absolute top-4 right-4 text-text-muted hover:text-white transition-colors">
              <X size={20} />
            </button>

            {reqDone ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-green/15 border border-green/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="text-green" size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Request Submitted!</h3>
                <p className="text-text-secondary text-sm">The Neurogenix team will review your request and send you login credentials via email.</p>
                <button onClick={() => { setShowRequest(false); setReqDone(false) }} className="mt-6 btn-primary w-full justify-center">
                  Back to Login
                </button>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-white mb-1">Request Access</h3>
                  <p className="text-text-secondary text-sm">Our team will review and get back to you with your credentials.</p>
                </div>

                <form onSubmit={handleRequestAccess} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold uppercase text-text-muted tracking-wider mb-1 block">Full Name *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                      <input required className="input-field" style={{ paddingLeft: 36 }} placeholder="John Smith"
                        value={reqForm.full_name} onChange={e => setReqForm(f => ({ ...f, full_name: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-text-muted tracking-wider mb-1 block">Work Email *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                      <input required type="email" className="input-field" style={{ paddingLeft: 36 }} placeholder="you@company.com"
                        value={reqForm.email} onChange={e => setReqForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-text-muted tracking-wider mb-1 block">Company Name *</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                      <input required className="input-field" style={{ paddingLeft: 36 }} placeholder="Acme Corp"
                        value={reqForm.company_name} onChange={e => setReqForm(f => ({ ...f, company_name: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-text-muted tracking-wider mb-1 block">Phone (optional)</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                      <input className="input-field" style={{ paddingLeft: 36 }} placeholder="+91 98765 43210"
                        value={reqForm.phone} onChange={e => setReqForm(f => ({ ...f, phone: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-text-muted tracking-wider mb-1 block">Tell us your use case</label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 text-text-muted" size={16} />
                      <textarea className="input-field min-h-[80px]" style={{ paddingLeft: 36 }}
                        placeholder="e.g. We need to run outreach campaigns for SaaS leads..."
                        value={reqForm.use_case} onChange={e => setReqForm(f => ({ ...f, use_case: e.target.value }))} />
                    </div>
                  </div>
                  <button type="submit" disabled={reqLoading}
                    className="w-full mt-2 h-12 rounded-xl bg-gradient-to-r from-orange to-orange-dark hover:from-orange-dark hover:to-[#cc461b] text-white font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(255,107,53,0.3)] hover:shadow-[0_0_30px_rgba(255,107,53,0.5)] active:scale-[0.98]">
                    {reqLoading ? 'Submitting…' : 'Submit Request'}
                    {!reqLoading && <ChevronRight size={18} className="opacity-80" />}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

