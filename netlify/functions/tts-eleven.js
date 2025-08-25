// /netlify/functions/tts-eleven.js
// Proxies ElevenLabs TTS. POST { text } -> audio/mpeg

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
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    const VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
    if (!ELEVENLABS_API_KEY || !VOICE_ID) {
      return { statusCode: 500, headers: cors, body: "Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID" };
    }

    const { text } = JSON.parse(event.body || "{}");
    if (!text || !String(text).trim()) {
      return { statusCode: 400, headers: cors, body: "Missing text" };
    }

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
        model_id: "eleven_monolingual_v1",
        output_format: "mp3_44100_128",
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return { statusCode: resp.status, headers: cors, body: `ElevenLabs error: ${t}` };
    }

    const buf = Buffer.from(await resp.arrayBuffer());
    return {
      statusCode: 200,
      headers: { ...cors, "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
      body: buf.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: `Server error: ${String(e)}` };
  }
}
