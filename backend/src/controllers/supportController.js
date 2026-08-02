import SupportTicket from '../models/SupportTicket.js';
import SupportTicketMessage from '../models/SupportTicketMessage.js';
import SupportTicketStateService from '../services/support/SupportTicketStateService.js';

export const getTickets = async (req, res) => {
    try {
        const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
        const query = isAdmin ? {} : { requesterId: req.user.id };
        
        const tickets = await SupportTicket.find(query).sort({ updatedAt: -1 }).lean();
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

export const getTicketDetails = async (req, res) => {
    try {
        const ticket = await SupportTicket.findById(req.params.id).lean();
        if (!ticket) return res.status(404).json({ message: 'Not found' });
        
        const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
        if (!isAdmin && ticket.requesterId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const messagesQuery = { ticketId: ticket._id };
        if (!isAdmin) {
            messagesQuery.visibility = 'REQUESTER_VISIBLE';
        }

        const messages = await SupportTicketMessage.find(messagesQuery).sort({ createdAt: 1 }).lean();
        
        res.json({ ticket, messages });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

export const createTicket = async (req, res) => {
    try {
        const ticket = await SupportTicketStateService.createTicket(req.user.id, req.user.role, req.body);
        res.status(201).json(ticket);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const addReply = async (req, res) => {
    try {
        const { body, visibility } = req.body;
        
        const ticket = await SupportTicket.findById(req.params.id).lean();
        if (!ticket) return res.status(404).json({ message: 'Not found' });
        
        const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
        if (!isAdmin && ticket.requesterId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        
        let senderType = req.user.role;
        if (isAdmin) senderType = 'SUPPORT_AGENT';

        const message = await SupportTicketStateService.addReply(
            req.params.id, 
            req.user.id, 
            senderType, 
            body, 
            isAdmin ? visibility : 'REQUESTER_VISIBLE'
        );
        
        res.status(201).json(message);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
