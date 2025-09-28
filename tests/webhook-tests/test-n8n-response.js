#!/usr/bin/env node

import { SupabaseClient } from '../../dist/database/supabase.js';
import dotenv from 'dotenv';

dotenv.config();

async function testN8nResponse() {
  console.log('🧪 Testing n8n response handling\n');

  const supabaseClient = new SupabaseClient();
  const client = supabaseClient.getClient();

  try {
    // Get a pending queue item
    console.log('1️⃣ Getting pending queue item...');
    const { data: queueItems, error: queueError } = await client
      .from('classification_queue')
      .select('*')
      .eq('status', 'pending')
      .limit(1);

    if (queueError || !queueItems || queueItems.length === 0) {
      console.log('❌ No pending queue items found');
      return;
    }

    const queueItem = queueItems[0];
    console.log('✅ Found pending queue item:', queueItem.id);

    // Get the email details
    console.log('\n2️⃣ Getting email details...');
    const { data: email, error: emailError } = await client
      .from('emails')
      .select('*')
      .eq('id', queueItem.email_id)
      .single();

    if (emailError || !email) {
      console.log('❌ Email not found:', emailError);
      return;
    }

    console.log('✅ Email found:', email.subject);

    // Simulate n8n response (direct array format)
    console.log('\n3️⃣ Simulating n8n response...');
    const mockN8nResponse = [
      {
        email_id: email.id,
        category: 'payment',
        confidence: 0.98,
        reasoning: 'The email is an invoice notification for a subscription payment.'
      }
    ];

    console.log('Mock n8n response:', JSON.stringify(mockN8nResponse, null, 2));

    // Test the response handling logic
    console.log('\n4️⃣ Testing response handling logic...');
    let classifications = [];
    
    if (Array.isArray(mockN8nResponse)) {
      console.log('✅ Received direct array format from n8n');
      classifications = mockN8nResponse;
    } else if (mockN8nResponse.classifications && Array.isArray(mockN8nResponse.classifications)) {
      console.log('✅ Received wrapped format from n8n');
      classifications = mockN8nResponse.classifications;
    } else {
      console.log('❌ Unknown response format from n8n:', typeof mockN8nResponse);
      return;
    }

    console.log('✅ Classifications extracted:', classifications);

    // Store the classification result
    console.log('\n5️⃣ Storing classification result...');
    const { error: classificationError } = await client
      .from('classifications')
      .insert({
        email_id: email.id,
        user_id: queueItem.user_id,
        category_key: classifications[0].category,
        score: classifications[0].confidence,
        source: 'ai',
        model: 'gpt-4o-mini',
        raw_response: {
          reasoning: classifications[0].reasoning
        }
      });

    if (classificationError) {
      console.error('❌ Failed to store classification:', classificationError);
      return;
    }

    console.log('✅ Classification stored successfully');

    // Update email status
    console.log('\n6️⃣ Updating email status...');
    const { error: emailUpdateError } = await client
      .from('emails')
      .update({
        processed_at: new Date().toISOString(),
        archived: false // Don't archive payment emails
      })
      .eq('id', email.id);

    if (emailUpdateError) {
      console.error('❌ Failed to update email:', emailUpdateError);
      return;
    }

    console.log('✅ Email status updated');

    // Mark queue item as completed
    console.log('\n7️⃣ Marking queue item as completed...');
    const { error: queueUpdateError } = await client
      .from('classification_queue')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', queueItem.id);

    if (queueUpdateError) {
      console.error('❌ Failed to update queue item:', queueUpdateError);
      return;
    }

    console.log('✅ Queue item marked as completed');

    console.log('\n🎉 n8n response test completed successfully!');
    console.log(`   Email: ${email.subject}`);
    console.log(`   Classification: ${classifications[0].category}`);
    console.log(`   Confidence: ${classifications[0].confidence}`);
    console.log(`   Reasoning: ${classifications[0].reasoning}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testN8nResponse().catch(console.error);
