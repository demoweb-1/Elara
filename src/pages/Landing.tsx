import { Logo } from '@/components/Logo'
import { Link } from 'react-router-dom'
import { MessageCircle, BookHeart, Heart, Shield, Sparkles, ArrowRight } from 'lucide-react'

export function Landing() {
  return (
    <div className="min-h-screen bg-ivory">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <Logo size={36} />
          <span className="font-semibold text-ink text-lg">Elara</span>
        </div>
        <Link
          to="/auth"
          className="text-sm font-medium text-burgundy hover:text-burgundy-dark transition-colors"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="px-6 pt-12 md:pt-24 pb-16 max-w-3xl mx-auto text-center">
        <p className="text-sm font-medium text-burgundy mb-4 tracking-wide uppercase">Your relationship, remembered.</p>
        <h1 className="text-4xl md:text-5xl font-semibold text-ink leading-[1.15] mb-6">
          A warm, intelligent companion
          <br />
          that remembers what matters.
        </h1>
        <p className="text-base md:text-lg text-ink-secondary leading-relaxed max-w-xl mx-auto mb-8">
          Elara quietly remembers the meaningful details of your relationship — preferences, moments, plans —
          and helps you care more thoughtfully for the person you love.
        </p>
        <Link
          to="/auth"
          className="inline-flex items-center gap-2 bg-burgundy text-white px-6 py-3 rounded-xl font-medium hover:bg-burgundy-dark transition-all shadow-sm hover:shadow-md"
        >
          Begin your journey
          <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="text-xs text-ink-tertiary mt-3">Free to start. Partner connection optional.</p>
      </section>

      {/* Feature cards */}
      <section className="px-6 pb-16 max-w-4xl mx-auto">
        <div className="grid md:grid-cols-2 gap-4">
          <FeatureCard
            icon={<MessageCircle className="w-5 h-5" />}
            title="Conversations that remember"
            description="Chat naturally with Elara. She recalls the details you've shared and responds with warmth and thoughtfulness."
          />
          <FeatureCard
            icon={<BookHeart className="w-5 h-5" />}
            title="Your private memory library"
            description="Every memory is yours to review, edit, and organize. Nothing is saved without your explicit approval."
          />
          <FeatureCard
            icon={<Heart className="w-5 h-5" />}
            title="Share with your partner"
            description="Choose what to share through a secure, mutually-accepted connection. You control every memory."
          />
          <FeatureCard
            icon={<Shield className="w-5 h-5" />}
            title="Privacy by design"
            description="Your conversations are private. Memories are never shared automatically. You decide what stays yours."
          />
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 pb-20 max-w-3xl mx-auto">
        <h2 className="text-2xl font-semibold text-ink text-center mb-8">How Elara works</h2>
        <div className="space-y-6">
          <Step
            number="1"
            title="Talk with Elara"
            description="Share moments, preferences, and thoughts in a natural conversation. Elara listens with care."
          />
          <Step
            number="2"
            title="Review proposed memories"
            description="When Elara notices something worth remembering, she proposes a memory card for you to review and approve."
          />
          <Step
            number="3"
            title="Connect and share, optionally"
            description="Invite your partner through a secure link. Share approved memories selectively. Each person stays in control."
          />
          <Step
            number="4"
            title="Receive thoughtful suggestions"
            description="Elara offers gift ideas, date suggestions, and gentle reminders grounded in the memories you've shared."
          />
        </div>
      </section>

      {/* Privacy note */}
      <section className="px-6 pb-20 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-warm-grey-100 p-6 md:p-8">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-burgundy-50 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-burgundy" />
            </div>
            <div>
              <h3 className="font-semibold text-ink mb-1">Your privacy is protected</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">
                Your conversations and memories are stored securely with row-level access controls.
                AI processing happens through Google Gemini on the server side — your API keys are never
                exposed. You can export or delete your data at any time. Before sharing intimate details,
                you'll be asked to acknowledge that your content is processed by an external AI provider.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24 text-center">
        <div className="inline-flex items-center gap-2 text-burgundy mb-2">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-medium">Start remembering what matters</span>
        </div>
        <div className="mt-4">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 bg-burgundy text-white px-6 py-3 rounded-xl font-medium hover:bg-burgundy-dark transition-all shadow-sm"
          >
            Create your account
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="px-6 py-8 border-t border-warm-grey-100 text-center">
        <p className="text-xs text-ink-tertiary">Elara — Your relationship, remembered.</p>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white rounded-2xl border border-warm-grey-100 p-6 shadow-xs">
      <div className="w-10 h-10 rounded-full bg-burgundy-50 flex items-center justify-center text-burgundy mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-ink mb-2">{title}</h3>
      <p className="text-sm text-ink-secondary leading-relaxed">{description}</p>
    </div>
  )
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-full bg-burgundy text-white text-sm font-semibold flex items-center justify-center shrink-0">
        {number}
      </div>
      <div className="flex-1 pb-2">
        <h3 className="font-semibold text-ink mb-1">{title}</h3>
        <p className="text-sm text-ink-secondary leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
