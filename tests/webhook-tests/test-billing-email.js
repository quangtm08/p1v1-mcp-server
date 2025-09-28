#!/usr/bin/env node

import { SupabaseClient } from '../../dist/database/supabase.js';
import dotenv from 'dotenv';

dotenv.config();

async function addBillingEmailForTesting() {
  console.log('🧪 Adding billing email for classification testing\n');

  const supabaseClient = new SupabaseClient();
  const userId = '9adc932a-aacd-48d1-924b-cf264ae19256';

  try {
    // 1. Check if user exists
    console.log('1️⃣ Checking if user exists...');
    const client = supabaseClient.getClient();
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('id, display_name, email')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.log('❌ User not found in profiles table');
      console.log('💡 Creating profile for user...');
      
      const { error: createError } = await client
        .from('profiles')
        .insert({
          id: userId,
          display_name: 'Test User',
          email: 'test@example.com'
        });

      if (createError) {
        console.error('❌ Failed to create profile:', createError);
        return;
      }
      console.log('✅ Profile created successfully');
    } else {
      console.log('✅ User found:', profile);
    }

    // 2. Create a realistic billing email
    const billingEmail = {
      user_id: userId,
      message_id: `test-billing-${Date.now()}`,
      thread_id: `thread-billing-${Date.now()}`,
      subject: 'Your monthly subscription invoice - $29.99',
      from_address: 'billing@stripe.com',
      to_addresses: ['user@example.com'],
      cc_addresses: [],
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

This is an automated message. Please do not reply to this email.`,
      labels: ['INBOX'],
      received_at: new Date().toISOString(),
      raw_json: {
        test: true,
        source: 'test-script',
        category: 'billing'
      }
    };

    console.log('\n2️⃣ Inserting billing email into emails table...');
    console.log('📧 Email details:');
    console.log(`   Subject: ${billingEmail.subject}`);
    console.log(`   From: ${billingEmail.from_address}`);
    console.log(`   Snippet: ${billingEmail.snippet.substring(0, 100)}...`);

    const { data: email, error: emailError } = await client
      .from('emails')
      .insert(billingEmail)
      .select()
      .single();

    if (emailError) {
      console.error('❌ Failed to insert email:', emailError);
      return;
    }

    console.log('✅ Email inserted successfully!');
    console.log(`   Email ID: ${email.id}`);
    console.log(`   Message ID: ${email.message_id}`);

    // 3. Check if classification queue item was created automatically
    console.log('\n3️⃣ Checking classification queue...');
    
    // Wait a moment for the trigger to fire
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const { data: queueItems, error: queueError } = await client
      .from('classification_queue')
      .select('*')
      .eq('email_id', email.id)
      .eq('user_id', userId);

    if (queueError) {
      console.error('❌ Failed to check classification queue:', queueError);
    } else if (queueItems && queueItems.length > 0) {
      console.log('✅ Classification queue item created automatically!');
      console.log(`   Queue ID: ${queueItems[0].id}`);
      console.log(`   Status: ${queueItems[0].status}`);
      console.log(`   Payload: ${JSON.stringify(queueItems[0].payload, null, 2)}`);
    } else {
      console.log('⚠️  No classification queue item found (trigger might not have fired)');
    }

    // 4. Summary
    console.log('\n🎉 Test email created successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - User ID: ${userId}`);
    console.log(`   - Email ID: ${email.id}`);
    console.log(`   - Message ID: ${email.message_id}`);
    console.log(`   - Subject: ${email.subject}`);
    console.log(`   - From: ${email.from_address}`);
    console.log(`   - Queue Items: ${queueItems?.length || 0}`);

    console.log('\n🔧 Next steps for debugging:');
    console.log('1. Check the classification_queue table for the new item');
    console.log('2. Trigger the classification webhook manually or wait for scheduled execution');
    console.log('3. Monitor the n8n webhook to see the payload being sent');
    console.log('4. Check the classifications table for the result');

    console.log('\n📊 To trigger classification webhook manually:');
    console.log(`curl -X POST "${process.env.SUPABASE_URL}/functions/v1/classification-webhook" \\`);
    console.log(`  -H "Authorization: Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}" \\`);
    console.log(`  -H "Content-Type: application/json"`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure your .env file has correct Supabase credentials');
    console.log('2. Check that the user ID exists in your database');
    console.log('3. Verify database permissions');
  }
}

// Run the test
addBillingEmailForTesting().catch(console.error);
