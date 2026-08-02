import Notification from '../models/Notification.js';
import NotificationPreference from '../models/NotificationPreference.js';

export const getNotifications = async (req, res) => {
    try {
        const { limit = 20, cursor, status } = req.query;const safeLimit=Math.min(50,Math.max(1,Number(limit)||20));
        if(status&&!['UNREAD','READ','ARCHIVED'].includes(status))return res.status(400).json({message:'Invalid notification status filter.'});
        
        const query = { recipientId: req.user.id };
        if (status) query.status = status;
        if (cursor) query._id = { $lt: cursor };

        const notifications = await Notification.find(query)
            .sort({ _id: -1 })
            .limit(safeLimit + 1)
            .lean();

        const hasMore = notifications.length > safeLimit;
        if (hasMore) notifications.pop();

        res.json({ notifications, hasMore, nextCursor: hasMore ? notifications[notifications.length - 1]._id : null });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

export const markNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;
        await Notification.updateOne(
            { _id: id, recipientId: req.user.id },
            { $set: { status: 'READ', readAt: new Date() } }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

export const markAllRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { recipientId: req.user.id, status: 'UNREAD' },
            { $set: { status: 'READ', readAt: new Date() } }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

export const getPreferences = async (req, res) => {
    try {
        let prefs = await NotificationPreference.findOne({ userId: req.user.id }).lean();
        if (!prefs) {
            prefs = await new NotificationPreference({ userId: req.user.id }).save();
        }
        res.json(prefs);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

export const updatePreferences = async (req, res) => {
    try {
        const allowed={};if(req.body.categoryPreferences)allowed.categoryPreferences={...req.body.categoryPreferences,SECURITY:true};if(req.body.channelPreferences)allowed.channelPreferences=req.body.channelPreferences;if(req.body.quietHours)allowed.quietHours=req.body.quietHours;if(req.body.language)allowed.language=req.body.language;if('marketingOptIn'in req.body)allowed.marketingOptIn=Boolean(req.body.marketingOptIn);const prefs = await NotificationPreference.findOneAndUpdate(
            { userId: req.user.id },
            { $set: allowed },
            { new: true, upsert: true }
        ).lean();
        res.json(prefs);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
export const archiveNotification=async(req,res)=>{await Notification.updateOne({_id:req.params.id,recipientId:req.user.id},{$set:{status:'ARCHIVED',archivedAt:new Date()}});res.json({success:true});};
