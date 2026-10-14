import { Logo } from '@/components/Logo'
import { type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { MessageCircle, BookHeart, Heart, Sparkles, Bell, User } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

const navItems = [
  { path: '/chat', label: 'Chat', icon: MessageCircle },
  { path: '/memories', label: 'Memories', icon: BookHeart },
  { path: '/together', label: 'Together', icon: Heart },
  { path: '/suggestions', label: 'Ideas', icon: Sparkles },
  { path: '/reminders', label: 'Reminders', icon: Bell },
]

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const location = useLocation()

  const currentLabel = navItems.find((item) => item.path === location.pathname)?.label

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 glass rounded-3xl fixed left-3 top-3 bottom-3">
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-2">
            <Logo size={36} />
            <div>
              <p className="font-semibold text-ink leading-tight">Elara</p>
              <p className="text-xs text-ink-tertiary">relationship memory</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-2 flex flex-col gap-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'glass-pill text-burgundy'
                    : 'text-ink-secondary hover:text-ink hover:bg-warm-grey-50'
                )
              }
            >
              <item.icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-4">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'glass-pill text-burgundy'
                  : 'text-ink-secondary hover:text-ink hover:bg-warm-grey-50'
              )
            }
          >
            <div className="w-7 h-7 rounded-full bg-burgundy-100 flex items-center justify-center text-sm">
              {profile?.avatar_emoji || '🌿'}
            </div>
            <span className="truncate">{profile?.display_name || 'Profile'}</span>
          </NavLink>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 md:ml-[16.5rem] flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-2 mx-3 mt-2 rounded-2xl z-30 glass px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={32} />
            <span className="font-semibold text-ink">{currentLabel || 'Elara'}</span>
          </div>
          <NavLink to="/profile" className="w-8 h-8 rounded-full bg-burgundy-100 flex items-center justify-center text-sm">
            {profile?.avatar_emoji || '🌿'}
          </NavLink>
        </header>

        <main className="flex-1 flex flex-col overflow-hidden pb-24 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-3 left-3 right-3 z-30 glass rounded-3xl border">
        <div className="flex items-center justify-around px-2 py-2 safe-area-pb">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl transition-colors min-w-[56px]',
                  isActive ? 'glass-pill text-burgundy font-semibold' : 'text-ink-secondary'
                )
              }
            >
              <item.icon style={{ width: 20, height: 20 }} />
              <span className="text-xs font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
