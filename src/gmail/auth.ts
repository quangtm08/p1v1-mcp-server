import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs/promises';
import path from 'path';

export class GmailAuth {
  private oauth2Client: OAuth2Client;
  private tokenPath: string;

  constructor() {
    this.oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    this.tokenPath = path.join(process.cwd(), 'tokens.json');
  }

  async getAuth(): Promise<OAuth2Client> {
    try {
      // Try to load existing tokens
      const tokens = await this.loadTokens();
      if (tokens) {
        this.oauth2Client.setCredentials(tokens);
        return this.oauth2Client;
      }

      // If no tokens, generate auth URL for manual authorization
      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.modify',
          'https://www.googleapis.com/auth/gmail.labels',
        ],
      });

      console.log('Authorize this app by visiting this url:', authUrl);
      throw new Error('No valid tokens found. Please authorize the application first.');
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }

  async authorize(code: string): Promise<void> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      await this.saveTokens(tokens);
    } catch (error) {
      console.error('Error during authorization:', error);
      throw new Error(`Authorization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async loadTokens(): Promise<any> {
    try {
      const tokenData = await fs.readFile(this.tokenPath, 'utf8');
      return JSON.parse(tokenData);
    } catch (error) {
      return null;
    }
  }

  private async saveTokens(tokens: any): Promise<void> {
    try {
      await fs.writeFile(this.tokenPath, JSON.stringify(tokens, null, 2));
    } catch (error) {
      console.error('Error saving tokens:', error);
      throw new Error(`Failed to save tokens: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async refreshToken(): Promise<void> {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);
      await this.saveTokens(credentials);
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  isAuthenticated(): boolean {
    const credentials = this.oauth2Client.credentials;
    return !!(credentials && credentials.access_token);
  }
}
