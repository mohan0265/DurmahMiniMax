// Netlify Function: issues an ephemeral Realtime session token for the browser.
// Requires env: OPENAI_API_KEY
// Optional: REALTIME_MODEL (default shown below)
// Optional: TTS_PROVIDER (= "elevenlabs" to disable OpenAI voice)
// Optional: REALTIME_VOICE (only used when TTS_PROVIDER !== "elevenlabs")
// Optional: SYSTEM_INSTRUCTIONS, TURN_THRESHOLD, TURN_SILENCE_MS (server VAD)

export async function handler(event, _context) {
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
      return { statusCode: 500, headers: corsHeaders, body: "Missing OPENAI_API_KEY" };
    }

    const body = JSON.parse(event.body || "{}");
    const model =
      body.model ||
      process.env.REALTIME_MODEL ||
      "gpt-4o-realtime-preview-2024-12-17";

    // If we're using ElevenLabs for output TTS, do NOT request an OpenAI voice.
    const ttsProvider = (process.env.TTS_PROVIDER || "").toLowerCase();
    const usingEleven = ttsProvider === "elevenlabs";
    const openAiVoice = usingEleven
      ? undefined
      : (body.voice || process.env.REALTIME_VOICE || "verse");

    const instructions = process.env.SYSTEM_INSTRUCTIONS || "";
    const turnThreshold = parseFloat(process.env.TURN_THRESHOLD || "0.50");
    const turnSilenceMs = parseInt(process.env.TURN_SILENCE_MS || "700", 10);

    const payload = {
      model,
      modalities: ["text", "audio"],             // still need input audio to stream mic
      // only attach voice when we actually want OpenAI to synthesize output audio
      ...(openAiVoice ? { voice: openAiVoice } : {}),
      // optional guidance to slow/pause:
      ...(instructions ? { instructions } : {}),
      // server turn-taking (so it waits for you to finish)
      turn_detection: {
        type: "server_vad",
        threshold: turnThreshold,
        silence_duration_ms: turnSilenceMs,
      },
    };

    const resp = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "realtime=v1",
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return { statusCode: resp.status, headers: corsHeaders, body: text };
    }

    const json = await resp.json();
    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        token: json?.client_secret?.value,
        model,
        voice: openAiVoice || null,
        expires_at: json?.expires_at || null,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: String(err),
    };
  }
}
