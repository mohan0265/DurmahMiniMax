// /netlify/functions/tts-eleven.js
export async function handler(event, _context) {
  try {
    const { text } = JSON.parse(event.body || "{}");
    if (!text || !text.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing text" }) };
    }

    const resp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          voice_settings: { stability: 0.7, similarity_boost: 0.7 },
        }),
      }
    );

    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`ElevenLabs TTS failed: ${t}`);
    }

    const buf = await resp.arrayBuffer();
    return {
      statusCode: 200,
      headers: { "Content-Type": "audio/mpeg" },
      body: Buffer.from(buf).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
}
