import express from 'express';
import { getConversationHistory, sendMessage, markAsRead,editMessage,deleteMessage,reportMessage,restrictConversation,unrestrictConversation,uploadAttachment,attachmentAccess,attachmentContent } from '../controllers/chatController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/bookings/:bookingId/messages', getConversationHistory);
router.post('/bookings/:bookingId/messages', sendMessage);
router.put('/conversations/:conversationId/read', markAsRead);
router.patch('/conversations/:conversationId/messages/:messageId',editMessage);
router.post('/conversations/:conversationId/messages/:messageId/delete',deleteMessage);
router.post('/conversations/:conversationId/messages/:messageId/report',reportMessage);
router.post('/conversations/:conversationId/restrict',restrictConversation);
router.post('/conversations/:conversationId/unrestrict',unrestrictConversation);
router.post('/conversations/:conversationId/attachments',uploadAttachment);
router.get('/attachments/:attachmentId/access',attachmentAccess);
router.get('/attachments/:attachmentId/content',attachmentContent);

export default router;
