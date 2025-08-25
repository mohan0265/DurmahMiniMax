// /netlify/functions/realtime-session.js
// Issues an ephemeral Realtime session token for the browser.
// Env required: OPENAI_API_KEY
// Optional: REALTIME_MODEL, REALTIME_VOICE, TURN_THRESHOLD, TURN_SILENCE_MS, SYSTEM_INSTRUCTIONS

export async function handler(event) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: "Method Not Allowed" };
  }

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Missing OPENAI_API_KEY" }) };
    }

    const body = JSON.parse(event.body || "{}");
    const model = body.model || process.env.REALTIME_MODEL || "gpt-4o-realtime-preview-2024-12-17";
    const voice = body.voice || process.env.REALTIME_VOICE || "verse";

    const threshold = Number(process.env.TURN_THRESHOLD ?? 0.50);          // lower = more sensitive
    const silenceMs = Number(process.env.TURN_SILENCE_MS ?? 700);          // pause before reply
    const instructions = process.env.SYSTEM_INSTRUCTIONS || "Please speak clearly and at a calm, moderate pace. Wait for the user to finish speaking before replying. Keep answers concise and helpful.";

    const resp = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "realtime=v1",
      },
      body: JSON.stringify({
        model,
        voice,
        modalities: ["text", "audio"],
        instructions,
        // Server-side VAD for smooth turns
        turn_detection: { type: "server_vad", threshold, silence_duration_ms: silenceMs },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return { statusCode: resp.status, headers: cors, body: JSON.stringify({ error: "OpenAI session create failed", detail: text }) };
    }

    const json = await resp.json();
    return {
      statusCode: 200,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({
        token: json?.client_secret?.value,
        model,
        voice,
        expires_at: json?.expires_at || null,
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Server error", detail: String(err) }) };
  }
}
