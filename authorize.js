#!/usr/bin/env node

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function authorize() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );

  // Generate authorization URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.labels',
    ],
  });

  console.log('🔗 Authorize this app by visiting this URL:');
  console.log(authUrl);
  console.log('\n📋 After authorization, you will be redirected to:');
  console.log('http://localhost:3001/auth/callback?code=AUTHORIZATION_CODE');
  console.log('\n📝 Copy the code from the URL and run:');
  console.log('node authorize.js <AUTHORIZATION_CODE>');
}

async function exchangeCode(code) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Save tokens to file
    const tokenPath = path.join(process.cwd(), 'tokens.json');
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
    
    console.log('✅ Authorization successful!');
    console.log('📁 Tokens saved to tokens.json');
    console.log('🚀 You can now run the MCP server');
  } catch (error) {
    console.error('❌ Authorization failed:', error.message);
  }
}

// Check if authorization code is provided
const authCode = process.argv[2];

if (authCode) {
  exchangeCode(authCode);
} else {
  authorize();
}
