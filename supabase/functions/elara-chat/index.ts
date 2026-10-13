const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const FALLBACK_MODELS = ["gemini-3.1-flash-lite", "gemini-flash-latest"];

interface ChatRequest {
  message: string;
  conversationHistory?: { role: string; content: string }[];
  memories?: { category: string; content: string }[];
  partnerMemories?: { category: string; content: string }[];
  userName?: string;
  partnerName?: string;
}

const SYSTEM_PROMPT = `You are Elara, a warm, intelligent, gentle, and thoughtful AI companion designed to help people remember meaningful personal details about their relationships.

Your personality:
- Warm but not effusive. You care genuinely.
- Intelligent and observant. You notice details worth remembering.
- Gentle and emotionally considerate. Never preachy or judgmental.
- Concise. You prefer meaningful brevity over lengthy responses.
- You ask thoughtful follow-up questions when appropriate.
- You never give manipulative relationship advice, psychological diagnoses, or predictions about loyalty or fidelity.

Your guidelines:
- Use the user's name naturally when appropriate.
- Reference relevant memories contextually — don't force them.
- If the user mentions something worth remembering, you can gently note it. But don't be pushy about saving memories.
- Keep responses conversational and natural — usually 1-4 sentences unless the user is clearly asking for more depth.
- If you don't have enough context, ask a gentle clarifying question.
- Never claim to know things you haven't been told.
- Do not encourage users to share sensitive personal information unnecessarily.`;

function buildContents(body: ChatRequest) {
  const { message, conversationHistory = [], memories = [], partnerMemories = [], userName, partnerName } = body;

  let contextBlock = "";
  if (memories.length > 0) {
    contextBlock += `\n\nRelevant memories about ${userName || "the user"}:\n`;
    contextBlock += memories.map((m) => `- [${m.category}] ${m.content}`).join("\n");
  }
  if (partnerMemories.length > 0 && partnerName) {
    contextBlock += `\n\nRelevant shared memories about ${partnerName}:\n`;
    contextBlock += partnerMemories.map((m) => `- [${m.category}] ${m.content}`).join("\n");
  }

  const recentHistory = conversationHistory.slice(-6);

  return [
    { role: "user", parts: [{ text: `${SYSTEM_PROMPT}\n\nYou are talking to ${userName || "a user"}${partnerName ? ` who is in a relationship with ${partnerName}` : ""}.${contextBlock}` }] },
    { role: "model", parts: [{ text: `Hello ${userName || "there"}, I'm Elara. I'm here to listen and remember what matters to you.` }] },
    ...recentHistory.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];
}

function sseResponse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

async function tryStreamGemini(apiKey: string, model: string, contents: unknown[]) {
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  return await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: { temperature: 0.8, maxOutputTokens: 512, topP: 0.9 },
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
      return new Response(JSON.stringify({
        error: "AI service is not configured. Please ask the administrator to set the GEMINI_API_KEY secret.",
        demo: true,
      }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body: ChatRequest = await req.json();

    if (!body.message || typeof body.message !== "string") {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contents = buildContents(body);

    const configuredModel = Deno.env.get("GEMINI_MODEL");
    const modelsToTry = configuredModel
      ? [configuredModel, ...FALLBACK_MODELS.filter((m) => m !== configuredModel)]
      : FALLBACK_MODELS;

    let geminiResponse: Response | null = null;
    let usedModel = "";

    for (const model of modelsToTry) {
      geminiResponse = await tryStreamGemini(apiKey, model, contents);
      if (geminiResponse.ok) {
        usedModel = model;
        break;
      }
      const errorText = await geminiResponse.text();
      console.error(`Chat stream: model ${model} failed with status ${geminiResponse.status}`);

      if (geminiResponse.status === 404 || geminiResponse.status === 400) {
        continue;
      }

      if (geminiResponse.status === 429) {
        return new Response(JSON.stringify({
          error: "The AI service rate limit has been reached. Please try again in a moment.",
        }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (geminiResponse.status === 403) {
        return new Response(JSON.stringify({
          error: "The AI service quota may be exhausted or the API key may be invalid.",
        }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      break;
    }

    if (!geminiResponse || !geminiResponse.ok) {
      console.error("Chat stream: all models failed");
      return new Response(JSON.stringify({
        error: "The AI service encountered an error. Please try again.",
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Stream Gemini SSE → client SSE, extracting text chunks
    const geminiBody = geminiResponse.body;
    if (!geminiBody) {
      return new Response(JSON.stringify({
        error: "The AI service returned an empty stream.",
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    let hasSentText = false;
    let buffer = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of geminiBody) {
            buffer += decoder.decode(chunk, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;

              try {
                const parsed = JSON.parse(jsonStr);
                const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  hasSentText = true;
                  controller.enqueue(encoder.encode(sseEvent({ text })));
                }

                const finishReason = parsed?.candidates?.[0]?.finishReason;
                if (finishReason === "SAFETY" && !hasSentText) {
                  controller.enqueue(encoder.encode(sseEvent({
                    error: "The AI service filtered the response for safety. Please try rephrasing your message.",
                  })));
                }
              } catch {
                // partial JSON, skip
              }
            }
          }

          // flush remaining buffer
          if (buffer.startsWith("data: ")) {
            const jsonStr = buffer.slice(6).trim();
            if (jsonStr) {
              try {
                const parsed = JSON.parse(jsonStr);
                const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  controller.enqueue(encoder.encode(sseEvent({ text })));
                  hasSentText = true;
                }
              } catch {
                // ignore
              }
            }
          }

          if (!hasSentText) {
            controller.enqueue(encoder.encode(sseEvent({
              error: "The AI service returned an empty response. Please try again.",
            })));
          }

          controller.enqueue(encoder.encode(sseEvent({ done: true })));
          controller.close();
        } catch (err) {
          console.error("Chat stream error:", err.message || err);
          try {
            controller.enqueue(encoder.encode(sseEvent({
              error: "Stream interrupted. Please try again.",
            })));
            controller.close();
          } catch {
            // controller already closed
          }
        }
      },
    });

    return sseResponse(stream);
  } catch (err) {
    console.error("Chat function error:", err.message || err);
    return new Response(JSON.stringify({
      error: "An unexpected error occurred. Please try again.",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
