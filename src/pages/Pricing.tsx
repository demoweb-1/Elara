import { Check, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export function Pricing() {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 md:px-8 py-4 max-w-3xl mx-auto w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1 text-burgundy mb-2"><Sparkles className="w-4 h-4" /><span className="text-sm font-medium">Plans</span></div>
          <h1 className="text-2xl font-semibold text-ink mb-2">Simple, honest pricing</h1>
          <p className="text-sm text-ink-secondary max-w-md mx-auto">Elara is free to start. No payment required. Plus is coming soon for those who want more.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-6 border-burgundy/20">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2"><h2 className="text-lg font-semibold text-ink">Free</h2><Badge variant="burgundy">Current plan</Badge></div>
              <p className="text-3xl font-semibold text-ink">$0<span className="text-sm font-normal text-ink-tertiary">/forever</span></p>
            </div>
            <ul className="space-y-2.5 mb-6">
              <Feature text="Personal Elara chat" /><Feature text="Basic persistent memories" /><Feature text="One connected partner" />
              <Feature text="Core memory sharing" /><Feature text="Basic thoughtful suggestions" /><Feature text="Up to 100 AI requests per month" />
            </ul>
            <Button variant="secondary" className="w-full" disabled>You're on this plan</Button>
          </Card>

          <Card className="p-6 glass-tint">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2"><h2 className="text-lg font-semibold text-ink">Plus</h2><Badge variant="accent">Coming soon</Badge></div>
              <p className="text-3xl font-semibold text-ink"><span className="text-sm font-normal text-ink-secondary">Future pricing</span></p>
            </div>
            <ul className="space-y-2.5 mb-6">
              <Feature text="Everything in Free" /><Feature text="Higher AI usage allowances" /><Feature text="Enhanced memory retrieval" />
              <Feature text="Advanced suggestions and reminder options" /><Feature text="Optional premium themes" /><Feature text="Priority support" />
            </ul>
            <Button variant="outline" className="w-full" disabled>Not yet available</Button>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-ink-tertiary leading-relaxed max-w-md mx-auto">
            We will never sell your private relationship data or target ads using intimate conversations.
            Free-tier AI usage is subject to the actual free API quota and may vary.
          </p>
        </div>
      </div>
    </div>
  )
}

function Feature({ text }: { text: string }) {
  return <li className="flex items-start gap-2"><Check className="w-4 h-4 text-success shrink-0 mt-0.5" /><span className="text-sm text-ink-secondary">{text}</span></li>
}
