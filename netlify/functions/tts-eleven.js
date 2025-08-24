// /netlify/functions/tts-eleven.js
// ElevenLabs proxy. Env: ELEVENLABS_API_KEY (required), ELEVENLABS_VOICE_ID (optional)

export async function handler(event) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: "Method Not Allowed" };
  }

  try {
    const { text } = JSON.parse(event.body || "{}");
    if (!text || !text.trim()) {
      return { statusCode: 400, headers: cors, body: "Missing text" };
    }

    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) {
      return { statusCode: 500, headers: cors, body: "Missing ELEVENLABS_API_KEY" };
    }
    const voiceId = process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB";

    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.85 },
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      return {
        statusCode: 502,
        headers: cors,
        body: `ElevenLabs error: ${detail}`,
      };
    }

    const buf = await r.arrayBuffer();
    return {
      statusCode: 200,
      headers: { ...cors, "Content-Type": "audio/mpeg" },
      body: Buffer.from(buf).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: String(e) };
  }
}
