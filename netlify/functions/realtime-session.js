// /netlify/functions/realtime-session.js
// Issues a short-lived OpenAI Realtime *client secret* for the browser.
// Returns: { token, model, voice, expires_at }

export async function handler(event) {
  // Allow POST only (the client calls POST)
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  // Basic CORS (optional)
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return {
        statusCode: 500,
        headers: cors,
        body: JSON.stringify({ error: "Missing OPENAI_API_KEY" }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const model =
      body.model ||
      process.env.VITE_REALTIME_MODEL ||
      "gpt-4o-realtime-preview-2024-12-17";
    const voice = process.env.REALTIME_VOICE || "verse";

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
        // Let the server handle turn-taking so it waits for you to finish
        turn_detection: { type: "server_vad" },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return {
        statusCode: resp.status,
        headers: cors,
        body: JSON.stringify({ error: "OpenAI session create failed", detail: text }),
      };
    }

    const json = await resp.json();

    // 👇 THIS is what your hook expects:
    //      useRealtimeVoice() reads json.token
    const token = json?.client_secret?.value;
    if (!token) {
      return {
        statusCode: 500,
        headers: cors,
        body: JSON.stringify({ error: "No client_secret.value in OpenAI response" }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
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
