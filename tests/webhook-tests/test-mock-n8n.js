#!/usr/bin/env node

import { SupabaseClient } from '../../dist/database/supabase.js';
import dotenv from 'dotenv';

dotenv.config();

async function testMockN8n() {
  console.log('🧪 Testing with mock n8n response\n');

  const supabaseClient = new SupabaseClient();
  const client = supabaseClient.getClient();

  try {
    // Get the pending queue item
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

    // Simulate successful n8n response
    console.log('\n3️⃣ Simulating successful n8n classification...');
    const mockN8nResponse = {
      classifications: [{
        email_id: email.id,
        category: 'billing',
        confidence: 0.95
      }]
    };

    console.log('Mock n8n response:', JSON.stringify(mockN8nResponse, null, 2));

    // Store the classification result
    console.log('\n4️⃣ Storing classification result...');
    const { error: classificationError } = await client
      .from('classifications')
      .insert({
        email_id: email.id,
        user_id: queueItem.user_id,
        category_key: mockN8nResponse.classifications[0].category,
        score: mockN8nResponse.classifications[0].confidence,
        source: 'ai',
        model: 'gpt-4o-mini',
        raw_response: mockN8nResponse
      });

    if (classificationError) {
      console.error('❌ Failed to store classification:', classificationError);
      return;
    }

    console.log('✅ Classification stored successfully');

    // Update email status
    console.log('\n5️⃣ Updating email status...');
    const { error: emailUpdateError } = await client
      .from('emails')
      .update({
        processed_at: new Date().toISOString(),
        archived: false // Don't archive billing emails
      })
      .eq('id', email.id);

    if (emailUpdateError) {
      console.error('❌ Failed to update email:', emailUpdateError);
      return;
    }

    console.log('✅ Email status updated');

    // Mark queue item as completed
    console.log('\n6️⃣ Marking queue item as completed...');
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

    console.log('\n🎉 Mock n8n test completed successfully!');
    console.log(`   Email: ${email.subject}`);
    console.log(`   Classification: ${mockN8nResponse.classifications[0].category}`);
    console.log(`   Confidence: ${mockN8nResponse.classifications[0].confidence}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testMockN8n().catch(console.error);
