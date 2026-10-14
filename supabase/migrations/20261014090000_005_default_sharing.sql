-- Likes and dislikes are shared with a linked partner unless the memory is marked private.
-- Other categories still need an explicit share (memory_shares), as before.
DROP POLICY IF EXISTS "select_default_shared_memories" ON memories;
CREATE POLICY "select_default_shared_memories" ON memories FOR SELECT TO authenticated USING (
  is_private = false
  AND category IN ('preferences', 'dislikes')
  AND EXISTS (
    SELECT 1 FROM couple_connections cc
    WHERE cc.invitation_status = 'accepted'
      AND ((cc.user_a = memories.user_id AND cc.user_b = auth.uid())
        OR (cc.user_b = memories.user_id AND cc.user_a = auth.uid()))
  )
);
