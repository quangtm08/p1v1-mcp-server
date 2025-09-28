#!/usr/bin/env node

import dotenv from 'dotenv';

dotenv.config();

async function testWebhookEndpoint() {
  console.log('🔍 Testing webhook endpoint existence\n');

  const webhookUrl = 'https://v1demo.me/webhook/email-classification';
  
  console.log('📡 Testing webhook URL:', webhookUrl);

  // Test with minimal payload
  const testPayload = {
    emails: [{
      id: 'test-123',
      subject: 'Test Subject',
      from: 'test@example.com',
      snippet: 'Test snippet',
      body: 'Test body'
    }]
  };

  console.log('\n📤 Sending test payload:');
  console.log(JSON.stringify(testPayload, null, 2));

  try {
    console.log('\n🚀 Making request to webhook...');
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });

    console.log('\n📥 Response details:');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Headers:`, Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log(`   Body: ${responseText}`);

    if (response.ok) {
      console.log('\n✅ Webhook endpoint is working!');
      try {
        const result = JSON.parse(responseText);
        console.log('Response JSON:', JSON.stringify(result, null, 2));
      } catch (e) {
        console.log('Response is not JSON');
      }
    } else {
      console.log('\n❌ Webhook endpoint failed!');
      
      if (response.status === 404) {
        console.log('   → Webhook not found/not registered');
      } else if (response.status === 500) {
        console.log('   → Internal server error');
      } else {
        console.log(`   → HTTP ${response.status} error`);
      }
    }

  } catch (error) {
    console.error('\n❌ Error calling webhook:', error.message);
    
    if (error.message.includes('ENOTFOUND')) {
      console.log('   → Domain not found');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.log('   → Connection refused');
    } else if (error.message.includes('timeout')) {
      console.log('   → Request timeout');
    }
  }
}

// Run the test
testWebhookEndpoint().catch(console.error);
