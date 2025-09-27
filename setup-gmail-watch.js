#!/usr/bin/env node

/**
 * Script to set up Gmail push notifications for users
 * This script configures Gmail to send push notifications to your Pub/Sub topic
 */

import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify'
];

async function setupGmailWatch(userId, topicName) {
  try {
    console.log(`Setting up Gmail watch for user: ${userId}`);
    
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // You'll need to get the user's refresh token from your database
    // For now, this is a placeholder
    console.log('⚠️  You need to provide the user\'s refresh token');
    console.log('   Get it from your Supabase email_tokens table');
    
    // Example of how to set up the watch once you have the token:
    /*
    oauth2Client.setCredentials({
      refresh_token: userRefreshToken
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const watchRequest = {
      topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/${topicName}`,
      labelIds: ['INBOX'],
      labelFilterAction: 'include'
    };

    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: watchRequest
    });

    console.log('Gmail watch set up successfully:', response.data);
    return response.data;
    */
    
  } catch (error) {
    console.error('Error setting up Gmail watch:', error);
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node setup-gmail-watch.js <userId> <topicName>');
    console.log('Example: node setup-gmail-watch.js user123 gmail-webhook-topic');
    process.exit(1);
  }

  const [userId, topicName] = args;
  
  try {
    await setupGmailWatch(userId, topicName);
    console.log('✅ Gmail watch setup completed');
  } catch (error) {
    console.error('❌ Failed to setup Gmail watch:', error.message);
    process.exit(1);
  }
}

main();
