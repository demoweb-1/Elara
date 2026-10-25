// LoveLink sender. Called by a scheduled job once an hour. It only sends when the
// current hour in each user's timezone matches their chosen time, outside quiet hours,
// and within their frequency limit. Notification text never contains private details.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

type Kind = "memory" | "nudge" | "question";

// Fixed, generic copy. Nothing here comes from the user's memories, so the lock screen stays private.
const COPY: Record<Kind, { title: string; body: string }> = {
  memory: { title: "Elara · LoveLink", body: "A little detail, remembered. Revisit it when you're ready." },
  nudge: { title: "Elara · LoveLink", body: "Make a small moment count. Want one simple idea for your partner?" },
  question: { title: "Elara · LoveLink", body: "There's a new conversation idea for you two. Discover it together." },
};

function localHour(timezone: string): number | null {
  try {
    const part = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: timezone })
      .formatToParts(new Date()).find((p) => p.type === "hour");
    const h = Number(part?.value);
    return Number.isNaN(h) ? null : h % 24;
  } catch {
    return null;
  }
}

function inQuiet(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

async function chooseKind(sb: any, userId: string, recent: string[]): Promise<Kind> {
  const { count } = await sb.from("memories").select("id", { count: "exact", head: true }).eq("user_id", userId);
  const { data: conn } = await sb.from("couple_connections").select("id")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`).eq("invitation_status", "accepted").limit(1);
  const available: Kind[] = [];
  if ((count ?? 0) > 0) available.push("memory");
  available.push("nudge");
  if (conn && conn.length > 0) available.push("question");
  const fresh = available.filter((k) => !recent.includes(k));
  const pool = fresh.length > 0 ? fresh : available;
  return pool[Math.floor(Math.random() * pool.length)];
}

Deno.serve(async (req) => {
  if (req.headers.get("x-lovelink-secret") !== Deno.env.get("LOVELINK_CRON_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT")!,
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );

  const { data: settings } = await sb.from("lovelink_settings").select("*").eq("enabled", true).limit(1000);
  const since7 = new Date(Date.now() - 7 * 864e5).toISOString();
  const since20 = new Date(Date.now() - 20 * 36e5).toISOString();
  let sent = 0;
  let skipped = 0;

  for (const s of settings ?? []) {
    const hour = localHour(s.timezone);
    if (hour === null || hour !== s.send_hour || inQuiet(hour, s.quiet_start, s.quiet_end)) { skipped++; continue; }

    const { data: recent } = await sb.from("lovelink_log").select("kind, sent_at")
      .eq("user_id", s.user_id).gte("sent_at", since7).order("sent_at", { ascending: false });
    const log = recent ?? [];
    // At most one LoveLink in 20 hours, and never more than the weekly limit.
    if (log.some((l: any) => l.sent_at >= since20) || log.length >= s.max_per_week) { skipped++; continue; }

    const { data: subs } = await sb.from("push_subscriptions").select("*").eq("user_id", s.user_id);
    if (!subs || subs.length === 0) { skipped++; continue; }

    const kind = await chooseKind(sb, s.user_id, log.slice(0, 3).map((l: any) => l.kind));
    const payload = JSON.stringify({ ...COPY[kind], url: "/Elara/chat", tag: "lovelink" });

    let delivered = false;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_secret } },
          payload,
          { TTL: 86400 },
        );
        delivered = true;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        // The device has unsubscribed or the subscription expired, so remove it.
        if (code === 404 || code === 410) await sb.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }

    if (delivered) {
      await sb.from("lovelink_log").insert({ user_id: s.user_id, kind });
      sent++;
    } else {
      skipped++;
    }
  }

  return Response.json({ sent, skipped });
});
