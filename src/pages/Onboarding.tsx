import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Shield, MessageCircle, BookHeart } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { getUserTimezone } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const steps = [
  {
    icon: MessageCircle,
    title: 'Meet Elara',
    description: 'Elara is your personal AI companion for relationship memory. She remembers what matters, helps you stay thoughtful, and never judges.',
  },
  {
    icon: BookHeart,
    title: 'How memories work',
    description: 'When Elara notices something worth remembering, she proposes a memory card. You review it, edit if needed, and save only what you approve. Nothing is saved automatically.',
  },
  {
    icon: Shield,
    title: 'Your privacy',
    description: 'Your conversations are private. Memories stay yours unless you choose to share. Partner connection is optional. You can export or delete everything at any time.',
  },
]

export function Onboarding() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(profile?.display_name || '')
  const [partnerName, setPartnerName] = useState('')
  const [aiConsent, setAiConsent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleComplete = async () => {
    if (!user) return
    setLoading(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: name.trim() || profile?.display_name || 'Friend',
        partner_name: partnerName.trim(),
        timezone: getUserTimezone(),
        ai_consent: aiConsent,
        ai_consent_at: aiConsent ? new Date().toISOString() : null,
        onboarding_completed: true,
      })
      .eq('id', user.id)

    if (error) {
      console.error('Onboarding error:', error)
      setLoading(false)
      return
    }

    // Create default notification preferences
    await supabase
      .from('notification_preferences')
      .upsert({ user_id: user.id }, { onConflict: 'user_id' })

    // Create free subscription
    await supabase
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        plan: 'free',
        status: 'active',
        ai_request_limit: 100,
      }, { onConflict: 'user_id' })

    // Log consent event
    if (aiConsent) {
      await supabase.from('consent_events').insert({
        user_id: user.id,
        event_type: 'ai_processing_consent',
        details: { model: 'gemini-2.5-flash-lite', provider: 'Google' },
      })
    }

    await refreshProfile()
    setLoading(false)
    navigate('/chat')
  }

  const isLastStep = step === steps.length
  const isIntroStep = step < steps.length

  return (
    <div className="min-h-screen bg-ivory flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i <= step ? 'w-6 bg-burgundy' : 'w-1.5 bg-warm-grey-200'
              }`}
            />
          ))}
        </div>

        {isIntroStep ? (
          <div className="text-center animate-slide-up">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-burgundy-50 mb-6">
              {(() => { const StepIcon = steps[step].icon; return <StepIcon className="w-7 h-7 text-burgundy" />; })()}
            </div>
            <h2 className="text-xl font-semibold text-ink mb-3">{steps[step].title}</h2>
            <p className="text-sm text-ink-secondary leading-relaxed mb-8">
              {steps[step].description}
            </p>
            <Button onClick={() => setStep(step + 1)} size="lg" className="w-full">
              Continue
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="animate-slide-up">
            <h2 className="text-xl font-semibold text-ink mb-2 text-center">Let's set up your profile</h2>
            <p className="text-sm text-ink-secondary text-center mb-6">
              You can change these anytime.
            </p>

            <div className="space-y-4">
              <Input
                label="Your name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should Elara call you?"
              />
              <Input
                label="Partner's name (optional)"
                type="text"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                placeholder="The person you'd like to remember things about"
                hint="You can connect with a partner later."
              />

              <div className="rounded-xl border border-warm-grey-200 p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aiConsent}
                    onChange={(e) => setAiConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-warm-grey-300 text-burgundy focus:ring-burgundy/20"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink">
                      I understand AI processing
                    </p>
                    <p className="text-xs text-ink-secondary leading-relaxed mt-1">
                      Conversations are processed by Google Gemini, an external AI provider.
                      The free-tier terms may permit use of submitted data to improve Google's services.
                      Your content is not end-to-end encrypted. You can withdraw consent and delete
                      your data at any time.
                    </p>
                  </div>
                </label>
              </div>

              <Button
                onClick={handleComplete}
                loading={loading}
                size="lg"
                className="w-full"
                disabled={!aiConsent}
              >
                Start chatting with Elara
              </Button>
              {!aiConsent && (
                <p className="text-xs text-ink-tertiary text-center">
                  Please acknowledge AI processing to continue.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
