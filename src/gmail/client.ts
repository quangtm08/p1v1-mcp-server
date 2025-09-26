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
}
