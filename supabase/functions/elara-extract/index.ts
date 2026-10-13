const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FALLBACK_MODELS = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-2.5-flash-lite"];

const EXTRACTION_PROMPT = `You are a memory extraction assistant for Elara, a relationship memory companion.

Analyze the user's message and the assistant's response to identify personal details worth remembering as structured memories.

Categories:
- preferences: Things the user or their partner likes (favorite food, music, activities)
- dislikes: Things they don't like or avoid
- important_dates: Birthdays, anniversaries, significant dates
- habits_routines: Daily habits, routines, patterns
- communication_preferences: How they prefer to communicate or be comforted
- gifts_experiences: Gift ideas mentioned, experiences they want
- meaningful_moments: Special moments, memories, stories shared
- goals_plans: Future plans, aspirations, things they want to do

Guidelines:
- Only extract genuine, stable information — not jokes, temporary statements, or uncertain details.
- If the user says "maybe" or "I think" about something, set confidence lower (0.4-0.6).
- If the user states something clearly, set confidence higher (0.7-0.9).
- Do NOT extract information about people other than the user or their explicitly mentioned partner.
- Do NOT extract sensitive personal information (health conditions, passwords, financial details).
- If there's nothing worth remembering, return an empty array.
- Keep content concise — one clear sentence per memory.

Return JSON in this exact format:
{"memories": [{"category": "preferences", "content": "Short description", "context": "Brief context", "confidence": 0.8}]}

Return ONLY valid JSON, no markdown or extra text.`;

async function callGemini(apiKey: string, model: string, contents: unknown[]) {
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  return await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024, responseMimeType: "application/json" },
    }),
  });
}

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

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      console.error("GEMINI_API_KEY secret is not set");
      return new Response(JSON.stringify({ memories: [], demo: true, error: "AI service not configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { message, assistantResponse, existingMemories = [] } = body;

    if (!message) {
      return new Response(JSON.stringify({ memories: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existingContext = existingMemories.length > 0
      ? `\n\nAlready known memories (avoid duplicates):\n${existingMemories.map((m: string) => `- ${m}`).join("\n")}`
      : "";

    const contents = [{
      role: "user",
      parts: [{ text: `${EXTRACTION_PROMPT}${existingContext}\n\nUser message: ${message}\nAssistant response: ${assistantResponse}` }],
    }];

    const configuredModel = Deno.env.get("GEMINI_MODEL");
    const modelsToTry = configuredModel
      ? [configuredModel, ...FALLBACK_MODELS.filter((m) => m !== configuredModel)]
      : FALLBACK_MODELS;

    let geminiResponse: Response | null = null;

    for (const model of modelsToTry) {
      geminiResponse = await callGemini(apiKey, model, contents);
      if (geminiResponse.ok) break;
      const errorText = await geminiResponse.text();
      console.error(`Extract: model ${model} failed with status ${geminiResponse.status}`);
      if (geminiResponse.status === 404 || geminiResponse.status === 400) continue;
      break;
    }

    if (!geminiResponse || !geminiResponse.ok) {
      console.error("Extract: all models failed");
      return new Response(JSON.stringify({ memories: [], error: "Memory extraction failed" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiResponse.json();
    const responseText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      return new Response(JSON.stringify({ memories: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: { memories?: unknown[] };
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return new Response(JSON.stringify({ memories: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const validCategories = ['preferences','dislikes','important_dates','habits_routines','communication_preferences','gifts_experiences','meaningful_moments','goals_plans'];
    const memories = Array.isArray(parsed.memories) ? parsed.memories : [];
    const validMemories = memories.filter((m: any) => {
      return m && typeof m.content === 'string' && m.content.trim().length > 0 && validCategories.includes(m.category);
    }).map((m: any) => ({
      category: m.category,
      content: String(m.content).slice(0, 500),
      context: m.context ? String(m.context).slice(0, 300) : null,
      confidence: typeof m.confidence === 'number' ? Math.min(1, Math.max(0, m.confidence)) : 0.7,
    }));

    return new Response(JSON.stringify({ memories: validMemories }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Extract function error:", err.message || err);
    return new Response(JSON.stringify({ memories: [], error: "An unexpected error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
