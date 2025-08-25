// Netlify function that proxies ElevenLabs Text-to-Speech
// Env required: ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID
// Optional: ELEVENLABS_MODEL (default eleven_turbo_v2_5)
// Request body: { text, voiceId?, stability?, similarity?, style?, boost?, speed? }

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
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const defaultVoice = process.env.ELEVENLABS_VOICE_ID;
    const model = process.env.ELEVENLABS_MODEL || "eleven_turbo_v2_5";
    if (!apiKey || !defaultVoice) {
      return { statusCode: 500, headers: cors, body: "Missing ElevenLabs env" };
    }

    const {
      text,
      voiceId,
      stability = 0.40,          // more natural variation
      similarity = 0.80,         // keep voice identity
      style = 0.35,              // 0..1 (higher = more expressive)
      boost = true,              // speaker boost
      speed = 0.95,              // ElevenLabs supports speed in latest TTS; if ignored, we also slow in client
    } = JSON.parse(event.body || "{}");

    if (!text || !String(text).trim()) {
      return { statusCode: 400, headers: cors, body: "Missing text" };
    }

    const vid = (voiceId || defaultVoice).trim();

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(vid)}/stream?optimize_streaming_latency=0`;

    const body = {
      model_id: model,
      text,
      // If your account supports 'voice_settings', this will shape tone.
      voice_settings: {
        stability,
        similarity_boost: similarity,
        style,
        use_speaker_boost: !!boost,
      },
      // Some orgs have this new param; harmless if not supported:
      // generation_config: { speed }, 
      // NOTE: if your plan/API version doesn’t accept speed, we’ll still slow on the client.
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return {
        statusCode: resp.status,
        headers: cors,
        body: `ElevenLabs error: ${errText}`,
      };
    }

    const arrayBuffer = await resp.arrayBuffer();
    return {
      statusCode: 200,
      headers: {
        ...cors,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
      body: Buffer.from(arrayBuffer).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: String(e) };
  }
}
