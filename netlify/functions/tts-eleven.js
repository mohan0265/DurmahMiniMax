// /netlify/functions/tts-eleven.js
// Server-side proxy to ElevenLabs TTS to keep your API key secret.
// POST { text } -> returns audio/mpeg (base64-encoded body)

export async function handler(event, _context) {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
  }

  try {
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    const VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
    const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

    if (!ELEVENLABS_API_KEY || !VOICE_ID) {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: "Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID" }),
      };
    }

    const { text } = JSON.parse(event.body || "{}");
    if (!text || !String(text).trim()) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Missing text" }) };
    }

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(VOICE_ID)}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.35,
          use_speaker_boost: true,
        },
        // 0–4; lower = starts faster (slightly less natural)
        optimize_streaming_latency: 2,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return {
        statusCode: resp.status,
        headers: CORS,
        body: JSON.stringify({ error: "ElevenLabs TTS failed", detail: t }),
      };
    }

    const buf = await resp.arrayBuffer();
    return {
      statusCode: 200,
      headers: {
        ...CORS,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
      body: Buffer.from(buf).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "Server error", detail: String(err) }),
    };
  }
}
