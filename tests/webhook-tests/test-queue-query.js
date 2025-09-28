#!/usr/bin/env node

import dotenv from 'dotenv';

dotenv.config();

async function testQueueQuery() {
  console.log('🔍 Testing queue query directly\n');

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing environment variables');
    return;
  }

  try {
    // Test the exact same query the webhook uses
    const queryUrl = `${SUPABASE_URL}/rest/v1/classification_queue?status=eq.pending&attempts=lt.3&order=created_at.asc`;
    console.log('Query URL:', queryUrl);
    
    const response = await fetch(queryUrl, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Range': '0-19'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const queueItems = await response.json();
    
    console.log('Queue fetch result:', {
      queueItemsCount: queueItems?.length || 0,
      sampleQueueItem: queueItems?.[0] || null
    });
    
    console.log('Full queue items array:', JSON.stringify(queueItems, null, 2));

    if (!queueItems || queueItems.length === 0) {
      console.log('❌ No pending items found');
      return;
    }

    // Test fetching emails for the first queue item
    const firstQueueItem = queueItems[0];
    console.log('\n📧 Testing email fetch for first queue item...');
    
    const emailResponse = await fetch(`${SUPABASE_URL}/rest/v1/emails?id=eq.${firstQueueItem.email_id}`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    });
    
    console.log('Email response status:', emailResponse.status);
    const emails = await emailResponse.json();
    
    console.log('Email fetch result:', {
      emailCount: emails?.length || 0,
      email: emails?.[0] || null
    });

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testQueueQuery().catch(console.error);
