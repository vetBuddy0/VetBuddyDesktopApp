import React, { useState } from 'react'
import { login, signup } from '../authService'
import { Stethoscope, Mail, Lock, User as UserIcon, Eye, EyeOff } from 'lucide-react'

interface AuthPanelProps {
  onLoginSuccess?: () => void
}

type AuthMode = 'signin' | 'signup' | 'forgot'

export const AuthPanel: React.FC<AuthPanelProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSignIn = async () => {
    if (!email || !password) { setError('Please enter email and password'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      await login(email, password)
      onLoginSuccess?.()
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async () => {
    if (!email || !password || !fullName) { setError('Please fill in all fields'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      await signup(fullName, email, password)
      onLoginSuccess?.()
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.')
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.')
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.')
      } else {
        setError(err.message || 'Sign up failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'signin') handleSignIn()
    else if (mode === 'signup') handleSignUp()
  }

  return (
    <div style={{ padding: '0 20px 20px', maxWidth: 340, margin: '0 auto', width: '100%' }}>
      {/* Hero / Logo */}
      <div style={{ textAlign: 'center', marginBottom: 24, paddingTop: 8 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18, margin: '0 auto 14px',
          background: 'var(--color-primary)',
          boxShadow: '0 0 0 5px var(--color-purple-100), var(--shadow-primary-sm)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Stethoscope size={28} style={{ color: 'white' }} />
        </div>
        <h2 style={{
          fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px',
          color: 'var(--color-primary)',
          marginBottom: 4,
        }}>
          My VetBuddy
        </h2>
        <p style={{ fontSize: 12.5, color: 'var(--color-muted-foreground)', fontWeight: 500 }}>
          {mode === 'signin' && 'Sign in to your account'}
          {mode === 'signup' && 'Create your account'}
          {mode === 'forgot' && 'Reset your password'}
        </p>
      </div>

      {/* Card */}
      <div style={{
        background: 'var(--color-card)',
        borderRadius: 16,
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-lg)',
        padding: '20px 18px',
        animation: 'scaleIn 0.2s ease-out',
      }}>
        {/* Mode toggle pill */}
        <div style={{
          display: 'flex', background: 'var(--color-muted)', borderRadius: 10,
          padding: 3, marginBottom: 18, gap: 2,
        }}>
          {(['signin', 'signup'] as AuthMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setSuccess('') }}
              style={{
                flex: 1, padding: '5px 0', fontSize: 12, fontWeight: mode === m ? 600 : 500,
                borderRadius: 8, border: 'none', cursor: 'pointer',
                background: mode === m ? 'var(--color-card)' : 'transparent',
                color: mode === m ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
                boxShadow: mode === m ? 'var(--shadow-xs)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {m === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'signup' && (
            <div className="input-icon-wrapper">
              <UserIcon size={14} className="input-icon" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name (e.g. Dr. Jane Smith)"
                disabled={loading}
                className="input"
              />
            </div>
          )}

          <div className="input-icon-wrapper">
            <Mail size={14} className="input-icon" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              disabled={loading}
              className="input"
            />
          </div>

          <div className="input-icon-wrapper" style={{ position: 'relative' }}>
            <Lock size={14} className="input-icon" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              disabled={loading}
              className="input"
              style={{ paddingRight: 32 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                color: 'var(--color-muted-foreground)', display: 'flex', alignItems: 'center',
              }}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 4 }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="spinner" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} />
                Please wait...
              </span>
            ) : (
              mode === 'signin' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>
      </div>

      {/* Footer note */}
      <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-muted-foreground)', marginTop: 14 }}>
        AI-powered veterinary consultation assistant
      </p>
    </div>
  )
}
