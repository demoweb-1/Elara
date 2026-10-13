# Elara — Your relationship, remembered.

A warm, intelligent AI companion that remembers meaningful personal details and helps couples understand and care for each other. Each person has an independent private AI memory, and partners can selectively share approved memories through a secure connection.

## Tech Stack

- **React + TypeScript + Vite** — Frontend SPA
- **Tailwind CSS v4** — Apple-inspired design system
- **Supabase** — Auth, PostgreSQL, Row Level Security, Edge Functions
- **Google Gemini** — AI conversational responses, memory extraction, suggestions
- **PWA** — Installable on mobile and desktop

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (already provisioned)
- A Google AI Studio API key for Gemini

### Installation

```bash
npm install
```

### Environment Variables

The following are pre-populated in `.env`:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Adding the Gemini API Key

The `GEMINI_API_KEY` must be set as a Supabase Edge Function secret (not in `.env`). To add it:

1. Go to your Supabase project dashboard
2. Navigate to Edge Functions → Secrets
3. Add a secret named `GEMINI_API_KEY` with your Google AI Studio API key
4. Optionally add `GEMINI_MODEL` to override the default model (`gemini-2.5-flash-lite`)

Get a free API key from [Google AI Studio](https://aistudio.google.com/apikey).

Until the key is configured, the app runs in a clearly-labeled demo mode for chat responses.

### Database Migrations

Migrations are applied automatically via the Supabase MCP tools. The SQL files are in `supabase/migrations/` for reference:

1. `001_elara_core_schema.sql` — Creates all 10 tables with RLS policies
2. `002_elara_shared_memory_policy_and_triggers.sql` — Adds shared memory access policy and updated_at triggers
3. `003_fix_function_search_path.sql` — Sets explicit search_path on trigger function

### Deploying Edge Functions

Edge functions are deployed via the Supabase MCP `deploy_edge_functions` tool. The function sources are in `supabase/functions/`:

- `elara-chat` — Conversational AI responses via Gemini
- `elara-extract` — Structured memory extraction from chat messages
- `elara-suggest` — Gift, date, and gesture suggestions
- `elara-invite` — Partner invitation creation, acceptance, disconnection, share revocation
- `elara-export` — Data export (full JSON download)
- `elara-delete` — Account deletion with cascading cleanup

### Building

```bash
npm run build
```

## Features

### Authentication & Onboarding
- Email/password sign up and sign in via Supabase Auth
- First-time onboarding with AI consent acknowledgment
- Profile setup with display name and optional partner name

### Chat (Primary Screen)
- Natural conversation with Elara via Gemini
- Persistent message history stored in Supabase
- Memory proposals appear as reviewable cards — nothing saved without explicit approval
- Enter to send, Shift+Enter for new line
- Error states with retry, loading indicators, timestamps
- Demo mode clearly labeled when Gemini API key is not configured

### Memories
- Personal memory library with 8 categories
- Search, filter by category/privacy, sort by recent/created/category
- Create, edit, confirm, delete memories
- All memories private by default
- Explicit per-memory sharing with confirmation dialog

### Together (Shared Space)
- Secure partner invitations with expiring, single-use tokens (SHA-256 hashed)
- Both users must authenticate and accept
- View shared memories from your partner
- Revoke individual shares or disconnect entirely
- Disconnecting revokes all related shares
- Graceful empty state when no partner connected

### Thoughtful Suggestions
- Gift ideas, date ideas, thoughtful gestures
- Grounded in accessible memories with explanations of what informed each suggestion
- Asks useful questions when insufficient memories exist
- Never invents preferences or claims certainty about feelings

### Reminders
- Create, edit, complete, delete reminders
- Support for birthdays, anniversaries, occasions, plans
- Timezone-aware timestamps
- Clearly states that push/email delivery is not configured

### Profile & Privacy
- Edit profile (name, partner name, avatar emoji)
- AI processing disclosure with consent tracking
- Notification preference toggles
- Data export (full JSON download via edge function)
- Account deletion with cascading cleanup (revokes shares, disconnects partner, deletes all data)
- Subscription page with honest Free/Plus descriptions

## Security

- **Row Level Security** enabled on every table
- Owner-scoped policies using `auth.uid()` for all personal data
- Messages strictly private — never accessible by partners
- Memory sharing via separate `memory_shares` table (not a boolean flag)
- Shared memories only accessible while both share AND connection are active
- Invitation tokens are cryptographically secure, single-use, expiring, hashed
- All Gemini requests go through edge functions — API keys never exposed to frontend
- Service-role credentials used only in edge functions
- Data export and deletion workflows implemented
- Consent events logged for audit trail
- Security advisor: zero findings

## Database Schema

| Table | Purpose |
|-------|---------|
| `profiles` | User display name, avatar, onboarding, AI consent |
| `couple_connections` | Partner connections with invitation tokens |
| `conversations` | Chat conversation containers |
| `messages` | Individual chat messages (user and AI) |
| `memories` | Structured personal memories with categories |
| `memory_shares` | Recipient-specific sharing records |
| `consent_events` | Audit log for consent actions |
| `reminders` | User reminders for important dates |
| `notification_preferences` | Notification settings |
| `subscriptions` | Free/Plus subscription tracking |

## Free-First Business Model

- **Free**: Personal chat, basic memories, one partner, core sharing, basic suggestions, 100 AI requests/month
- **Plus (future)**: Higher AI limits, enhanced retrieval, advanced suggestions, premium themes

No payment gateway required for the MVP. No fabricated payments or quotas.

## Privacy Disclosure

Conversations are processed by Google Gemini, an external AI provider. The free-tier terms may permit use of submitted data to improve Google's services. Content is not end-to-end encrypted. Users can export and delete all data at any time. Already-viewed information cannot be erased from another person's memory.

## What Requires External Configuration

1. **GEMINI_API_KEY** — Must be set as a Supabase Edge Function secret for live AI responses. Without it, the app runs in demo mode.
2. **Push notifications / email delivery** — Not currently configured. Reminders work in-app only.
3. **Plus subscription** — Architecture is in place but no payment gateway is connected.
