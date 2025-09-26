#!/usr/bin/env node

import express from 'express';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3001;

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).send('No authorization code provided');
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Save tokens to file
    const tokenPath = path.join(process.cwd(), 'tokens.json');
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
    
    console.log('✅ Authorization successful!');
    console.log('📁 Tokens saved to tokens.json');
    
    res.send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>✅ Authorization Successful!</h1>
          <p>Gmail tokens have been saved to <code>tokens.json</code></p>
          <p>You can now close this window and run your MCP server.</p>
          <p><strong>Next steps:</strong></p>
          <ol style="text-align: left; max-width: 400px; margin: 0 auto;">
            <li>Close this window</li>
            <li>Stop this callback server (Ctrl+C)</li>
            <li>Run: <code>npm run dev</code></li>
          </ol>
        </body>
      </html>
    `);
    
    // Stop the server after successful authorization
    setTimeout(() => {
      console.log('🛑 Stopping callback server...');
      process.exit(0);
    }, 3000);
    
  } catch (error) {
    console.error('❌ Authorization failed:', error.message);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>❌ Authorization Failed</h1>
          <p>Error: ${error.message}</p>
          <p>Please try again.</p>
        </body>
      </html>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Callback server running on http://localhost:${PORT}`);
  console.log(`📋 Waiting for OAuth callback...`);
  console.log(`\n🔗 Now you can visit the authorization URL:`);
  
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.labels',
    ],
  });
  
  console.log(authUrl);
  console.log(`\n📝 After authorization, you'll be redirected back here automatically.`);
});
