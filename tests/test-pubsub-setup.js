#!/usr/bin/env node

/**
 * Test script to verify Gmail push notification setup
 * 
 * Usage: node tests/test-pubsub-setup.js [PROJECT_ID]
 * Example: node tests/test-pubsub-setup.js techyouth2025
 */

import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

// Get project ID from command line argument or environment variable
const PROJECT_ID = process.argv[2] || process.env.GOOGLE_CLOUD_PROJECT_ID || 'techyouth2025';

async function testPubSubSetup() {
  try {
    console.log('🧪 Testing Pub/Sub setup...');
    console.log(`📋 Project ID: ${PROJECT_ID}\n`);
    
    // Create Pub/Sub client
    const pubsub = google.pubsub({
      version: 'v1',
      auth: new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      })
    });

    const topicName = 'gmail-webhook-topic';
    
    // Test topic existence
    try {
      const topic = await pubsub.projects.topics.get({
        name: `projects/${PROJECT_ID}/topics/${topicName}`
      });
      console.log('✅ Topic exists:', topic.data.name);
    } catch (error) {
      console.log('❌ Topic not found:', error.message);
      console.log('💡 Create topic with: gcloud pubsub topics create gmail-webhook-topic');
      return;
    }

    // Test subscription existence
    try {
      const subscription = await pubsub.projects.subscriptions.get({
        name: `projects/${PROJECT_ID}/subscriptions/gmail-webhook-subscription`
      });
      console.log('✅ Subscription exists:', subscription.data.name);
      console.log('📡 Push endpoint:', subscription.data.pushConfig?.pushEndpoint);
    } catch (error) {
      console.log('❌ Subscription not found:', error.message);
      console.log('💡 Create subscription with: gcloud pubsub subscriptions create gmail-webhook-subscription --topic=gmail-webhook-topic --push-endpoint=https://your-webhook.herokuapp.com/webhook/gmail');
      return;
    }

    console.log('\n🎉 Pub/Sub setup is correct!');
    console.log('📧 Gmail notifications should be delivered to your webhook');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure you have:');
    console.log('1. Google Cloud SDK installed and authenticated');
    console.log('2. Correct project ID');
    console.log('3. Pub/Sub API enabled');
  }
}

testPubSubSetup();