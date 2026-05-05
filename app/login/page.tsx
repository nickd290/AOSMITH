'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { login, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, authLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await login(email, password)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-cream">
        <div className="text-sm tracking-widest uppercase text-brand-ink-mute">Loading…</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-brand-cream">
      {/* Left side — brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-ink flex-col justify-between p-12 text-brand-cream">
        <div>
          <div className="text-xs tracking-[0.2em] uppercase text-brand-cream/60 mb-3">JD Graphic, Co Inc</div>
          <h1 className="text-5xl font-bold leading-none tracking-tight mb-3">
            Inventory<br />Release.
          </h1>
          <p className="text-base text-brand-cream/70 max-w-sm leading-relaxed">
            Releases, paperwork, and shipment confirmations for Enterprise Print Group — handled in one place.
          </p>
        </div>
        <div className="text-xs text-brand-cream/50 leading-relaxed">
          <p>1101 Arthur Ave</p>
          <p>Elk Grove Village, IL 60007</p>
          <p className="mt-2">847.364.4000</p>
        </div>
      </div>

      {/* Right side — form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-brand-cream">
        <div className="w-full max-w-md">
          <div className="bg-white border border-brand-rule rounded-md p-8 shadow-sm">
            <div className="mb-8">
              <div className="text-xs tracking-[0.2em] uppercase text-brand-ink-mute mb-2">Sign In</div>
              <h2 className="text-2xl font-semibold text-brand-ink">Welcome back</h2>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-xs tracking-wider uppercase font-medium text-brand-ink-mute mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-brand-rule rounded text-brand-ink focus:ring-2 focus:ring-brand-rust focus:border-transparent outline-none"
                  placeholder="you@company.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs tracking-wider uppercase font-medium text-brand-ink-mute mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-brand-rule rounded text-brand-ink focus:ring-2 focus:ring-brand-rust focus:border-transparent outline-none"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-brand-rust text-white py-2.5 px-4 rounded font-medium hover:bg-brand-rust-dark focus:ring-2 focus:ring-brand-rust-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-brand-rule">
              <p className="text-xs tracking-wider uppercase text-brand-ink-mute mb-3">Demo Credentials</p>
              <div className="space-y-2 text-sm">
                <div className="bg-brand-cream-deep/50 p-3 rounded border border-brand-rule">
                  <p className="font-medium text-brand-ink">Customer (ePrint Group)</p>
                  <p className="text-brand-ink-mute font-mono text-xs mt-1">kirk@eprintgroup.com / customer123</p>
                </div>
                <div className="bg-brand-cream-deep/50 p-3 rounded border border-brand-rule">
                  <p className="font-medium text-brand-ink">Admin (JD Graphic)</p>
                  <p className="text-brand-ink-mute font-mono text-xs mt-1">admin@jdgraphic.com / admin123</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
