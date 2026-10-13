const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FALLBACK_MODELS = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-2.5-flash-lite"];

const SUGGEST_PROMPT = `You are Elara's thoughtful suggestions engine. You help people care more thoughtfully for their partner based on explicitly shared memories.

Guidelines:
- Ground every suggestion in the memories provided. If a suggestion draws on a specific memory, mention which detail informed it.
- Never invent preferences or claim certainty about feelings.
- If relevant memories are unavailable, say so and ask a useful question instead.
- Keep suggestions practical, specific, and actionable.
- Do not suggest expensive or extravagant items unless the user's memories indicate that's appropriate.
- Be warm but not over-the-top.

Return suggestions as JSON:
{"suggestions": [{"title": "Short title", "description": "2-3 sentence description", "basedOn": ["Which memories informed this"]}], "hasData": true}

If there aren't enough memories to make grounded suggestions, return:
{"suggestions": [], "hasData": false, "question": "A useful question to ask instead"}

Return ONLY valid JSON.`;

async function callGemini(apiKey: string, model: string, contents: unknown[]) {
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  return await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024, responseMimeType: "application/json" },
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
      return new Response(JSON.stringify({ suggestions: [], hasData: false, demo: true, error: "AI service not configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { type, partnerName, memories = [], partnerMemories = [] } = body;

    const typeLabels: Record<string, string> = {
      gift: "gift ideas", date: "date ideas", gesture: "thoughtful gestures", general: "thoughtful suggestions",
    };

    const memoryContext = memories.length > 0
      ? `\n\nMemories about the user:\n${memories.map((m: any) => `- [${m.category}] ${m.content}`).join("\n")}`
      : "";
    const partnerContext = partnerMemories.length > 0
      ? `\n\nShared memories about ${partnerName || "their partner"}:\n${partnerMemories.map((m: any) => `- [${m.category}] ${m.content}`).join("\n")}`
      : "";

    const contents = [{
      role: "user",
      parts: [{ text: `${SUGGEST_PROMPT}\n\nSuggestion type: ${typeLabels[type] || typeLabels.general}\nPartner name: ${partnerName || "Not specified"}${memoryContext}${partnerContext}` }],
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
      console.error(`Suggest: model ${model} failed with status ${geminiResponse.status}`);
      if (geminiResponse.status === 404 || geminiResponse.status === 400) continue;
      break;
    }

    if (!geminiResponse || !geminiResponse.ok) {
      console.error("Suggest: all models failed");
      return new Response(JSON.stringify({ suggestions: [], hasData: false, error: "The AI service encountered an error" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiResponse.json();
    const responseText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      return new Response(JSON.stringify({ suggestions: [], hasData: false, error: "Empty response from AI service" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return new Response(JSON.stringify({ suggestions: [], hasData: false }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Suggest function error:", err.message || err);
    return new Response(JSON.stringify({ suggestions: [], hasData: false, error: "An unexpected error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
