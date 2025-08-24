// /netlify/functions/realtime-session.js
// Issues an ephemeral OpenAI Realtime session token for the browser.
// Env: OPENAI_API_KEY (required), REALTIME_MODEL (optional), REALTIME_VOICE (optional)

export async function handler(event, _context) {
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
      return {
        statusCode: 500,
        headers: cors,
        body: JSON.stringify({ error: "Missing OPENAI_API_KEY" }),
      };
    }

    const { model: bodyModel, voice: bodyVoice } = JSON.parse(event.body || "{}");
    const model =
      bodyModel || process.env.REALTIME_MODEL || "gpt-4o-realtime-preview-2024-12-17";
    const voice = bodyVoice || process.env.REALTIME_VOICE || "verse";

    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
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
        // Let the server do VAD/turn detection (keeps client simple)
        turn_detection: { type: "server_vad", threshold: 0.5, silence_duration_ms: 700 },
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      return {
        statusCode: r.status,
        headers: cors,
        body: JSON.stringify({ error: "OpenAI session create failed", detail: t }),
      };
    }

    const json = await r.json();

    // Return **both** shapes for maximum compatibility:
    // - client_secret.value (OpenAI standard)
    // - token (flat) for older client code
    return {
      statusCode: 200,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({
        client_secret: json?.client_secret || null,
        token: json?.client_secret?.value || null,
        model,
        voice,
        expires_at: json?.expires_at || null,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: "Server error", detail: String(err) }),
    };
  }
}
