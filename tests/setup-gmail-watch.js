#!/usr/bin/env node

/**
 * Script to set up Gmail push notifications for users
 * This script configures Gmail to send push notifications to your Pub/Sub topic
 * 
 * Usage: node tests/setup-gmail-watch.js [PROJECT_ID] [USER_ID]
 * Example: node tests/setup-gmail-watch.js techyouth2025 62bdd1e1-68cc-49fd-b10f-3ecf45298301
 */

import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify'
];

// Get parameters from command line arguments or environment variables
const PROJECT_ID = process.argv[2] || process.env.GOOGLE_CLOUD_PROJECT_ID || 'techyouth2025';
const USER_ID = process.argv[3] || process.env.TEST_USER_ID;

async function setupGmailWatch(userId, topicName) {
  try {
    console.log(`Setting up Gmail watch for user: ${userId}`);
    console.log(`📋 Project ID: ${PROJECT_ID}`);
    console.log(`📋 Topic: ${topicName}\n`);
    
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    // You'll need to get the user's refresh token from your database
    // For now, this is a placeholder
    console.log('⚠️  You need to provide the user\'s refresh token');
    console.log('💡 This script is for demonstration purposes');
    console.log('💡 Use the webhook endpoints instead for production');
    
    console.log('\n🎯 To set up Gmail watch for a user:');
    console.log('1. Ensure the user has completed OAuth authentication');
    console.log('2. Use the webhook endpoint: POST /gmail/start-watching');
    console.log('3. Or use the OAuth callback endpoint for automatic setup');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

if (!USER_ID) {
  console.log('❌ User ID is required');
  console.log('Usage: node tests/setup-gmail-watch.js [PROJECT_ID] [USER_ID]');
  console.log('Example: node tests/setup-gmail-watch.js techyouth2025 62bdd1e1-68cc-49fd-b10f-3ecf45298301');
  process.exit(1);
}

const topicName = `projects/${PROJECT_ID}/topics/gmail-notifications`;
setupGmailWatch(USER_ID, topicName);