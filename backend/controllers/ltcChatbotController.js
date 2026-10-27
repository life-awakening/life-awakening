const ltcChatbotService = require('../services/ltcChatbotService');

/**
 * Controller to handle chatbot questions from Super Admin
 * POST /api/superadmin/chatbot/chat
 */
const chatWithLtcDatabase = async (req, res) => {
  const { query, history = [], activeBatchId = null } = req.body;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'A valid question or query string is required.'
    });
  }

  try {
    const result = await ltcChatbotService.processChatbotQuery({
      query: query.trim(),
      history,
      activeBatchId
    });

    return res.json({
      success: true,
      answer: result.answer,
      rowCount: result.rowCount || 0,
      language: result.language || 'English',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[ltcChatbotController Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Unable to process question at this time. Please try again.',
      answer: 'An unexpected issue occurred while checking the LTC database records. Please try asking your question again.'
    });
  }
};

module.exports = {
  chatWithLtcDatabase
};
