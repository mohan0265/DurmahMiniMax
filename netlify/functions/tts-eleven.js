// /netlify/functions/tts-eleven.js
// ElevenLabs TTS proxy for the browser. Returns audio/mpeg.
// Env needed: ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID

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
    const { text } = JSON.parse(event.body || "{}");
    if (!text || !text.trim()) {
      return { statusCode: 400, headers: cors, body: "Missing text" };
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    if (!apiKey || !voiceId) {
      return { statusCode: 500, headers: cors, body: "Missing ElevenLabs env" };
    }

    const resp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2",
          // Lower latency for snappier replies (0–4, higher = lower latency)
          optimize_streaming_latency: 2,
          voice_settings: {
            stability: 0.6,
            similarity_boost: 0.85,
            style: 0.55,
            use_speaker_boost: true,
          },
          // Keep it small for quick playback; change if you prefer higher fidelity
          output_format: "mp3_22050_32",
        }),
      }
    );

    if (!resp.ok) {
      const errTxt = await resp.text();
      return {
        statusCode: resp.status,
        headers: cors,
        body: `ElevenLabs failed: ${errTxt}`,
      };
    }

    const buf = await resp.arrayBuffer();
    return {
      statusCode: 200,
      headers: {
        ...cors,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
      body: Buffer.from(buf).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: cors,
      body: `Server error: ${String(e)}`,
    };
  }
}
