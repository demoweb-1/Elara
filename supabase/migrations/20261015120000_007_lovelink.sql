-- LoveLink, phase 1: push subscriptions, per-user settings, and a send log for frequency limits.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth_secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lovelink_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  send_hour smallint NOT NULL DEFAULT 18 CHECK (send_hour BETWEEN 0 AND 23),
  quiet_start smallint NOT NULL DEFAULT 22 CHECK (quiet_start BETWEEN 0 AND 23),
  quiet_end smallint NOT NULL DEFAULT 8 CHECK (quiet_end BETWEEN 0 AND 23),
  max_per_week smallint NOT NULL DEFAULT 3 CHECK (max_per_week BETWEEN 1 AND 7),
  timezone text NOT NULL DEFAULT 'UTC',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lovelink_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('memory', 'nudge', 'question')),
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lovelink_log_user_time ON lovelink_log (user_id, sent_at DESC);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lovelink_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE lovelink_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own push subscriptions" ON push_subscriptions;
CREATE POLICY "own push subscriptions" ON push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own lovelink settings" ON lovelink_settings;
CREATE POLICY "own lovelink settings" ON lovelink_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own lovelink log" ON lovelink_log;
CREATE POLICY "own lovelink log" ON lovelink_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions, lovelink_settings TO authenticated;
GRANT SELECT ON lovelink_log TO authenticated;
