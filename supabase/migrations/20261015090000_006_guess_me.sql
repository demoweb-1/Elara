-- Guess Me: a two-way discovery round between linked partners.
-- Answers are never readable directly. Everything goes through the functions below,
-- which only reveal a partner's answers once the round is revealed (all four answers in).

CREATE TABLE IF NOT EXISTS guess_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES couple_connections(id) ON DELETE CASCADE,
  question_id text NOT NULL CHECK (char_length(question_id) BETWEEN 1 AND 60),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'revealed')),
  closed_by uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  revealed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS guess_one_open_round ON guess_rounds (connection_id) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS guess_answers (
  round_id uuid NOT NULL REFERENCES guess_rounds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  about text NOT NULL CHECK (about IN ('self', 'guess')),   -- 'self' = my own answer, 'guess' = my prediction of my partner
  choice smallint NOT NULL CHECK (choice BETWEEN 0 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (round_id, user_id, about)
);

-- Lock the tables completely. Only the security-definer functions below can touch them.
ALTER TABLE guess_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE guess_answers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON guess_rounds, guess_answers FROM anon, authenticated;

-- Confirms the caller is an accepted partner of this connection.
CREATE OR REPLACE FUNCTION guess_me_connection(p_connection uuid)
RETURNS couple_connections
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c couple_connections;
BEGIN
  SELECT * INTO c FROM couple_connections
  WHERE id = p_connection AND invitation_status = 'accepted' AND auth.uid() IN (user_a, user_b);
  IF NOT FOUND THEN RAISE EXCEPTION 'not_connected'; END IF;
  RETURN c;
END $$;

-- Builds what the caller is allowed to see. Partner answers appear only after the reveal.
CREATE OR REPLACE FUNCTION guess_me_build_state(p_conn couple_connections)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  partner uuid := CASE WHEN p_conn.user_a = uid THEN p_conn.user_b ELSE p_conn.user_a END;
  r guess_rounds;
  pname text;
  my_self int; my_guess int; their_self int; their_guess int;
BEGIN
  SELECT NULLIF(display_name, '') INTO pname FROM profiles WHERE id = partner;
  -- Oldest round this person has not closed yet, so a pending reveal is never skipped.
  SELECT * INTO r FROM guess_rounds
   WHERE connection_id = p_conn.id AND NOT (uid = ANY(closed_by))
   ORDER BY created_at ASC LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('round', NULL, 'partner_name', COALESCE(pname, 'your partner'));
  END IF;

  SELECT choice INTO my_self FROM guess_answers WHERE round_id = r.id AND user_id = uid AND about = 'self';
  SELECT choice INTO my_guess FROM guess_answers WHERE round_id = r.id AND user_id = uid AND about = 'guess';
  SELECT choice INTO their_self FROM guess_answers WHERE round_id = r.id AND user_id = partner AND about = 'self';
  SELECT choice INTO their_guess FROM guess_answers WHERE round_id = r.id AND user_id = partner AND about = 'guess';

  RETURN jsonb_build_object(
    'round', jsonb_build_object('id', r.id, 'question_id', r.question_id, 'status', r.status),
    'partner_name', COALESCE(pname, 'your partner'),
    'me', jsonb_build_object('self', my_self, 'guess', my_guess),
    'partner_progress', jsonb_build_object(
      'self', EXISTS (SELECT 1 FROM guess_answers WHERE round_id = r.id AND user_id = partner AND about = 'self'),
      'guess', EXISTS (SELECT 1 FROM guess_answers WHERE round_id = r.id AND user_id = partner AND about = 'guess')),
    'reveal', CASE WHEN r.status = 'revealed' THEN jsonb_build_object(
      'my_guess', my_guess, 'partner_self', their_self,
      'partner_guess', their_guess, 'my_self', my_self) ELSE NULL END
  );
END $$;

CREATE OR REPLACE FUNCTION guess_me_state(p_connection uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN guess_me_build_state(guess_me_connection(p_connection));
END $$;

CREATE OR REPLACE FUNCTION guess_me_begin(p_connection uuid, p_question text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c couple_connections;
BEGIN
  c := guess_me_connection(p_connection);
  IF EXISTS (SELECT 1 FROM guess_rounds WHERE connection_id = c.id AND status = 'open') THEN
    RAISE EXCEPTION 'round_in_progress';
  END IF;
  INSERT INTO guess_rounds (connection_id, question_id) VALUES (c.id, p_question);
  RETURN guess_me_build_state(c);
END $$;

CREATE OR REPLACE FUNCTION guess_me_answer(p_connection uuid, p_round uuid, p_about text, p_choice int)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c couple_connections; r guess_rounds; n int;
BEGIN
  c := guess_me_connection(p_connection);
  SELECT * INTO r FROM guess_rounds WHERE id = p_round AND connection_id = c.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'round_not_found'; END IF;
  IF r.status <> 'open' THEN RAISE EXCEPTION 'round_closed'; END IF;
  IF p_about NOT IN ('self', 'guess') OR p_choice IS NULL OR p_choice < 0 OR p_choice > 3 THEN
    RAISE EXCEPTION 'invalid_answer';
  END IF;

  INSERT INTO guess_answers (round_id, user_id, about, choice)
  VALUES (r.id, auth.uid(), p_about, p_choice)
  ON CONFLICT (round_id, user_id, about) DO UPDATE SET choice = EXCLUDED.choice;

  SELECT count(*) INTO n FROM guess_answers WHERE round_id = r.id;
  IF n = 4 THEN
    UPDATE guess_rounds SET status = 'revealed', revealed_at = now() WHERE id = r.id;
  END IF;
  RETURN guess_me_build_state(c);
END $$;

CREATE OR REPLACE FUNCTION guess_me_close(p_connection uuid, p_round uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c couple_connections;
BEGIN
  c := guess_me_connection(p_connection);
  UPDATE guess_rounds SET closed_by = array_append(closed_by, auth.uid())
  WHERE id = p_round AND connection_id = c.id AND status = 'revealed' AND NOT (auth.uid() = ANY(closed_by));
  RETURN guess_me_build_state(c);
END $$;

-- Only signed-in users can call the four public functions. Helpers stay internal.
REVOKE ALL ON FUNCTION guess_me_connection(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION guess_me_build_state(couple_connections) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION guess_me_state(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION guess_me_begin(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION guess_me_answer(uuid, uuid, text, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION guess_me_close(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION guess_me_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION guess_me_begin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION guess_me_answer(uuid, uuid, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION guess_me_close(uuid, uuid) TO authenticated;
