#!/usr/bin/env node

/**
 * Generate OAuth URLs for existing users
 * 
 * Usage: node tests/generate-oauth-urls.js [WEBHOOK_URL]
 * Example: node tests/generate-oauth-urls.js https://your-webhook.herokuapp.com
 */

import fetch from 'node-fetch';

// Get webhook URL from command line argument or use default
const WEBHOOK_URL = process.argv[2] || process.env.WEBHOOK_URL || 'https://dream-mail-webhook-5ab3266932fe.herokuapp.com';

async function generateOAuthUrls() {
  console.log('🔗 Generating OAuth URLs for Existing Users');
  console.log('==========================================');
  console.log(`🌐 Using: ${WEBHOOK_URL}\n`);

  try {
    // Get OAuth URL template
    const oauthResponse = await fetch(`${WEBHOOK_URL}/auth/oauth-url`);
    const oauthData = await oauthResponse.json();
    
    if (!oauthData.success) {
      throw new Error(oauthData.error);
    }

    const baseAuthUrl = oauthData.authUrl;
    console.log('📋 Base OAuth URL:', baseAuthUrl);
    console.log('');

    // Get all users
    const usersResponse = await fetch(`${WEBHOOK_URL}/debug/all-users`);
    const usersData = await usersResponse.json();
    
    if (!usersData.success) {
      throw new Error(usersData.error);
    }

    console.log(`👥 Found ${usersData.count} users in database:\n`);

    usersData.users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.display_name || 'No Name'} (${user.email})`);
      console.log(`   User ID: ${user.id}`);
      
      // Generate OAuth URL with user ID as state
      const oauthUrl = `${baseAuthUrl}&state=${user.id}`;
      console.log(`   OAuth URL: ${oauthUrl}`);
      console.log('');
    });

    console.log('🎯 Instructions for Users:');
    console.log('=========================');
    console.log('1. Each user should visit their specific OAuth URL above');
    console.log('2. They will be redirected to Google to authorize Gmail access');
    console.log('3. After authorization, they will be redirected back to the webhook');
    console.log('4. The webhook will automatically:');
    console.log('   - Save their Gmail tokens');
    console.log('   - Create system labels in their Gmail');
    console.log('   - Start watching their Gmail for new emails');
    console.log('');
    console.log('5. After OAuth, check status with:');
    console.log(`   curl ${WEBHOOK_URL}/debug/users`);
    console.log(`   curl ${WEBHOOK_URL}/debug/emails`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure the webhook URL is correct and accessible');
  }
}

generateOAuthUrls();