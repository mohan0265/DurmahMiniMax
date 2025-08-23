# Voice System Debugging Guide

This guide explains how to use the newly implemented voice debugging features to diagnose audio pipeline issues.

## Quick Start

### 1. Enable Loopback Mode
```bash
# In your .env file, uncomment these lines:
VOICE_LOOPBACK=true
DEBUG_VOICE=true
```

### 2. Start the Server
```bash
npm run dev  # or from Server/ directory: npm run dev
```

### 3. Check Debug Endpoints
```bash
# Check if loopback mode is active
curl http://localhost:3001/debug/voice
curl http://localhost:3001/debug/loopback
```

### 4. Test in Browser
1. Open the Durmah app: `http://localhost:3000`
2. Add `?debug=voice` to URL: `http://localhost:3000?debug=voice`
3. Open Developer Console (F12)
4. Look for the Voice Debug HUD in top-left corner

## What Happens in Loopback Mode

1. **Server bypasses OpenAI**: Audio goes directly from mic → server → back to client
2. **Enhanced logging**: Every step is logged with detailed information
3. **Echo test**: Your voice should be echoed back with a "[loopback test]" transcript
4. **Debug HUD**: Real-time visual debugging in the browser

## Debugging Features

### Server-Side Logging
- 🔄 Connection state tracking with connection IDs
- 🎤 Audio chunk reception logging (size, timing)
- 📝 Message flow analysis (client → server → OpenAI)
- ⚠️ Error detection and detailed error messages

### Client-Side Debug HUD
- 📡 WebSocket connection status
- 🎵 Audio chunk reception and playback
- 📨 Message type analysis
- ❌ Error tracking with context

### Environment Verification
- `GET /debug/voice` - Shows current voice configuration
- `GET /debug/loopback` - Shows loopback test instructions
- Validates environment variables and API keys

## Test Procedures

### Step 1: Verify Loopback Mode
```bash
curl http://localhost:3001/debug/loopback
# Should show: { "loopbackMode": true }
```

### Step 2: Test Audio Pipeline
1. Open browser with `?debug=voice` parameter
2. Start voice mode in the app
3. Speak into microphone for 2-3 seconds
4. You should hear your voice echoed back
5. Check Debug HUD for detailed logs

### Step 3: Analyze Logs
**Server console should show:**
```
🔄 [abc123] Initializing loopback mode
🎤 [abc123] Loopback received audio chunk: 1200 bytes
🔄 [abc123] Processing loopback audio: 3 chunks
🎵 [abc123] Loopback audio playbook complete
```

**Client Debug HUD should show:**
```
[14:23:45] WebSocket connected
[14:23:47] Received: durmah.ready
[14:23:50] Audio sent to server (1200 samples)
[14:23:51] First audio chunk received (1200 bytes)
[14:23:52] AI transcript received: [Loopback test - echoed...]
```

## Troubleshooting Common Issues

### No Audio Playback
- Check Debug HUD: Are audio chunks being received?
- Server logs: Is audio being processed?
- Browser: AudioContext state (suspended/running)

### No Microphone Input
- Browser permissions: Allow microphone access
- Server logs: Are input_audio_buffer.append messages received?
- Debug HUD: Audio conversion successful?

### WebSocket Connection Issues
- CORS configuration: Check CLIENT_URL environment variable
- Port conflicts: Ensure server is running on expected port
- Network: Firewall or proxy blocking WebSocket?

## Switching Back to OpenAI Mode

1. Comment out or remove from .env:
```bash
# VOICE_LOOPBACK=true
# DEBUG_VOICE=true
```

2. Restart server
3. Test with OpenAI Realtime API

## Advanced Debugging

### Voice Message Flow
1. **Client**: Microphone → WebRTC → PCM16 conversion → WebSocket
2. **Server**: JSON parse → Audio buffering → Echo/OpenAI processing
3. **Response**: Audio chunks → Client → AudioContext playback
4. **Transcript**: Buffered until audio playback completes

### Key Debug Points
- **Audio format**: PCM16 at 24kHz sample rate
- **Chunk sizes**: ~1200 bytes per chunk for smooth playback
- **Timing**: 50ms delays between chunks, 500-800ms buffering
- **Cleanup**: Proper WebSocket close handling

## Production Considerations

- Remove debug flags before deployment
- Monitor server logs for performance issues
- Implement rate limiting for voice endpoints
- Consider audio compression for bandwidth optimization

## Getting Help

If issues persist after following this guide:
1. Check server console for error messages
2. Examine client Debug HUD logs
3. Verify environment configuration with debug endpoints
4. Test with minimal loopback setup first