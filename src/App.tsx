import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { Spinner } from './components/ui/Card'
import { Landing } from './pages/Landing'
import { AuthPage } from './pages/AuthPage'
import { Onboarding } from './pages/Onboarding'
import { AppLayout } from './components/AppLayout'
import { Chat } from './pages/Chat'
import { Memories } from './pages/Memories'
import { Together } from './pages/Together'
import { Suggestions } from './pages/Suggestions'
import { Reminders } from './pages/Reminders'
import { Profile } from './pages/Profile'
import { Privacy } from './pages/Privacy'
import { Pricing } from './pages/Pricing'
import { InvitationLanding } from './pages/InvitationLanding'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ivory">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/auth" replace />
  }

  return <>{children}</>
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ivory">
        <Spinner size="lg" />
      </div>
    )
  }

  if (profile && !profile.onboarding_completed) {
    return <Onboarding />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/invite/:token" element={<InvitationLanding />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <OnboardingGate>
              <AppLayout>
                <Routes>
                  <Route path="/chat" element={<Chat />} />
                  <Route path="/memories" element={<Memories />} />
                  <Route path="/together" element={<Together />} />
                  <Route path="/suggestions" element={<Suggestions />} />
                  <Route path="/reminders" element={<Reminders />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="*" element={<Navigate to="/chat" replace />} />
                </Routes>
              </AppLayout>
            </OnboardingGate>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
