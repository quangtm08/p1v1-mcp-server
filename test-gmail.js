#!/usr/bin/env node

import { SupabaseClient } from './dist/database/supabase.js';
import { GmailClient } from './dist/gmail/client.js';
import { GmailAuth } from './dist/gmail/auth.js';
import dotenv from 'dotenv';

dotenv.config();

async function testGmailIntegration() {
  console.log('🧪 Testing Gmail Integration with Existing Tokens\n');

  const supabaseClient = new SupabaseClient();

  try {
    // 1. Check what users have tokens in your database
    console.log('1️⃣ Checking existing tokens in your database...');
    const users = await supabaseClient.getAllUsersWithTokens();
    
    if (users.length === 0) {
      console.log('❌ No users found with tokens in your database');
      console.log('💡 You need to add your Gmail tokens to the email_tokens table first');
      return;
    }

    console.log(`✅ Found ${users.length} users with tokens:`);
    users.forEach((user, index) => {
      console.log(`   ${index + 1}. User: ${user.user_id}`);
      console.log(`      Provider: ${user.provider}`);
      console.log(`      Expires: ${user.expires_at}`);
      console.log(`      Created: ${user.created_at}\n`);
    });

    // 2. Test with the first user
    const testUser = users[0];
    console.log(`2️⃣ Testing Gmail connection for user: ${testUser.user_id}`);

    // Check if token is expired
    const gmailAuth = new GmailAuth(supabaseClient);
    const isExpired = await gmailAuth.isTokenExpired(testUser.user_id);
    console.log(`   🔑 Token status: ${isExpired ? 'EXPIRED' : 'VALID'}`);

    try {
      const gmailClient = new GmailClient(testUser.user_id);
      
      // Test getting labels
      console.log('   📋 Fetching Gmail labels...');
      const labels = await gmailClient.getLabels();
      console.log(`   ✅ Successfully connected! Found ${labels.length} labels`);
      
      // Show some labels
      const systemLabels = labels.filter(label => label.type === 'system').slice(0, 5);
      console.log('   📁 System labels:');
      systemLabels.forEach(label => {
        console.log(`      - ${label.name} (${label.messagesTotal || 0} messages)`);
      });

      // Test getting emails
      console.log('\n   📧 Fetching recent emails...');
      const emails = await gmailClient.getEmails({ maxResults: 3 });
      console.log(`   ✅ Found ${emails.length} recent emails`);
      
      emails.forEach((email, index) => {
        const subject = email.payload.headers.find(h => h.name === 'Subject')?.value || 'No Subject';
        const from = email.payload.headers.find(h => h.name === 'From')?.value || 'Unknown';
        console.log(`      ${index + 1}. ${subject} (from: ${from})`);
      });

    } catch (error) {
      console.log(`   ❌ Gmail connection failed: ${error.message}`);
      
      if (error.message.includes('Token refresh failed')) {
        console.log('   💡 Your token might be expired. You need to refresh it.');
        console.log('   🔧 To refresh: Update the tokens in your Supabase email_tokens table');
      } else if (error.message.includes('No valid tokens found')) {
        console.log('   💡 No valid tokens found. Check your token format.');
      }
    }

    // 3. Test MCP tools
    console.log('\n3️⃣ Testing MCP tools...');
    try {
      const { getEmailsTool } = await import('./dist/mcp/tools/getEmails.js');
      const gmailClient = new GmailClient();
      const tool = getEmailsTool(supabaseClient);
      
      console.log('   ✅ MCP tool created successfully');
      console.log(`   📝 Tool name: ${tool.name}`);
      console.log(`   📋 Required parameters: ${tool.inputSchema.required.join(', ')}`);
      
      // Test the tool with your user
      console.log('\n   🧪 Testing tool execution...');
      const result = await tool.handler({
        userId: testUser.user_id,
        maxResults: 2
      });
      
      console.log('   ✅ Tool executed successfully!');
      console.log(`   📊 Result: ${JSON.stringify(result, null, 2)}`);
      
    } catch (error) {
      console.log(`   ❌ MCP tool test failed: ${error.message}`);
    }

    console.log('\n🎉 Test completed!');
    console.log('\n📋 Summary:');
    console.log(`   - Found ${users.length} users with tokens`);
    console.log(`   - Tested Gmail connection for: ${testUser.user_id}`);
    console.log('   - MCP tools are working');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure your .env file has correct Supabase credentials');
    console.log('2. Check that the email_tokens table exists in your Supabase');
    console.log('3. Verify your tokens are valid and not expired');
  }
}

// Run the test
testGmailIntegration().catch(console.error);
