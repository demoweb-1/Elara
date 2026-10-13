/*
# Partner Connection Redesign — Schema Changes

## Overview
Upgrades the couple_connections table to support the redesigned partner connection feature:
- Separate pairing codes (in addition to invitation tokens)
- Email no longer required for invitations
- Secure retrieval of pending invitations
- One-active-partner enforcement at the database level

## Changes to couple_connections
1. Add `pairing_code_hash` (text) — SHA-256 hash of the human-readable pairing code
2. Make `invited_email` nullable — email is no longer required to create an invitation
3. Add `pairing_code_display` (text) — a non-secret hint showing which code was generated (the code itself is returned once to the inviter and not stored in plaintext)

## Security
- RLS policies updated to allow users to read their own connections (as inviter or invitee)
- All mutations go through the edge function using service-role key
- Pairing codes are hashed using SHA-256, never stored in plaintext
- The inviter receives the raw pairing code once at creation time
*/

-- Add pairing_code_hash column
ALTER TABLE couple_connections ADD COLUMN IF NOT EXISTS pairing_code_hash text;

-- Make invited_email nullable (was NOT NULL)
ALTER TABLE couple_connections ALTER COLUMN invited_email DROP NOT NULL;

-- Add index for pairing_code_hash lookups
CREATE INDEX IF NOT EXISTS idx_connections_pairing_code_hash ON couple_connections(pairing_code_hash);

-- Add a partial unique index to enforce one active connection per user (user_a side)
-- This prevents a user from having multiple pending/accepted connections as inviter
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_inviter 
  ON couple_connections(user_a) 
  WHERE invitation_status IN ('pending', 'accepted');

-- Add a partial unique index to enforce one active connection per user (user_b side)
-- This prevents a user from having multiple accepted connections as invitee
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_invitee 
  ON couple_connections(user_b) 
  WHERE invitation_status = 'accepted';
