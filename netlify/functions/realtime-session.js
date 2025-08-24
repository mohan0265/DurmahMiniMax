// /netlify/functions/realtime-session.js
// Netlify Function: issues an ephemeral Realtime session token for the browser.
// Requires env: OPENAI_API_KEY
// Optional env: REALTIME_MODEL (default: gpt-4o-realtime-preview-2024-12-17)
//               REALTIME_VOICE (default: "verse")

export async function handler(event, _context) {
  // Basic CORS
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
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing OPENAI_API_KEY" }),
      };
    }

    const { model: bodyModel, voice: bodyVoice } = JSON.parse(event.body || "{}");
    const model =
      bodyModel || process.env.REALTIME_MODEL || "gpt-4o-realtime-preview-2024-12-17";
    const voice = bodyVoice || process.env.REALTIME_VOICE || "verse";

    // Create a short-lived client_secret for the browser
    const resp = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "realtime=v1",
      },
      body: JSON.stringify({
        model,
        voice,                  // TTS voice to use for the remote audio track
        modalities: ["text","audio"],
        // You can tweak config below as needed:
        // "input_audio_format": { "type": "webrtc" },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return {
        statusCode: resp.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: "OpenAI session create failed", detail: text }),
      };
    }

    const json = await resp.json();
    // json.client_secret.value is the ephemeral token the browser will use
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
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Server error", detail: String(err) }),
    };
  }
}
