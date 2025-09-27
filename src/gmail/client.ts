import { google } from 'googleapis';
import { GmailAuth } from './auth.js';

export interface EmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: {
      data?: string;
    };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string };
      parts?: Array<{ mimeType: string; body?: { data?: string } }>;
    }>;
  };
  labelIds: string[];
  sizeEstimate: number;
}

export interface EmailListOptions {
  maxResults?: number;
  q?: string;
  labelIds?: string[];
  includeSpamTrash?: boolean;
}

export class GmailClient {
  private gmail: any;
  private auth: GmailAuth;
  private userId?: string;

  constructor(userId?: string) {
    this.userId = userId;
    this.auth = new GmailAuth();
  }

  private async getGmailClient() {
    if (!this.gmail) {
      const authClient = await this.auth.getAuth(this.userId);
      this.gmail = google.gmail({ version: 'v1', auth: authClient });
    }
    
    // Check if token needs refresh
    if (this.userId && await this.auth.isTokenExpired(this.userId)) {
      try {
        await this.auth.refreshToken(this.userId);
        // Recreate Gmail client with refreshed token
        const authClient = await this.auth.getAuth(this.userId);
        this.gmail = google.gmail({ version: 'v1', auth: authClient });
      } catch (error) {
        console.error('Failed to refresh token:', error);
        throw new Error('Token refresh failed. Please re-authenticate.');
      }
    }
    
    return this.gmail;
  }

  async getEmails(options: EmailListOptions = {}): Promise<EmailMessage[]> {
    try {
      const gmail = await this.getGmailClient();
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: options.maxResults || 10,
        q: options.q,
        labelIds: options.labelIds,
        includeSpamTrash: options.includeSpamTrash || false,
      });

      const messages = response.data.messages || [];
      const emailPromises = messages.map((msg: any) => 
        this.getEmailById(msg.id)
      );

      return Promise.all(emailPromises);
    } catch (error) {
      console.error('Error fetching emails:', error);
      throw new Error(`Failed to fetch emails: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getEmailById(messageId: string): Promise<EmailMessage> {
    try {
      const gmail = await this.getGmailClient();
      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      return response.data as EmailMessage;
    } catch (error) {
      console.error('Error fetching email by ID:', error);
      throw new Error(`Failed to fetch email: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Alias for webhook handler compatibility
  async getEmail(messageId: string): Promise<EmailMessage> {
    return this.getEmailById(messageId);
  }

  

  async createLabel(name: string): Promise<any> {
    try {
      const gmail = await this.getGmailClient();
      const response = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error creating label:', error);
      throw new Error(`Failed to create label: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async archiveEmail(messageId: string): Promise<void> {
    try {
      const gmail = await this.getGmailClient();
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['INBOX'],
        },
      });
    } catch (error) {
      console.error('Error archiving email:', error);
      throw new Error(`Failed to archive email: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async addLabel(messageId: string, labelIds: string[]): Promise<void> {
    try {
      const gmail = await this.getGmailClient();
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: labelIds,
        },
      });
    } catch (error) {
      console.error('Error adding label:', error);
      throw new Error(`Failed to add label: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async removeLabel(messageId: string, labelIds: string[]): Promise<void> {
    try {
      const gmail = await this.getGmailClient();
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: labelIds,
        },
      });
    } catch (error) {
      console.error('Error removing label:', error);
      throw new Error(`Failed to remove label: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getLabels(): Promise<any[]> {
    try {
      const gmail = await this.getGmailClient();
      const response = await gmail.users.labels.list({
        userId: 'me',
      });

      return response.data.labels || [];
    } catch (error) {
      console.error('Error fetching labels:', error);
      throw new Error(`Failed to fetch labels: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Start watching for Gmail changes and send notifications to Pub/Sub
   * This enables push notifications for new emails
   */
  async startWatching(userId: string): Promise<any> {
    try {
      const gmail = await this.getGmailClient();
      
      // Replace 'your-project' with your actual Google Cloud project ID
      const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'your-project';
      const topicName = `projects/${projectId}/topics/gmail-notifications`;
      
      const response = await gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: topicName,
          labelIds: ['INBOX'], // Watch for changes in INBOX
          labelFilterAction: 'include'
        }
      });

      console.log('Gmail watch started successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error starting Gmail watch:', error);
      throw new Error(`Failed to start Gmail watch: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Stop watching for Gmail changes
   */
  async stopWatching(): Promise<void> {
    try {
      const gmail = await this.getGmailClient();
      await gmail.users.stop({
        userId: 'me'
      });
      console.log('Gmail watch stopped successfully');
    } catch (error) {
      console.error('Error stopping Gmail watch:', error);
      throw new Error(`Failed to stop Gmail watch: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get user profile information
   */
  async getProfile(): Promise<any> {
    try {
      const gmail = await this.getGmailClient();
      const response = await gmail.users.getProfile({
        userId: 'me'
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      throw new Error(`Failed to fetch profile: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get Gmail history changes
   */
  async getHistory(startHistoryId: string): Promise<any> {
    try {
      const gmail = await this.getGmailClient();
      const response = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: startHistoryId,
        historyTypes: ['messageAdded']
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching history:', error);
      throw new Error(`Failed to fetch history: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
