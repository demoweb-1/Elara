/*
# Elara Core Schema — Tables, RLS, Indexes

## Overview
Creates foundational tables for the Elara AI relationship memory companion.

## New Tables
1. profiles — User profile data (display name, AI consent, onboarding)
2. couple_connections — Secure partner connections with invitation tokens
3. conversations — Chat conversation containers
4. messages — Individual chat messages
5. memories — Structured personal memories with categories and privacy
6. memory_shares — Recipient-specific memory sharing records
7. consent_events — Audit log for consent actions
8. reminders — User reminders for important dates
9. notification_preferences — User notification settings
10. subscriptions — Free/Plus subscription tracking

## Security
- RLS enabled on ALL tables with owner-scoped policies using auth.uid()
- Messages strictly private to their owner
- Memory sharing uses a separate memory_shares table, never a boolean flag
*/

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  avatar_emoji text DEFAULT '🌿',
  onboarding_completed boolean NOT NULL DEFAULT false,
  partner_name text DEFAULT '',
  relationship_start_date date,
  timezone text DEFAULT 'UTC',
  ai_consent boolean NOT NULL DEFAULT false,
  ai_consent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- COUPLE CONNECTIONS
CREATE TABLE IF NOT EXISTS couple_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  invitation_token_hash text NOT NULL,
  invitation_status text NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  accepted_at timestamptz,
  disconnected_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitation_status_valid CHECK (invitation_status IN ('pending', 'accepted', 'declined', 'disconnected'))
);
CREATE INDEX IF NOT EXISTS idx_connections_user_a ON couple_connections(user_a);
CREATE INDEX IF NOT EXISTS idx_connections_user_b ON couple_connections(user_b);
CREATE INDEX IF NOT EXISTS idx_connections_status ON couple_connections(invitation_status);
CREATE INDEX IF NOT EXISTS idx_connections_token_hash ON couple_connections(invitation_token_hash);
ALTER TABLE couple_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_connections" ON couple_connections;
CREATE POLICY "select_own_connections" ON couple_connections FOR SELECT TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b);
DROP POLICY IF EXISTS "insert_own_connection" ON couple_connections;
CREATE POLICY "insert_own_connection" ON couple_connections FOR INSERT TO authenticated WITH CHECK (auth.uid() = invited_by);
DROP POLICY IF EXISTS "update_own_connection" ON couple_connections;
CREATE POLICY "update_own_connection" ON couple_connections FOR UPDATE TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b) WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

-- CONVERSATIONS
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Conversation with Elara',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_conversations" ON conversations;
CREATE POLICY "select_own_conversations" ON conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_conversations" ON conversations;
CREATE POLICY "insert_own_conversations" ON conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_conversations" ON conversations;
CREATE POLICY "update_own_conversations" ON conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_conversations" ON conversations;
CREATE POLICY "delete_own_conversations" ON conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  proposed_memories jsonb DEFAULT NULL,
  memories_reviewed boolean DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_messages" ON messages;
CREATE POLICY "select_own_messages" ON messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_messages" ON messages;
CREATE POLICY "insert_own_messages" ON messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_messages" ON messages;
CREATE POLICY "update_own_messages" ON messages FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_messages" ON messages;
CREATE POLICY "delete_own_messages" ON messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- MEMORIES
CREATE TABLE IF NOT EXISTS memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('preferences','dislikes','important_dates','habits_routines','communication_preferences','gifts_experiences','meaningful_moments','goals_plans')),
  content text NOT NULL,
  context text,
  confidence real DEFAULT 0.7 CHECK (confidence >= 0 AND confidence <= 1.0),
  source_message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  is_private boolean NOT NULL DEFAULT true,
  last_confirmed_at timestamptz,
  review_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(user_id, category);
CREATE INDEX IF NOT EXISTS idx_memories_private ON memories(user_id, is_private);
CREATE INDEX IF NOT EXISTS idx_memories_search ON memories USING gin(to_tsvector('english', content));
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_memories" ON memories;
CREATE POLICY "select_own_memories" ON memories FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_memories" ON memories;
CREATE POLICY "insert_own_memories" ON memories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_memories" ON memories;
CREATE POLICY "update_own_memories" ON memories FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_memories" ON memories;
CREATE POLICY "delete_own_memories" ON memories FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- MEMORY SHARES
CREATE TABLE IF NOT EXISTS memory_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES couple_connections(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  shared_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shares_memory ON memory_shares(memory_id);
CREATE INDEX IF NOT EXISTS idx_shares_owner ON memory_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_shares_recipient ON memory_shares(recipient_id);
CREATE INDEX IF NOT EXISTS idx_shares_connection ON memory_shares(connection_id);
CREATE INDEX IF NOT EXISTS idx_shares_active ON memory_shares(recipient_id, status);
ALTER TABLE memory_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_shares" ON memory_shares;
CREATE POLICY "select_own_shares" ON memory_shares FOR SELECT TO authenticated USING (auth.uid() = owner_id OR auth.uid() = recipient_id);
DROP POLICY IF EXISTS "insert_own_shares" ON memory_shares;
CREATE POLICY "insert_own_shares" ON memory_shares FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "update_own_shares" ON memory_shares;
CREATE POLICY "update_own_shares" ON memory_shares FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "delete_own_shares" ON memory_shares;
CREATE POLICY "delete_own_shares" ON memory_shares FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- CONSENT EVENTS
CREATE TABLE IF NOT EXISTS consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consent_user ON consent_events(user_id);
ALTER TABLE consent_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_consent" ON consent_events;
CREATE POLICY "select_own_consent" ON consent_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_consent" ON consent_events;
CREATE POLICY "insert_own_consent" ON consent_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- REMINDERS
CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  reminder_type text NOT NULL DEFAULT 'general',
  due_at timestamptz NOT NULL,
  timezone text DEFAULT 'UTC',
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  advance_notice_days integer DEFAULT 7,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_reminders_active ON reminders(user_id, completed) WHERE completed = false;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_reminders" ON reminders;
CREATE POLICY "select_own_reminders" ON reminders FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_reminders" ON reminders;
CREATE POLICY "insert_own_reminders" ON reminders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_reminders" ON reminders;
CREATE POLICY "update_own_reminders" ON reminders FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_reminders" ON reminders;
CREATE POLICY "delete_own_reminders" ON reminders FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- NOTIFICATION PREFERENCES
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  in_app_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT false,
  push_enabled boolean NOT NULL DEFAULT false,
  reminder_notifications boolean NOT NULL DEFAULT true,
  memory_suggestions boolean NOT NULL DEFAULT true,
  partner_updates boolean NOT NULL DEFAULT true,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_notif_prefs" ON notification_preferences;
CREATE POLICY "select_own_notif_prefs" ON notification_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_notif_prefs" ON notification_preferences;
CREATE POLICY "insert_own_notif_prefs" ON notification_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_notif_prefs" ON notification_preferences;
CREATE POLICY "update_own_notif_prefs" ON notification_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  ai_request_count integer NOT NULL DEFAULT 0,
  ai_request_limit integer NOT NULL DEFAULT 100,
  ai_request_reset_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_subscription" ON subscriptions;
CREATE POLICY "select_own_subscription" ON subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_subscription" ON subscriptions;
CREATE POLICY "insert_own_subscription" ON subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_subscription" ON subscriptions;
CREATE POLICY "update_own_subscription" ON subscriptions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
