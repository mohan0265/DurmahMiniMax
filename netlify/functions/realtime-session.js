// /netlify/functions/realtime-session.js
// Issues ephemeral token for OpenAI Realtime (used with WebRTC/SDP).
// Also sets persona + server VAD for smoother turn-taking.

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
    const voice = body.voice || process.env.REALTIME_VOICE || "verse";

    const instructions = `
You are Durmah Legal Buddy, a friendly, concise assistant for general legal guidance in Singapore.
Speak naturally and conversationally, in short sentences. Offer practical next steps and plain-language explanations.
If a question truly requires a licensed lawyer, mention it briefly at the end—after giving helpful context and steps.
Avoid saying "I cannot help" unless safety requires it.
`;

    const turn_detection = {
      type: "server_vad",
      threshold: 0.45,           // raise to 0.5 if it still jumps in too early
      silence_duration_ms: 500,  // raise to 650 for longer wait before it replies
      prefix_padding_ms: 200,
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
        // ⛔ removed invalid "input_audio_format"
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
