import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs/promises';
import path from 'path';
import { SupabaseClient, EmailToken } from '../database/supabase.js';

export class GmailAuth {
  private oauth2Client: OAuth2Client;
  private tokenPath: string;
  private supabaseClient: SupabaseClient;

  constructor(supabaseClient?: SupabaseClient) {
    this.oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    this.tokenPath = path.join(process.cwd(), 'tokens.json');
    this.supabaseClient = supabaseClient || new SupabaseClient();
  }

  async getAuth(userId?: string): Promise<OAuth2Client> {
    try {
      if (userId) {
        // Try to load user-specific tokens from Supabase
        const tokens = await this.loadUserTokens(userId);
        if (tokens) {
          this.oauth2Client.setCredentials({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expiry_date: new Date(tokens.expires_at).getTime(),
          });
          return this.oauth2Client;
        }
      } else {
        // Fallback to local tokens for backward compatibility
        const tokens = await this.loadTokens();
        if (tokens) {
          this.oauth2Client.setCredentials(tokens);
          return this.oauth2Client;
        }
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

  async authorize(code: string, userId?: string): Promise<void> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      
      if (userId) {
        // Save tokens to Supabase for the user
        await this.saveUserTokens(userId, tokens);
      } else {
        // Fallback to local storage for backward compatibility
        await this.saveTokens(tokens);
      }
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

  async refreshToken(userId?: string): Promise<void> {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);
      
      if (userId) {
        // Update tokens in Supabase for the user
        await this.updateUserTokens(userId, credentials);
      } else {
        // Fallback to local storage for backward compatibility
        await this.saveTokens(credentials);
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  isAuthenticated(): boolean {
    const credentials = this.oauth2Client.credentials;
    return !!(credentials && credentials.access_token);
  }

  // User-specific token management methods
  private async loadUserTokens(userId: string): Promise<EmailToken | null> {
    try {
      return await this.supabaseClient.getEmailToken(userId, 'gmail');
    } catch (error) {
      console.error('Error loading user tokens:', error);
      return null;
    }
  }

  private async saveUserTokens(userId: string, tokens: any): Promise<void> {
    try {
      const expiresAt = tokens.expiry_date 
        ? new Date(tokens.expiry_date).toISOString()
        : new Date(Date.now() + 3600 * 1000).toISOString(); // Default 1 hour

      await this.supabaseClient.saveEmailToken({
        user_id: userId,
        provider: 'gmail',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
      });
    } catch (error) {
      console.error('Error saving user tokens:', error);
      throw new Error(`Failed to save user tokens: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async updateUserTokens(userId: string, tokens: any): Promise<void> {
    try {
      const expiresAt = tokens.expiry_date 
        ? new Date(tokens.expiry_date).toISOString()
        : new Date(Date.now() + 3600 * 1000).toISOString(); // Default 1 hour

      await this.supabaseClient.updateEmailToken(userId, 'gmail', {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
      });
    } catch (error) {
      console.error('Error updating user tokens:', error);
      throw new Error(`Failed to update user tokens: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async isTokenExpired(userId: string): Promise<boolean> {
    try {
      const token = await this.loadUserTokens(userId);
      if (!token) return true;
      
      const now = new Date();
      const expiresAt = new Date(token.expires_at);
      return now >= expiresAt;
    } catch (error) {
      console.error('Error checking token expiry:', error);
      return true;
    }
  }
}
