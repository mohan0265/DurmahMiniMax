// /netlify/functions/realtime-session.js
// Issues an ephemeral OpenAI Realtime session token to the browser.
// POST only. CORS allowed for browser usage.

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
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Missing OPENAI_API_KEY" }) };
    }

    const body = JSON.parse(event.body || "{}");
    const model = body.model || process.env.REALTIME_MODEL || "gpt-4o-realtime-preview-2024-12-17";
    const voice = body.voice || process.env.REALTIME_VOICE || "verse";

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
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return { statusCode: resp.status, headers: cors, body: JSON.stringify({ error: "OpenAI session create failed", detail }) };
    }

    const json = await resp.json();
    return {
      statusCode: 200,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({
        token: json?.client_secret?.value || null,
        model,
        voice,
        expires_at: json?.expires_at ?? null,
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Server error", detail: String(err) }) };
  }
}
