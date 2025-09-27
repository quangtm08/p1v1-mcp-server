import { SupabaseClient } from './dist/database/supabase.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function checkQueueStatus() {
  const supabaseClient = new SupabaseClient();
  
  console.log('📊 Checking classification queue status...');
  
  try {
    // Get all items in classification queue
    const { data: queueItems, error: queueError } = await supabaseClient.getClient()
      .from('classification_queue')
      .select(`
        id,
        email_id,
        user_id,
        status,
        attempts,
        created_at,
        processed_at,
        emails!inner(
          subject,
          from_address,
          message_id
        )
      `)
      .order('created_at', { ascending: false });

    if (queueError) {
      console.error('Error fetching queue items:', queueError);
      return;
    }

    console.log(`\n📋 Classification Queue Status (${queueItems?.length || 0} items):`);
    console.log('=' .repeat(80));
    
    if (!queueItems || queueItems.length === 0) {
      console.log('No items in classification queue.');
      return;
    }

    // Separate items by status
    const completedItems = queueItems.filter(item => item.processed_at);
    const pendingItems = queueItems.filter(item => !item.processed_at && item.status === 'pending');
    const failedItems = queueItems.filter(item => item.status === 'failed');

    // Show completed items
    if (completedItems.length > 0) {
      console.log('\n✅ COMPLETED ITEMS:');
      console.log('-'.repeat(40));
      completedItems.forEach((item, index) => {
        const email = item.emails;
        console.log(`${index + 1}. ${email.subject}`);
        console.log(`   From: ${email.from_address}`);
        console.log(`   Attempts: ${item.attempts}`);
        console.log(`   Processed: ${new Date(item.processed_at).toLocaleString()}`);
        console.log('');
      });
    }

    // Show pending items
    if (pendingItems.length > 0) {
      console.log('\n⏳ PENDING ITEMS:');
      console.log('-'.repeat(40));
      pendingItems.forEach((item, index) => {
        const email = item.emails;
        console.log(`${index + 1}. ${email.subject}`);
        console.log(`   From: ${email.from_address}`);
        console.log(`   Attempts: ${item.attempts}`);
        console.log(`   Created: ${new Date(item.created_at).toLocaleString()}`);
        console.log('');
      });
    }

    // Show failed items
    if (failedItems.length > 0) {
      console.log('\n❌ FAILED ITEMS:');
      console.log('-'.repeat(40));
      failedItems.forEach((item, index) => {
        const email = item.emails;
        console.log(`${index + 1}. ${email.subject}`);
        console.log(`   From: ${email.from_address}`);
        console.log(`   Attempts: ${item.attempts}`);
        console.log(`   Created: ${new Date(item.created_at).toLocaleString()}`);
        console.log(`   Email ID: ${item.email_id}`);
        console.log('');
      });
    }

    // Get summary stats
    console.log('📈 Summary:');
    console.log(`   Pending: ${pendingItems.length}`);
    console.log(`   Completed: ${completedItems.length}`);
    console.log(`   Failed: ${failedItems.length}`);

    // Show recommendations for failed items
    if (failedItems.length > 0) {
      console.log('\n🔧 Recommendations for failed items:');
      console.log('1. Check n8n workflow configuration');
      console.log('2. Verify OpenAI API key and limits');
      console.log('3. Check email content format');
      console.log('4. Review n8n execution logs');
      console.log('5. Try reprocessing failed items');
    }

  } catch (error) {
    console.error('Error checking queue status:', error);
  }
}

// Run the check
checkQueueStatus().catch(console.error);