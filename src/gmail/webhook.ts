import { Request, Response } from 'express';
import crypto from 'crypto';
import { GmailClient } from './client.js';

export interface GmailWebhookPayload {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

export class GmailWebhook {
  private gmailClient: GmailClient;
  private webhookSecret: string;

  constructor(gmailClient: GmailClient) {
    this.gmailClient = gmailClient;
    this.webhookSecret = process.env.GMAIL_WEBHOOK_SECRET || '';
  }

  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      // Verify webhook signature
      if (!this.verifySignature(req)) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      const payload: GmailWebhookPayload = req.body;
      
      // Decode the base64 message data
      const messageData = Buffer.from(payload.message.data, 'base64').toString('utf-8');
      const messageInfo = JSON.parse(messageData);

      console.log('Received Gmail webhook:', messageInfo);

      // Process the email notification
      await this.processEmailNotification(messageInfo);

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({ 
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private verifySignature(req: Request): boolean {
    if (!this.webhookSecret) {
      console.warn('No webhook secret configured, skipping signature verification');
      return true;
    }

    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    const receivedSignature = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );
  }

  private async processEmailNotification(messageInfo: any): Promise<void> {
    try {
      // Extract email ID from the notification
      const emailId = messageInfo.emailAddress;
      const historyId = messageInfo.historyId;

      console.log(`Processing email notification for: ${emailId}, historyId: ${historyId}`);

      // Fetch the latest emails to process
      const emails = await this.gmailClient.getEmails({ maxResults: 5 });
      
      // Here you would typically:
      // 1. Classify the new emails
      // 2. Apply custom rules
      // 3. Update database records
      // 4. Trigger n8n workflows
      
      console.log(`Processed ${emails.length} emails from webhook`);
    } catch (error) {
      console.error('Error processing email notification:', error);
      throw error;
    }
  }

  // Method to set up Gmail push notifications
  async setupPushNotifications(): Promise<void> {
    try {
      // This would typically be called during initial setup
      // to configure Gmail to send push notifications to your webhook endpoint
      
      const webhookUrl = process.env.GMAIL_PUSH_ENDPOINT;
      if (!webhookUrl) {
        throw new Error('GMAIL_PUSH_ENDPOINT not configured');
      }

      console.log(`Gmail push notifications configured for: ${webhookUrl}`);
      
      // Implementation would depend on Gmail API setup
      // This is a placeholder for the actual Gmail API call
    } catch (error) {
      console.error('Error setting up push notifications:', error);
      throw error;
    }
  }
}
