#!/usr/bin/env node

import dotenv from 'dotenv';

dotenv.config();

async function debugN8nWebhook() {
  console.log('🔍 Debugging n8n webhook call\n');

  const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
  
  if (!N8N_WEBHOOK_URL) {
    console.error('❌ N8N_WEBHOOK_URL not set in environment');
    return;
  }

  console.log('📡 N8N Webhook URL:', N8N_WEBHOOK_URL);

  // Create the same payload that the classification webhook sends
  const testEmail = {
    id: 'a4221e4f-6920-4cea-8498-1355e5da4871',
    subject: 'Your monthly subscription invoice - $29.99',
    from_address: 'billing@stripe.com',
    snippet: 'Your monthly subscription invoice for $29.99 is ready. Payment will be processed automatically.',
    body: `Dear Customer,

Thank you for your continued subscription to our premium service.

Your monthly invoice for $29.99 has been generated and will be automatically charged to your payment method on file.

Invoice Details:
- Service: Premium Plan
- Amount: $29.99
- Billing Period: December 2024
- Due Date: January 15, 2025
- Payment Method: **** **** **** 1234

If you have any questions about this invoice or need to update your payment information, please contact our support team.

Thank you for your business!

Best regards,
Billing Team
Stripe Inc.

This is an automated message. Please do not reply to this email.`
  };

  const payload = {
    emails: [{
      id: testEmail.id,
      subject: testEmail.subject,
      from: testEmail.from_address,
      snippet: testEmail.snippet,
      body: testEmail.body?.substring(0, 1000) // Same truncation as webhook
    }]
  };

  console.log('\n📤 Sending payload to n8n:');
  console.log(JSON.stringify(payload, null, 2));

  try {
    console.log('\n🚀 Making request to n8n webhook...');
    
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('\n📥 Response details:');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   Error body: ${errorText}`);
      console.log('\n❌ n8n webhook failed!');
      return;
    }

    const responseText = await response.text();
    console.log('\n✅ n8n webhook success response text:', responseText);
    
    if (responseText.trim() === '') {
      console.log('⚠️  Empty response from n8n webhook');
      return;
    }
    
    let result;
    try {
      result = JSON.parse(responseText);
      console.log('Parsed JSON:', JSON.stringify(result, null, 2));
    } catch (parseError) {
      console.log('⚠️  Failed to parse JSON response:', parseError.message);
      return;
    }

    // Check if classifications array exists and has items
    if (result.classifications && result.classifications.length > 0) {
      console.log('\n🎯 Classification found:');
      console.log(`   Category: ${result.classifications[0].category || result.classifications[0].category_key}`);
      console.log(`   Confidence: ${result.classifications[0].confidence || result.classifications[0].score}`);
    } else {
      console.log('\n⚠️  No classifications in response!');
      console.log('   This would cause the webhook to use default "others" classification');
    }

  } catch (error) {
    console.error('\n❌ Error calling n8n webhook:', error.message);
    console.log('\n🔧 Possible issues:');
    console.log('1. n8n webhook URL is incorrect');
    console.log('2. n8n workflow is not running');
    console.log('3. Network connectivity issues');
    console.log('4. n8n workflow is expecting different payload format');
  }
}

// Run the debug
debugN8nWebhook().catch(console.error);
