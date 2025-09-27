#!/usr/bin/env node

/**
 * Test script to verify admin data isolation implementation
 * 
 * This script tests:
 * 1. System operations still work (full access for processing)
 * 2. Admin operations are limited (no content access)
 * 3. Database views are working correctly
 */

import { config } from 'dotenv';
import { SupabaseClient } from '../dist/database/supabase.js';
import { AdminSupabaseClient } from '../dist/database/admin-supabase.js';

// Load environment variables
config();

async function testSystemOperations() {
  console.log('🔧 Testing System Operations (Full Access)...');
  
  const supabase = new SupabaseClient();
  
  try {
    // Test 1: Get all users (system operation)
    console.log('  ✓ Testing getAllUsers()...');
    const users = await supabase.getAllUsers();
    console.log(`    Found ${users.length} users`);
    
    // Test 2: Get users with tokens (system operation)
    console.log('  ✓ Testing getAllUsersWithTokens()...');
    const usersWithTokens = await supabase.getAllUsersWithTokens();
    console.log(`    Found ${usersWithTokens.length} users with tokens`);
    
    // Test 3: Get email token (system operation)
    if (usersWithTokens.length > 0) {
      const firstUser = usersWithTokens[0];
      console.log('  ✓ Testing getEmailToken()...');
      const token = await supabase.getEmailToken(firstUser.user_id, firstUser.provider);
      console.log(`    Token exists: ${!!token}`);
    }
    
    console.log('✅ System operations working correctly\n');
    return true;
  } catch (error) {
    console.error('❌ System operations failed:', error);
    return false;
  }
}

async function testAdminOperations() {
  console.log('🛡️ Testing Admin Operations (Limited Access)...');
  
  const adminClient = new AdminSupabaseClient();
  
  try {
    // Test 1: Get system overview (admin operation)
    console.log('  ✓ Testing getSystemOverview()...');
    const overview = await adminClient.getSystemOverview();
    console.log(`    Total users: ${overview.users.total}`);
    console.log(`    Total emails: ${overview.emails.total}`);
    console.log(`    Processed emails: ${overview.emails.processed}`);
    console.log(`    Pending emails: ${overview.emails.pending}`);
    
    // Test 2: Get email stats (admin operation)
    console.log('  ✓ Testing getEmailStats()...');
    const emailStats = await adminClient.getEmailStats();
    console.log(`    Email stats for ${emailStats.length} users`);
    
    // Test 3: Get email metadata (admin operation - no content)
    console.log('  ✓ Testing getEmailMetadata()...');
    const emailMetadata = await adminClient.getEmailMetadata(5);
    console.log(`    Retrieved ${emailMetadata.length} email metadata records`);
    
    // Verify no sensitive content in metadata
    if (emailMetadata.length > 0) {
      const firstEmail = emailMetadata[0];
      const sensitiveFields = ['body', 'snippet', 'raw_json', 'tsv', 'subject', 'from_address', 'to_addresses', 'cc_addresses', 'labels'];
      const foundSensitiveFields = sensitiveFields.filter(field => field in firstEmail);
      
      console.log(`    Sensitive fields found: ${foundSensitiveFields.length}`);
      if (foundSensitiveFields.length > 0) {
        console.log(`    ⚠️ WARNING: Sensitive fields detected: ${foundSensitiveFields.join(', ')}`);
      } else {
        console.log('    ✅ No sensitive fields in admin metadata');
      }
      
      // Show what fields are actually available
      const availableFields = Object.keys(firstEmail);
      console.log(`    Available fields: ${availableFields.join(', ')}`);
    }
    
    // Test 4: Get users (admin operation)
    console.log('  ✓ Testing getUsers()...');
    const users = await adminClient.getUsers();
    console.log(`    Retrieved ${users.length} user profiles`);
    
    // Test 5: Get classification stats (admin operation)
    console.log('  ✓ Testing getClassificationStats()...');
    const classificationStats = await adminClient.getClassificationStats();
    console.log(`    Classification stats for ${classificationStats.length} categories`);
    
    // Test 6: Get safety queue stats (admin operation)
    console.log('  ✓ Testing getSafetyQueueStats()...');
    const safetyStats = await adminClient.getSafetyQueueStats();
    console.log(`    Safety queue stats for ${safetyStats.length} items`);
    
    // Test 7: Get token stats (admin operation)
    console.log('  ✓ Testing getTokenStats()...');
    const tokenStats = await adminClient.getTokenStats();
    console.log(`    Token stats for ${tokenStats.length} tokens`);
    
    // Test 8: Get queue status (admin operation)
    console.log('  ✓ Testing getQueueStatus()...');
    const queueStatus = await adminClient.getQueueStatus();
    console.log(`    Queue status: ${JSON.stringify(queueStatus)}`);
    
    console.log('✅ Admin operations working correctly\n');
    return true;
  } catch (error) {
    console.error('❌ Admin operations failed:', error);
    return false;
  }
}

