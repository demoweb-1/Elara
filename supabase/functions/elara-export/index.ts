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

    const [profile, conversations, messages, memories, memoryShares, reminders, notifPrefs, consentEvents, subscription] = await Promise.all([
      adminClient.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      adminClient.from('conversations').select('*').eq('user_id', user.id),
      adminClient.from('messages').select('id, conversation_id, role, content, is_demo, created_at').eq('user_id', user.id),
      adminClient.from('memories').select('*').eq('user_id', user.id),
      adminClient.from('memory_shares').select('*').eq('owner_id', user.id),
      adminClient.from('reminders').select('*').eq('user_id', user.id),
      adminClient.from('notification_preferences').select('*').eq('user_id', user.id).maybeSingle(),
      adminClient.from('consent_events').select('*').eq('user_id', user.id),
      adminClient.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      user: { id: user.id, email: user.email },
      profile: profile.data,
      conversations: conversations.data,
      messages: messages.data,
      memories: memories.data,
      memory_shares: memoryShares.data,
      reminders: reminders.data,
      notification_preferences: notifPrefs.data,
      consent_events: consentEvents.data,
      subscription: subscription.data,
      note: "This export contains all data associated with your Elara account. Messages and memories you have shared with a partner through the memory sharing feature are noted in the memory_shares section. Already-viewed information cannot be erased from another person's memory.",
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Export function error:", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred during export" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
