/*
# Elara — Shared Memory Access Policy and Triggers

## Overview
1. Adds a SELECT policy on the memories table so that recipients of an active share
   (through an accepted couple connection) can read shared memories.
2. Adds updated_at trigger function and triggers on all tables with updated_at columns.

## Security Changes
- New policy "select_shared_memories" on memories: allows a recipient to SELECT a memory
  if there exists an active memory_share for that memory through an accepted couple_connection
  where the recipient is one of the connected users.
- This is additive to the existing owner-scoped "select_own_memories" policy.
- Revoking a share (setting status='revoked') or disconnecting a couple (invitation_status='disconnected')
  immediately removes access because the policy requires both conditions to be true.
*/

-- Shared memory access policy (depends on memory_shares + couple_connections existing)
DROP POLICY IF EXISTS "select_shared_memories" ON memories;
CREATE POLICY "select_shared_memories" ON memories FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM memory_shares ms
    JOIN couple_connections cc ON cc.id = ms.connection_id
    WHERE ms.memory_id = memories.id
      AND ms.recipient_id = auth.uid()
      AND ms.status = 'active'
      AND cc.invitation_status = 'accepted'
      AND (cc.user_a = auth.uid() OR cc.user_b = auth.uid())
  )
);

-- updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_updated') THEN
    CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_conversations_updated') THEN
    CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_connections_updated') THEN
    CREATE TRIGGER trg_connections_updated BEFORE UPDATE ON couple_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_memories_updated') THEN
    CREATE TRIGGER trg_memories_updated BEFORE UPDATE ON memories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_reminders_updated') THEN
    CREATE TRIGGER trg_reminders_updated BEFORE UPDATE ON reminders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notif_prefs_updated') THEN
    CREATE TRIGGER trg_notif_prefs_updated BEFORE UPDATE ON notification_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_subscriptions_updated') THEN
    CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;
