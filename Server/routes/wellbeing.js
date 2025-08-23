const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// Log mood
router.post('/mood', authMiddleware, async (req, res) => {
  try {
    const { mood } = req.body;
    
    res.json({
      success: true,
      message: 'Mood logged successfully',
      mood
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get wellbeing report
router.get('/report', authMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Wellbeing report',
      data: {
        averageMood: 'good',
        checkIns: 0,
        lastCheckIn: null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;