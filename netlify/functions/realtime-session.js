// /netlify/functions/realtime-session.js
// Issues ephemeral token with tuned turn-detection (server VAD) and persona instructions.

export async function handler(event, _context) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: "Method Not Allowed" };
  }

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "Missing OPENAI_API_KEY" }) };
    }

    const body = JSON.parse(event.body || "{}");
    const model = body.model || process.env.REALTIME_MODEL || "gpt-4o-realtime-preview-2024-12-17";
    const voice = body.voice || process.env.REALTIME_VOICE || "verse"; // good natural voice

    // ✅ Persona: sound like a helpful legal buddy (don’t reflexively deflect)
    const instructions = `
You are Durmah Legal Buddy, a friendly, concise assistant for general legal guidance in Singapore.
Speak naturally and conversationally, in short sentences. Offer practical next steps, plain-language explanations,
and helpful context. Avoid fear-mongering. If a question requires a licensed lawyer, say so briefly and still give
actionable, educational guidance first (what to ask, what to prepare). Do not say "I cannot help" unless safety requires it.
`;

    // ✅ Faster turn-taking with server VAD (lower silence + modest sensitivity)
    const turn_detection = {
      type: "server_vad",
      // Lower = more sensitive to speech start; tune between 0.3–0.6
      threshold: 0.45,
      // Keep a little pre-roll so replies sound snappy
      prefix_padding_ms: 200,
      // How long of silence before cutting off your turn
      silence_duration_ms: 450,
    };

    const resp = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "realtime=v1",
      },
      body: JSON.stringify({
        model,
        voice,
        modalities: ["text", "audio"],
        input_audio_format: { type: "webrtc" },
        instructions,
        turn_detection,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return { statusCode: resp.status, headers: corsHeaders, body: JSON.stringify({ error: "OpenAI session create failed", detail: text }) };
    }

    const json = await resp.json();
    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        token: json?.client_secret?.value,
        model,
        voice,
        expires_at: json?.expires_at || null,
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "Server error", detail: String(err) }) };
  }
}
