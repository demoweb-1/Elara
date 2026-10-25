import { LoveLinkSettings } from '@/components/LoveLinkSettings'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crown, Bell, User, LogOut, ChevronRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'
import { getUserTimezone } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

export function Profile() {
  const { user, profile, signOut, refreshProfile } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [partnerName, setPartnerName] = useState(profile?.partner_name || '')
  const [avatarEmoji, setAvatarEmoji] = useState(profile?.avatar_emoji || '🌿')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      display_name: displayName.trim(), partner_name: partnerName.trim(), avatar_emoji: avatarEmoji, timezone: getUserTimezone(),
    }).eq('id', user.id)
    if (error) toast('Failed to save profile', 'error')
    else { toast('Profile updated', 'success'); setEditing(false); refreshProfile() }
    setSaving(false)
  }

  const handleSignOut = async () => { await signOut(); navigate('/') }

  const emojis = ['🌿', '🌸', '🍃', '🌙', '⭐', '🔥', '💫', '🌊']

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 md:px-8 py-4 max-w-2xl mx-auto w-full">
        <h1 className="text-xl font-semibold text-ink mb-6">Profile</h1>
        <LoveLinkSettings />

        <Card className="p-6 mb-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-burgundy-100 flex items-center justify-center text-3xl">{profile?.avatar_emoji || '🌿'}</div>
            <div className="flex-1">
              <p className="font-semibold text-ink text-lg">{profile?.display_name || 'Friend'}</p>
              <p className="text-sm text-ink-tertiary">{user?.email}</p>
              <Badge variant="burgundy" className="mt-1">Free plan</Badge>
            </div>
            {!editing && <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Edit</Button>}
          </div>

          {editing && (
            <div className="space-y-4 pt-4 border-t border-warm-grey-100">
              <Input label="Display name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              <Input label="Partner's name" type="text" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="Optional" />
              <div>
                <p className="text-sm font-medium text-ink mb-2">Avatar</p>
                <div className="flex gap-2 flex-wrap">
                  {emojis.map((e) => (
                    <button key={e} onClick={() => setAvatarEmoji(e)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all ${avatarEmoji === e ? 'bg-burgundy-100 ring-2 ring-burgundy' : 'bg-warm-grey-50 hover:bg-warm-grey-100'}`}>{e}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
                <Button onClick={handleSave} loading={saving}>Save</Button>
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-2">
          <NavItem icon={<Crown className="w-4 h-4" />} label="Plans & Pricing" onClick={() => navigate('/pricing')} />
          <NavItem icon={<Bell className="w-4 h-4" />} label="Notification settings" onClick={() => navigate('/privacy')} />
          <NavItem icon={<User className="w-4 h-4" />} label="Privacy & data" onClick={() => navigate('/privacy')} />
        </div>

        <div className="mt-6 pt-6 border-t border-warm-grey-100">
          <Button variant="secondary" onClick={handleSignOut} className="w-full"><LogOut className="w-4 h-4" />Sign out</Button>
        </div>
      </div>
    </div>
  )
}

function NavItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-warm-grey-100 shadow-xs hover:shadow-sm transition-all text-left">
      <div className="flex items-center gap-3"><span className="text-burgundy">{icon}</span><span className="text-sm font-medium text-ink">{label}</span></div>
      <ChevronRight className="w-4 h-4 text-ink-tertiary" />
    </button>
  )
}
