const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Non-admins may only post as themselves, as 'user', into their own chat
const ownChatOnly = (req, res, next) => {
    if (req.user.isAdmin) return next();
    const { chatId, senderId, role } = req.body;
    if (chatId !== req.user.uid || senderId !== req.user.uid || role !== 'user') {
        return res.status(403).json({ success: false, message: 'Not allowed' });
    }
    next();
};

// Send a message (user or admin)
router.post('/send', requireAuth, ownChatOnly, chatController.sendMessage);

// Get all conversations (admin)
router.get('/conversations', requireAdmin, chatController.getConversations);

// Toggle pin on a conversation (admin)
router.post('/pin/:chatId', requireAdmin, chatController.togglePin);

// Mark conversation as read (admin)
router.post('/read/:chatId', requireAdmin, chatController.markAsRead);

// Cleanup old unpinned chats (admin)
router.delete('/cleanup', requireAdmin, chatController.cleanupOldChats);

module.exports = router;
