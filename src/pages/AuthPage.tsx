import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Mail, Lock, User as UserIcon } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Mode = 'signin' | 'signup'

export function AuthPage() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin'
  const redirectUrl = searchParams.get('redirect') || '/chat'
  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === 'signup') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.')
        setLoading(false)
        return
      }
      if (!displayName.trim()) {
        setError('Please enter a display name.')
        setLoading(false)
        return
      }
    }

    const result =
      mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password, displayName.trim())

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      navigate(redirectUrl)
    }
  }

  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <div className="px-6 pt-5">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-burgundy mb-4">
              <span className="text-white font-semibold text-xl">E</span>
            </div>
            <h1 className="text-2xl font-semibold text-ink">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-sm text-ink-secondary mt-1">
              {mode === 'signin' ? 'Continue your journey with Elara.' : 'Begin remembering what matters.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <Input
                label="Display name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="What should Elara call you?"
                required
                autoComplete="name"
              />
            )}
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
              required
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />

            {error && (
              <div className="text-sm text-error bg-error-light rounded-xl px-4 py-3 border border-error/10">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full" size="lg">
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin')
                setError(null)
              }}
              className="text-sm text-ink-secondary hover:text-ink transition-colors"
            >
              {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>

          <p className="text-xs text-ink-tertiary text-center mt-6 leading-relaxed">
            By creating an account, you acknowledge that conversations with Elara are processed by an
            external AI provider. You can manage your data and privacy at any time.
          </p>
        </div>
      </div>
    </div>
  )
}
