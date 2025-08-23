// Server/routes/chat.js
const express = require('express');
const router = express.Router();
const { chatWithDurmah } = require('../services/openai');

// POST /api/chat/message
router.post('/message', async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: "Missing 'message' string" });
    }
    const ai = await chatWithDurmah(message);
    return res.json({ success: true, message: ai });
  } catch (err) {
    console.error("Chat error:", err);
    return res.status(500).json({ success: false, error: "Model error" });
  }
});

// Optional: minimal history/conversation stubs (keep response shapes)
router.get('/history/:conversationId', async (req, res) => {
  res.json({ success: true, history: [] });
});

router.post('/conversation', async (req, res) => {
  const { title, topic } = req.body || {};
  
  // Generate a simple conversation ID
  const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  res.json({ 
    success: true, 
    conversation: {
      id: conversationId,
      title: title || 'Chat with Durmah',
      topic: topic || 'general',
      created_at: new Date().toISOString()
    }
  });
});

module.exports = router;
