import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Disconnect any active connections and revoke shares
    const { data: connections } = await adminClient
      .from('couple_connections')
      .select('id')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .eq('invitation_status', 'accepted');

    if (connections && connections.length > 0) {
      for (const conn of connections) {
        await adminClient.from('memory_shares')
          .update({ status: 'revoked', revoked_at: new Date().toISOString() })
          .eq('connection_id', conn.id).eq('status', 'active');
        await adminClient.from('couple_connections')
          .update({ invitation_status: 'disconnected', disconnected_at: new Date().toISOString() })
          .eq('id', conn.id);
      }
    }

    await Promise.all([
      adminClient.from('reminders').delete().eq('user_id', user.id),
      adminClient.from('memory_shares').delete().eq('owner_id', user.id),
      adminClient.from('consent_events').delete().eq('user_id', user.id),
      adminClient.from('notification_preferences').delete().eq('user_id', user.id),
      adminClient.from('subscriptions').delete().eq('user_id', user.id),
    ]);

    await adminClient.from('memories').delete().eq('user_id', user.id);
    await adminClient.from('conversations').delete().eq('user_id', user.id);
    await adminClient.from('profiles').delete().eq('id', user.id);

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error("Error deleting auth user:", deleteError);
      return new Response(JSON.stringify({ error: "Failed to delete account completely" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Delete function error:", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred during account deletion" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
