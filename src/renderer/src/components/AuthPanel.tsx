import React, { useState } from 'react'
import { login, signup } from '../authService'
  import {Stethoscope} from 'lucide-react'
// import vetbuddyLogo from '../assets/vetbuddy_icon.png'

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

  const handleSignIn = async () => {
    if (!email || !password) {
      setError('Please enter email and password')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

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
    if (!email || !password || !fullName) {
      setError('Please fill in all fields')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await signup(fullName, email, password)
      onLoginSuccess?.()
    } catch (err: any) {
      // Handle specific Firebase errors
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

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await forgotPassword(email)
      setSuccess('Password reset email sent! Check your inbox.')
      setTimeout(() => setMode('signin'), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  // const handleGoogleSignIn = async () => {
  //   setLoading(true)
  //   setError('')
  //   setSuccess('')

  //   try {
  //     await signInWithGoogle()
  //     onLoginSuccess?.()
  //   } catch (err: any) {
  //     // More user-friendly error message for popup blocking
  //     if (err.message?.includes('popup') || err.message?.includes('blocked')) {
  //       setError('Google Sign-In is currently unavailable in extensions. Please use email/password to sign in.')
  //     } else {
  //       setError(err.message || 'Google sign-in failed. Please use email/password instead.')
  //     }
  //   } finally {
  //     setLoading(false)
  //   }
  // }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'signin') handleSignIn()
    else if (mode === 'signup') handleSignUp()
    else if (mode === 'forgot') handleForgotPassword()
  }

  return (
    <div>
      <div className="text-center mb-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl from-primary to-primary-dark flex items-center justify-center text-white font-bold text-3xl">
          <Stethoscope className="w-5 h-5" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          VetBuddy
        </h2>
        <p className="text-muted text-sm">
          {mode === 'signin' && 'Sign in to your account'}
          {mode === 'signup' && 'Create a new account'}
          {mode === 'forgot' && 'Reset your password'}
        </p>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mode === 'signup' && (
          <div>
            <label className="text-sm text-muted block mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Dr. John Doe"
              disabled={loading}
              className="input"
            />
          </div>
        )}

        <div>
          <label className="text-sm text-muted block mb-2">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={loading}
            className="input"
          />
        </div>

        {mode !== 'forgot' && (
          <div>
            <label className="text-sm text-muted block mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              className="input"
            />
          </div>
        )}

        {/* {mode === 'signin' && (
          <div className="text-right -mt-2">
            <button
              type="button"
              onClick={() => setMode('forgot')}
              disabled={loading}
              className="text-muted bg-transparent border-none cursor-pointer p-0 underline font-medium text-sm hover:text-foreground transition-colors"
            >
              Forgot password?
            </button>
          </div>
        )} */}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary btn-lg w-full mt-2"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="spinner"></div>
              Please wait...
            </div>
          ) : (
            mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Sign Up' : 'Send Reset Email'
          )}
        </button>

        {/* Google Sign-In using Chrome Identity API */}
        {/* {mode !== 'forgot' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
              <div style={{ height: 1, background: '#e0e0e0', flex: 1 }} />
              <div style={{ color: '#5f6368', fontSize: 12 }}>or</div>
              <div style={{ height: 1, background: '#e0e0e0', flex: 1 }} />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '8px 12px',
                border: '1px solid #dadce0',
                borderRadius: 6,
                background: '#fff',
                fontSize: 14,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width={18} height={18} alt="Google" />
              Continue with Google
            </button>
          </>
        )} */}

        {/* <div className="text-sm text-muted mt-4 text-center">
          {mode === 'signin' && (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup')
                  setError('')
                  setSuccess('')
                }}
                disabled={loading}
                className="text-primary bg-transparent border-none cursor-pointer p-0 underline font-medium hover:text-primary-dark transition-colors"
              >
                Sign up
              </button>
            </>
          )}
          {(mode === 'signup' || mode === 'forgot') && (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signin')
                  setError('')
                  setSuccess('')
                }}
                disabled={loading}
                className="text-primary bg-transparent border-none cursor-pointer p-0 underline font-medium hover:text-primary-dark transition-colors"
              >
                Sign in
              </button>
            </>
          )}
        </div> */}
      </form>
    </div>
  )
}


