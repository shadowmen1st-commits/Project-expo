import express from 'express';
import { getTickets, getTicketDetails, createTicket, addReply } from '../controllers/supportController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getTickets);
router.post('/', createTicket);
router.get('/:id', getTicketDetails);
router.post('/:id/messages', addReply);

export default router;
