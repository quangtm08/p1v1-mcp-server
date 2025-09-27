#!/usr/bin/env node

/**
 * Gmail Webhook Testing Script
 * This script helps you test the complete Gmail webhook functionality
 */

import fetch from 'node-fetch';

const WEBHOOK_URL = 'https://dream-mail-webhook-5ab3266932fe.herokuapp.com';

async function testWebhook() {
  console.log('🧪 Gmail Webhook Testing Script');
  console.log('================================\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing Health Check...');
    const healthResponse = await fetch(`${WEBHOOK_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health Status:', healthData.status);
    console.log('');

    // Test 2: Check Current Users
    console.log('2️⃣ Checking Current Users...');
    const usersResponse = await fetch(`${WEBHOOK_URL}/debug/users`);
    const usersData = await usersResponse.json();
    console.log(`📊 Found ${usersData.count} users in database:`);
    usersData.users.forEach((user, index) => {
      console.log(`   ${index + 1}. User ID: ${user.user_id}`);
      console.log(`      Provider: ${user.provider}`);
      console.log(`      Expires: ${user.expires_at}`);
      console.log(`      Created: ${user.created_at}`);
    });
    console.log('');

    // Test 3: Check Email Addresses
    console.log('3️⃣ Checking Email Addresses...');
    const emailsResponse = await fetch(`${WEBHOOK_URL}/debug/emails`);
    const emailsData = await emailsResponse.json();
    console.log(`📧 Found ${emailsData.count} email addresses:`);
    emailsData.emails.forEach((email, index) => {
      console.log(`   ${index + 1}. ${email.email_address} (User: ${email.user_id})`);
    });
    console.log('');

    // Test 4: Test Webhook Endpoint
    console.log('4️⃣ Testing Webhook Endpoint...');
    const testResponse = await fetch(`${WEBHOOK_URL}/webhook/gmail/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailAddress: 'test@example.com',
        historyId: '12345'
      })
    });
    const testData = await testResponse.json();
    console.log('🧪 Test Webhook Result:', testData.success ? '✅ SUCCESS' : '❌ FAILED');
    console.log('   Message:', testData.message);
    console.log('   Result:', testData.result);
    console.log('');

    // Test 5: Check OAuth Callback
    console.log('5️⃣ Testing OAuth Callback...');
    const callbackResponse = await fetch(`${WEBHOOK_URL}/auth/callback`);
    const callbackData = await callbackResponse.json();
    console.log('🔐 OAuth Callback Status:', callbackData.error ? '❌ ' + callbackData.error : '✅ Ready for OAuth');
    console.log('');

    console.log('🎯 Next Steps:');
    console.log('==============');
    console.log('1. To add a new user:');
    console.log('   - Visit: https://dream-mail-webhook-5ab3266932fe.herokuapp.com/auth/callback');
    console.log('   - Complete OAuth flow');
    console.log('   - Check if user appears in database');
    console.log('');
    console.log('2. To test Gmail watch:');
    console.log('   - Send a POST request to /gmail/start-watching with user_id');
    console.log('   - Send an email to the user\'s Gmail account');
    console.log('   - Check webhook logs for notifications');
    console.log('');
    console.log('3. To monitor webhook:');
    console.log('   - Run: heroku logs --tail --app dream-mail-webhook');
    console.log('   - Send test emails to trigger notifications');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testWebhook();
