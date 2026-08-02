export class EmailProvider {
    /**
     * Standardized interface for sending emails.
     * Can wrap SendGrid, AWS SES, or NodeMailer for local testing.
     */
    static async sendEmail({ to, subject, bodyHtml, bodyText }) {
        if (process.env.NODE_ENV === 'test') {
            return { success: true, messageId: 'test-message-id' };
        }
        
        if(process.env.NODE_ENV==='production')throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');
        // Development-only non-live adapter
        console.log(`[EmailProvider] Mock sending email to ${to}: ${subject}`);
        
        return { success: true, messageId: `mock-${Date.now()}` };
    }
}

export default EmailProvider;
