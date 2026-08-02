import express from 'express';
import { getNotifications, markNotificationRead, markAllRead, getPreferences, updatePreferences,archiveNotification } from '../controllers/notificationController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getNotifications);
router.put('/mark-all-read', markAllRead);
router.put('/:id/read', markNotificationRead);
router.post('/:id/archive',archiveNotification);

router.get('/preferences', getPreferences);
router.put('/preferences', updatePreferences);

export default router;
