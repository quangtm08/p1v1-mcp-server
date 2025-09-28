#!/usr/bin/env node

import { SupabaseClient } from '../../dist/database/supabase.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkClassification() {
  console.log('🔍 Checking classification result\n');

  const supabaseClient = new SupabaseClient();
  const client = supabaseClient.getClient();
  const emailId = '236c818e-7219-47e7-bdb3-791a0658435d';

  try {
    // Check classification result
    console.log('1️⃣ Checking classification result...');
    const { data: classification, error: classificationError } = await client
      .from('classifications')
      .select('*')
      .eq('email_id', emailId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (classificationError) {
      console.error('❌ Failed to get classification:', classificationError);
      return;
    }

    if (classification && classification.length > 0) {
      console.log('✅ Classification found:');
      console.log(JSON.stringify(classification[0], null, 2));
    } else {
      console.log('❌ No classification found');
    }

    // Check queue status
    console.log('\n2️⃣ Checking queue status...');
    const { data: queueItem, error: queueError } = await client
      .from('classification_queue')
      .select('*')
      .eq('email_id', emailId)
      .single();

    if (queueError) {
      console.error('❌ Failed to get queue item:', queueError);
    } else if (queueItem) {
      console.log('✅ Queue item status:');
      console.log(`   Status: ${queueItem.status}`);
      console.log(`   Attempts: ${queueItem.attempts}`);
      console.log(`   Processed at: ${queueItem.processed_at}`);
    }

    // Check email status
    console.log('\n3️⃣ Checking email status...');
    const { data: email, error: emailError } = await client
      .from('emails')
      .select('processed_at, archived')
      .eq('id', emailId)
      .single();

    if (emailError) {
      console.error('❌ Failed to get email:', emailError);
    } else if (email) {
      console.log('✅ Email status:');
      console.log(`   Processed at: ${email.processed_at}`);
      console.log(`   Archived: ${email.archived}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the check
checkClassification().catch(console.error);
