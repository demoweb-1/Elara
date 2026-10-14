import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { PageSkeleton } from './components/ui/Skeletons'
import { Landing } from './pages/Landing'
import { AuthPage } from './pages/AuthPage'
const Onboarding = lazy(() => import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })))
import { AppLayout } from './components/AppLayout'
const Chat = lazy(() => import('./pages/Chat').then((m) => ({ default: m.Chat })))
const Memories = lazy(() => import('./pages/Memories').then((m) => ({ default: m.Memories })))
const Together = lazy(() => import('./pages/Together').then((m) => ({ default: m.Together })))
const Suggestions = lazy(() => import('./pages/Suggestions').then((m) => ({ default: m.Suggestions })))
const Reminders = lazy(() => import('./pages/Reminders').then((m) => ({ default: m.Reminders })))
const Profile = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })))
const Privacy = lazy(() => import('./pages/Privacy').then((m) => ({ default: m.Privacy })))
const Pricing = lazy(() => import('./pages/Pricing').then((m) => ({ default: m.Pricing })))
const InvitationLanding = lazy(() => import('./pages/InvitationLanding').then((m) => ({ default: m.InvitationLanding })))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <AppLayout><PageSkeleton /></AppLayout>
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
      <AppLayout><PageSkeleton /></AppLayout>
    )
  }

  if (profile && !profile.onboarding_completed) {
    return <Onboarding />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
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
                <Suspense fallback={<PageSkeleton />}>
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
                </Suspense>
              </AppLayout>
            </OnboardingGate>
          </ProtectedRoute>
        }
      />
    </Routes>
    </Suspense>
  )
}
