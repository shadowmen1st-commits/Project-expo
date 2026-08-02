import EmailProvider from './EmailProvider.js';
import User from '../../models/User.js';

export class NotificationEmailService {
    static async sendNotificationEmail(userId, notificationTitle, notificationBody) {
        const user = await User.findById(userId).lean();
        if (!user || !user.email) return;

        // Ensure email isn't disabled (could check bounces here)
        
        await EmailProvider.sendEmail({
            to: user.email,
            subject: `New Notification: ${notificationTitle}`,
            bodyText: notificationBody,
            bodyHtml: `<p>${notificationBody}</p>`
        });
    }
}

export default NotificationEmailService;
