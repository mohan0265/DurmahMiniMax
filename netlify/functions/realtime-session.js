// netlify/functions/realtime-session.js
export async function handler(event) {
  // allow only POST (your hook calls POST)
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { model } = JSON.parse(event.body || "{}");

    const resp = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "realtime=v1",
      },
      body: JSON.stringify({
        model: model || "gpt-4o-realtime-preview-2024-12-17",
        voice: "verse",
        // server VAD keeps the loop smooth
        turn_detection: { type: "server_vad" },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return { statusCode: resp.status, body: txt };
    }

    const data = await resp.json();
    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
}
