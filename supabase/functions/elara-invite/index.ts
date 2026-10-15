import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-app-url",
};

// Approved application origins — the X-App-Url header is only trusted if it matches one of these.
const APPROVED_ORIGINS = [
  "https://appelara.netlify.app",
  "https://demoweb-1.github.io/Elara",
  "https://elara-ai-relationshi-z6nf.bolt.host",
  "http://localhost:5173",
];

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generatePairingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  return Array.from(array).map((b) => chars[b % chars.length]).join('');
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// App URL is passed from the frontend via a header, or we fall back to constructing
// it from the request's origin (which gives us the edge function URL on Supabase,
// not the app URL). The frontend always sends APP_URL header.
function getAppUrl(req: Request): string {
  const appUrlHeader = req.headers.get("x-app-url");
  if (appUrlHeader) {
    const normalized = appUrlHeader.replace(/\/$/, "").toLowerCase();
    // Return the approved entry itself so its capitalisation is kept (GitHub Pages paths are case-sensitive).
    const approved = APPROVED_ORIGINS.find((o) => normalized === o.toLowerCase());
    if (approved) return approved;
  }
  // Fallback: use the first approved origin, or the request origin
  return APPROVED_ORIGINS[0] || new URL(req.url).origin;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action;
    const authHeader = req.headers.get("Authorization");

    // check_invite is public: it only says whether a link is still valid and never returns secrets.
    // Every other action needs a signed-in user.
    // deno-lint-ignore no-explicit-any
    let user: any = null;
    if (action !== "check_invite") {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: authedUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !authedUser) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      user = authedUser;
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // CREATE: Generate a new invitation with token + pairing code
    if (action === "create") {
      const invitedEmail = body.invitedEmail || null;

      // Check for existing active or pending connection
      const { data: existing } = await adminClient
        .from('couple_connections')
        .select('id, invitation_status')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .in('invitation_status', ['pending', 'accepted']);

      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({
          error: "You already have an active or pending connection. Disconnect or revoke the pending invitation first.",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const rawToken = generateToken();
      const tokenHash = await hashToken(rawToken);
      const pairingCode = generatePairingCode();
      const pairingCodeHash = await hashToken(pairingCode);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: conn, error: connError } = await adminClient
        .from('couple_connections')
        .insert({
          user_a: user.id,
          invited_by: user.id,
          invited_email: invitedEmail ? invitedEmail.toLowerCase().trim() : null,
          invitation_token_hash: tokenHash,
          pairing_code_hash: pairingCodeHash,
          invitation_status: 'pending',
          expires_at: expiresAt,
        })
        .select('*')
        .single();

      if (connError) {
        console.error("Create invitation error:", connError.message);
        return new Response(JSON.stringify({ error: "Failed to create invitation" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from('consent_events').insert({
        user_id: user.id, event_type: 'partner_connect',
        details: { connection_id: conn.id, action: 'invitation_created' },
      });

      const appUrl = getAppUrl(req);
      const inviteUrl = `${appUrl}/invite/${rawToken}`;

      return new Response(JSON.stringify({
        connection: { id: conn.id, invitation_status: conn.invitation_status, expires_at: conn.expires_at },
        inviteUrl,
        token: rawToken,
        pairingCode,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET_PENDING: Retrieve the inviter's current pending invitation
    if (action === "get_pending") {
      const { data: pending } = await adminClient
        .from('couple_connections')
        .select('id, invitation_status, expires_at, created_at')
        .eq('user_a', user.id)
        .eq('invitation_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!pending) {
        return new Response(JSON.stringify({ pending: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if expired
      if (new Date(pending.expires_at) < new Date()) {
        await adminClient.from('couple_connections')
          .update({ invitation_status: 'disconnected', disconnected_at: new Date().toISOString() })
          .eq('id', pending.id);
        return new Response(JSON.stringify({ pending: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // We can't return the raw token or pairing code (they weren't stored in plaintext)
      // So we return the connection metadata only. The inviter can revoke and create a new one
      // if they need the code/link again. This is a deliberate security trade-off.
      return new Response(JSON.stringify({
        pending: {
          id: pending.id,
          expires_at: pending.expires_at,
          created_at: pending.created_at,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // REVOKE: Revoke a pending invitation
    if (action === "revoke") {
      const { connectionId } = body;
      if (!connectionId) {
        return new Response(JSON.stringify({ error: "Connection ID is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: conn } = await adminClient
        .from('couple_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('user_a', user.id)
        .eq('invitation_status', 'pending')
        .maybeSingle();

      if (!conn) {
        return new Response(JSON.stringify({ error: "Pending invitation not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from('couple_connections')
        .update({ invitation_status: 'disconnected', disconnected_at: new Date().toISOString() })
        .eq('id', connectionId);

      await adminClient.from('consent_events').insert({
        user_id: user.id, event_type: 'partner_disconnect',
        details: { connection_id: connectionId, action: 'invitation_revoked' },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CHECK_INVITE: Validate an invitation token (public, for landing page)
    if (action === "check_invite") {
      const { token } = body;
      if (!token) {
        return new Response(JSON.stringify({ valid: false }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenHash = await hashToken(token);
      const { data: conn } = await adminClient
        .from('couple_connections')
        .select('id, invitation_status, expires_at, user_a')
        .eq('invitation_token_hash', tokenHash)
        .maybeSingle();

      if (!conn) {
        return new Response(JSON.stringify({ valid: false }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (conn.invitation_status !== 'pending') {
        return new Response(JSON.stringify({
          valid: false, status: conn.invitation_status,
          reason: conn.invitation_status === 'accepted' ? 'accepted' : 'revoked',
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (new Date(conn.expires_at) < new Date()) {
        return new Response(JSON.stringify({ valid: false, status: 'expired', reason: 'expired' }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get inviter's profile
      const { data: inviterProfile } = await adminClient
        .from('profiles')
        .select('display_name, avatar_emoji')
        .eq('id', conn.user_a)
        .maybeSingle();

      return new Response(JSON.stringify({
        valid: true,
        status: 'pending',
        inviterName: inviterProfile?.display_name || 'Someone',
        inviterEmoji: inviterProfile?.avatar_emoji || '🌿',
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // VALIDATE_CODE: Validate a pairing code against an invitation token
    if (action === "validate_code") {
      const { token, pairingCode } = body;
      if (!token || !pairingCode) {
        return new Response(JSON.stringify({ valid: false, error: "Token and pairing code are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenHash = await hashToken(token);
      const pairingCodeHash = await hashToken(pairingCode.toUpperCase().trim());

      const { data: conn } = await adminClient
        .from('couple_connections')
        .select('id, invitation_status, expires_at, user_a, pairing_code_hash')
        .eq('invitation_token_hash', tokenHash)
        .maybeSingle();

      if (!conn) {
        return new Response(JSON.stringify({ valid: false, error: "Invalid invitation" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (conn.invitation_status !== 'pending') {
        return new Response(JSON.stringify({ valid: false, error: "This invitation has already been used or revoked" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new Date(conn.expires_at) < new Date()) {
        return new Response(JSON.stringify({ valid: false, error: "This invitation has expired" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (conn.user_a === user.id) {
        return new Response(JSON.stringify({ valid: false, error: "You cannot accept your own invitation" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (conn.pairing_code_hash !== pairingCodeHash) {
        return new Response(JSON.stringify({ valid: false, error: "The pairing code does not match" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if the user already has an active connection
      const { data: userConns } = await adminClient
        .from('couple_connections')
        .select('id')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .eq('invitation_status', 'accepted');

      if (userConns && userConns.length > 0) {
        return new Response(JSON.stringify({
          valid: false,
          error: "You are already connected to a partner. Disconnect first to accept a new invitation.",
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Get inviter's profile for confirmation display
      const { data: inviterProfile } = await adminClient
        .from('profiles')
        .select('display_name, avatar_emoji')
        .eq('id', conn.user_a)
        .maybeSingle();

      return new Response(JSON.stringify({
        valid: true,
        inviterName: inviterProfile?.display_name || 'Someone',
        inviterEmoji: inviterProfile?.avatar_emoji || '🌿',
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ACCEPT: Accept an invitation with token + pairing code (after confirmation)
    if (action === "accept") {
      const { token, pairingCode } = body;
      if (!token || !pairingCode) {
        return new Response(JSON.stringify({ error: "Token and pairing code are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenHash = await hashToken(token);
      const pairingCodeHash = await hashToken(pairingCode.toUpperCase().trim());

      const { data: conn } = await adminClient
        .from('couple_connections')
        .select('*')
        .eq('invitation_token_hash', tokenHash)
        .eq('invitation_status', 'pending')
        .maybeSingle();

      if (!conn) {
        return new Response(JSON.stringify({ error: "Invalid or already used invitation" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new Date(conn.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "This invitation has expired" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (conn.user_a === user.id) {
        return new Response(JSON.stringify({ error: "You cannot accept your own invitation" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (conn.pairing_code_hash !== pairingCodeHash) {
        return new Response(JSON.stringify({ error: "The pairing code does not match" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if the user already has an active connection
      const { data: userConns } = await adminClient
        .from('couple_connections')
        .select('id')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .eq('invitation_status', 'accepted');

      if (userConns && userConns.length > 0) {
        return new Response(JSON.stringify({ error: "You are already connected to a partner" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Atomic update with status guard to prevent race conditions
      const { data: updated, error: updateError } = await adminClient
        .from('couple_connections')
        .update({
          user_b: user.id,
          invitation_status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', conn.id)
        .eq('invitation_status', 'pending')
        .select('*')
        .maybeSingle();

      if (updateError || !updated) {
        return new Response(JSON.stringify({
          error: "Failed to accept invitation. It may have already been accepted by someone else.",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await adminClient.from('consent_events').insert({
        user_id: user.id, event_type: 'partner_connect',
        details: { connection_id: conn.id, action: 'accepted' },
      });

      return new Response(JSON.stringify({ connection: updated, success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DISCONNECT: End an active connection
    if (action === "disconnect") {
      const { connectionId } = body;
      if (!connectionId) {
        return new Response(JSON.stringify({ error: "Connection ID is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: conn } = await adminClient
        .from('couple_connections')
        .select('*')
        .eq('id', connectionId)
        .maybeSingle();

      if (!conn || (conn.user_a !== user.id && conn.user_b !== user.id)) {
        return new Response(JSON.stringify({ error: "Connection not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from('couple_connections')
        .update({ invitation_status: 'disconnected', disconnected_at: new Date().toISOString() })
        .eq('id', connectionId);

      await adminClient.from('memory_shares')
        .update({ status: 'revoked', revoked_at: new Date().toISOString() })
        .eq('connection_id', connectionId)
        .eq('status', 'active');

      await adminClient.from('consent_events').insert({
        user_id: user.id, event_type: 'partner_disconnect',
        details: { connection_id: connectionId },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // REVOKE_SHARE: Revoke a single memory share
    if (action === "revoke_share") {
      const { shareId } = body;
      if (!shareId) {
        return new Response(JSON.stringify({ error: "Share ID is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: share } = await adminClient
        .from('memory_shares')
        .select('*')
        .eq('id', shareId)
        .maybeSingle();

      if (!share || share.owner_id !== user.id) {
        return new Response(JSON.stringify({ error: "Share not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from('memory_shares')
        .update({ status: 'revoked', revoked_at: new Date().toISOString() })
        .eq('id', shareId);
      await adminClient.from('memories').update({ is_private: true }).eq('id', share.memory_id);

      await adminClient.from('consent_events').insert({
        user_id: user.id, event_type: 'memory_share_revoked',
        details: { share_id: shareId, memory_id: share.memory_id },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET_CONNECTION: Get full connection details for connected state
    if (action === "get_connection") {
      const { data: conn } = await adminClient
        .from('couple_connections')
        .select('*')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .in('invitation_status', ['accepted', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!conn) {
        return new Response(JSON.stringify({ connection: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const partnerId = conn.user_a === user.id ? conn.user_b : conn.user_a;
      let partnerProfile = null;
      if (partnerId && conn.invitation_status === 'accepted') {
        const { data: pp } = await adminClient
          .from('profiles')
          .select('display_name, avatar_emoji')
          .eq('id', partnerId)
          .maybeSingle();
        partnerProfile = pp;
      }

      return new Response(JSON.stringify({
        connection: conn,
        partnerName: partnerProfile?.display_name || null,
        partnerEmoji: partnerProfile?.avatar_emoji || null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Invite function error:", err.message || err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
