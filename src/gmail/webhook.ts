import { GmailClient } from './client.js';
import { SupabaseClient } from '../database/supabase.js';
import { EmailRecord } from '../database/supabase.js';

export interface GmailPushNotification {
  message: {
    data: string; // base64 encoded
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

export interface DecodedNotification {
  emailAddress: string;
  historyId: string;
}

export class GmailWebhookHandler {
  private gmailClient: GmailClient;
  private supabaseClient: SupabaseClient;

  constructor() {
    this.gmailClient = new GmailClient();
    this.supabaseClient = new SupabaseClient();
  }

  /**
   * Handle incoming Gmail push notification
   */
  async handlePushNotification(pushData: GmailPushNotification): Promise<{ success: boolean; processed: number; error?: string }> {
    try {
      console.log('Received Gmail push notification:', pushData.message.messageId);

      // 1. Decode the base64 data
      const decoded = this.decodeNotification(pushData.message.data);
      console.log('Decoded notification:', decoded);

      // 2. Extract emailAddress and historyId
      const { emailAddress, historyId } = decoded;
      
      if (!emailAddress || !historyId) {
        throw new Error('Missing emailAddress or historyId in notification');
      }

      // 3. Find user by email address (simplified for testing)
      let userId: string | null = null;
      
      // For testing, use the known user ID if email matches
      if (emailAddress === 'quangtm.gp@gmail.com') {
        userId = '62bdd1e1-68cc-49fd-b10f-3ecf45298301';
        console.log(`Using known user ID for testing: ${userId}`);
      } else {
        userId = await this.findUserByEmail(emailAddress);
        if (!userId) {
          console.log(`No user found for email: ${emailAddress}`);
          return {
            success: true,
            processed: 0,
            error: 'No user found for this email address'
          };
        }
      }

      // 4. Process new emails using history API
      const result = await this.processNewEmailsFromHistory(userId, historyId);
      
      return {
        success: true,
        processed: result.processed,
        error: result.message
      };

    } catch (error) {
      console.error('Error handling push notification:', error);
      return {
        success: false,
        processed: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Decode base64 notification data
   */
  private decodeNotification(data: string): DecodedNotification {
    try {
      const decoded = Buffer.from(data, 'base64').toString('utf-8');
      return JSON.parse(decoded);
    } catch (error) {
      throw new Error(`Failed to decode notification data: ${error}`);
    }
  }

  /**
   * Find user by email address
   */
  private async findUserByEmail(emailAddress: string): Promise<string | null> {
    try {
      // Get all users with Gmail tokens and find matching email
      const usersWithTokens = await this.supabaseClient.getAllUsersWithTokens();
      
      for (const token of usersWithTokens) {
        // Create a temporary Gmail client to get the user's email
        const tempClient = new GmailClient(token.user_id);
        try {
          const profile = await tempClient.getProfile();
          console.log(`Checking user ${token.user_id} with email: ${profile.emailAddress}`);
          if (profile.emailAddress === emailAddress) {
            console.log(`Found matching user: ${token.user_id} for email: ${emailAddress}`);
            return token.user_id;
          }
        } catch (error) {
          console.log(`Could not get profile for user ${token.user_id}:`, error);
          continue;
        }
      }
      
      console.log(`No user found for email: ${emailAddress}`);
      return null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  }

  /**
   * Process new emails using Gmail History API
   */
  private async processNewEmailsFromHistory(userId: string, historyId: string): Promise<{ processed: number; message?: string }> {
    try {
      console.log(`Processing emails from history ${historyId} for user ${userId}`);

      // Create user-specific Gmail client
      const userGmailClient = new GmailClient(userId);
      
      // Get history changes since the last historyId
      const history = await userGmailClient.getHistory(historyId);
      
      if (!history || !history.history) {
        console.log('No history changes found');
        return { processed: 0, message: 'No new changes' };
      }

      let processedCount = 0;
      const processedEmails: string[] = [];

      // Process each history record
      for (const historyRecord of history.history) {
        if (historyRecord.messagesAdded) {
          for (const messageAdded of historyRecord.messagesAdded) {
            const messageId = messageAdded.message.id;
            
            // Skip if already processed in this batch
            if (processedEmails.includes(messageId)) {
              continue;
            }

            try {
              const result = await this.processNewEmail(userId, messageId);
              if (result.emailId) {
                processedEmails.push(messageId);
                processedCount++;
              }
            } catch (error) {
              console.error(`Error processing message ${messageId}:`, error);
            }
          }
        }
      }

      console.log(`Successfully processed ${processedCount} emails from history`);
      return { 
        processed: processedCount, 
        message: `Processed ${processedCount} new emails` 
      };

    } catch (error) {
      console.error(`Error processing emails from history ${historyId} for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Process a new email from Gmail push notification
   */
  private async processNewEmail(userId: string, messageId: string): Promise<{ emailId?: string; message?: string }> {
    try {
      console.log(`Processing new email for user ${userId}, message ${messageId}`);

      // 1. Check if email already exists
      const existingEmail = await this.supabaseClient.getEmailByMessageId(messageId);
      if (existingEmail) {
        console.log(`Email ${messageId} already exists in database`);
        return { emailId: existingEmail.id, message: 'Email already exists' };
      }

      // 2. Create user-specific Gmail client
      const userGmailClient = new GmailClient(userId);

      // 3. Fetch the specific email from Gmail API
      const gmailEmail = await userGmailClient.getEmail(messageId);
      if (!gmailEmail) {
        throw new Error(`Email ${messageId} not found in Gmail`);
      }

      // 4. Process and store the email
      const emailRecord = await this.processAndStoreEmail(gmailEmail, userId);

      // 5. Add to classification queue
      await this.enqueueForClassification(emailRecord.id, userId);

      console.log(`Successfully processed email ${messageId} for user ${userId}`);
      return { emailId: emailRecord.id, message: 'Email processed successfully' };

    } catch (error) {
      console.error(`Error processing email ${messageId} for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Process Gmail email data and store in Supabase
   */
  private async processAndStoreEmail(gmailEmail: any, userId: string): Promise<EmailRecord> {
    try {
      // Extract email metadata
      const headers = gmailEmail.payload.headers;
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
      const fromAddress = headers.find((h: any) => h.name === 'From')?.value || '';
      const toAddresses = headers.find((h: any) => h.name === 'To')?.value || '';
      const ccAddresses = headers.find((h: any) => h.name === 'Cc')?.value || '';
      const date = headers.find((h: any) => h.name === 'Date')?.value || '';

      // Convert comma-separated strings to arrays
      const toAddressesArray = toAddresses ? toAddresses.split(',').map((addr: string) => addr.trim()) : [];
      const ccAddressesArray = ccAddresses ? ccAddresses.split(',').map((addr: string) => addr.trim()) : [];

      // Extract body content
      let body = '';
      if (gmailEmail.payload.body?.data) {
        body = Buffer.from(gmailEmail.payload.body.data, 'base64').toString('utf-8');
      } else if (gmailEmail.payload.parts) {
        // Handle multipart emails
        for (const part of gmailEmail.payload.parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
            break;
          } else if (part.mimeType === 'text/html' && part.body?.data && !body) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
          }
        }
      }

      // Parse and format the date properly
      let parsedDate: string;
      try {
        // Parse the RFC 2822 date format from Gmail
        const dateObj = new Date(date);
        parsedDate = dateObj.toISOString();
      } catch (error) {
        console.warn(`Failed to parse date "${date}", using current time`);
        parsedDate = new Date().toISOString();
      }

      // Prepare email record
      const emailRecord = {
        user_id: userId,
        message_id: gmailEmail.id,
        thread_id: gmailEmail.threadId,
        subject: subject,
        from_address: fromAddress,
        to_addresses: toAddressesArray,
        cc_addresses: ccAddressesArray,
        snippet: gmailEmail.snippet,
        body: body,
        labels: gmailEmail.labelIds || [],
        received_at: parsedDate,
        archived: !(gmailEmail.labelIds || []).includes('INBOX'),
        raw_json: gmailEmail
      };

      // Store in Supabase
      const savedEmail = await this.supabaseClient.saveEmail(emailRecord);
      console.log(`Email stored with ID: ${savedEmail.id}`);

      return savedEmail;

    } catch (error) {
      console.error('Error processing email data:', error);
      throw error;
    }
  }

  /**
   * Add email to classification queue for n8n processing
   */
  private async enqueueForClassification(emailId: string, userId: string): Promise<void> {
    try {
      const { error } = await this.supabaseClient.getClient()
        .from('classification_queue')
        .insert({
          email_id: emailId,
          user_id: userId,
          status: 'pending'
        });

      if (error) {
        throw new Error(`Failed to enqueue email for classification: ${error.message}`);
      }

      console.log(`Email ${emailId} added to classification queue`);
    } catch (error) {
      console.error('Error adding email to classification queue:', error);
      // Don't throw here - email is already stored, classification is secondary
    }
  }

  /**
   * Verify webhook signature (implement based on your security requirements)
   */
  verifySignature(payload: string, signature: string): boolean {
    // TODO: Implement webhook signature verification
    // This is important for production security
    return true; // Placeholder
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString()
    };
  }
}