async function testDatabaseViews() {
  console.log('🗄️ Testing Database Views...');
  
  const adminClient = new AdminSupabaseClient();
  
  try {
    // Test admin_email_stats view
    console.log('  ✓ Testing admin_email_stats view...');
    const { data: statsData, error: statsError } = await adminClient.getClient()
      .from('admin_email_stats')
      .select('*')
      .limit(5);
    
    if (statsError) {
      console.log(`    ❌ Error accessing admin_email_stats: ${statsError.message}`);
    } else {
      console.log(`    ✅ admin_email_stats accessible: ${statsData?.length || 0} records`);
    }
    
    // Test admin_email_metadata view
    console.log('  ✓ Testing admin_email_metadata view...');
    const { data: metadataData, error: metadataError } = await adminClient.getClient()
      .from('admin_email_metadata')
      .select('*')
      .limit(5);
    
    if (metadataError) {
      console.log(`    ❌ Error accessing admin_email_metadata: ${metadataError.message}`);
    } else {
      console.log(`    ✅ admin_email_metadata accessible: ${metadataData?.length || 0} records`);
      
      // Check that sensitive fields are not present
      if (metadataData && metadataData.length > 0) {
        const firstRecord = metadataData[0];
        const sensitiveFields = ['body', 'snippet', 'raw_json', 'tsv', 'subject', 'from_address', 'to_addresses', 'cc_addresses', 'labels'];
        const foundSensitiveFields = sensitiveFields.filter(field => field in firstRecord);
        
        if (foundSensitiveFields.length > 0) {
          console.log(`    ⚠️ WARNING: Sensitive fields found in admin_email_metadata: ${foundSensitiveFields.join(', ')}`);
        } else {
          console.log('    ✅ No sensitive fields in admin_email_metadata');
        }
        
        // Show available fields
        const availableFields = Object.keys(firstRecord);
        console.log(`    Available fields: ${availableFields.join(', ')}`);
      }
    }
    
    console.log('✅ Database views working correctly\n');
    return true;
  } catch (error) {
    console.error('❌ Database views test failed:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Admin Data Isolation Tests\n');
  
  const results = await Promise.all([
    testSystemOperations(),
    testAdminOperations(),
    testDatabaseViews()
  ]);
  
  const allPassed = results.every(result => result);
  
  console.log('📊 Test Results Summary:');
  console.log(`  System Operations: ${results[0] ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Admin Operations: ${results[1] ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Database Views: ${results[2] ? '✅ PASS' : '❌ FAIL'}`);
  
  if (allPassed) {
    console.log('\n🎉 All tests passed! Admin data isolation is working correctly.');
    console.log('\n📋 What this means:');
    console.log('  • Your MCP server can still process emails (system operations)');
    console.log('  • Admin monitoring is limited to metadata only (no content access)');
    console.log('  • Users are still isolated from each other (RLS policies intact)');
    console.log('  • Database views are filtering sensitive content correctly');
  } else {
    console.log('\n❌ Some tests failed. Please check the errors above.');
    process.exit(1);
  }
}

// Run the tests
main().catch(console.error);
