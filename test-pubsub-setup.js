#!/usr/bin/env node

/**
 * Test script to verify Gmail push notification setup
 */

import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

async function testPubSubSetup() {
  try {
    console.log('🧪 Testing Pub/Sub setup...');
    
    // Create Pub/Sub client
    const pubsub = google.pubsub({
      version: 'v1',
      auth: new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      })
    });

    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const topicName = 'gmail-webhook-topic';
    
    if (!projectId) {
      console.error('❌ GOOGLE_CLOUD_PROJECT_ID not set');
      console.log('Set it with: heroku config:set GOOGLE_CLOUD_PROJECT_ID=your-project-id');
      return;
    }

    // Test topic existence
    try {
      const topic = await pubsub.projects.topics.get({
        name: `projects/${projectId}/topics/${topicName}`
      });
      console.log('✅ Topic exists:', topic.data.name);
    } catch (error) {
      console.error('❌ Topic not found:', error.message);
      console.log('Create the topic in Google Cloud Console first');
      return;
    }

    // Test subscription existence
    try {
      const subscription = await pubsub.projects.subscriptions.get({
        name: `projects/${projectId}/subscriptions/gmail-webhook-subscription`
      });
      console.log('✅ Subscription exists:', subscription.data.name);
      console.log('📡 Push endpoint:', subscription.data.pushConfig?.pushEndpoint);
    } catch (error) {
      console.error('❌ Subscription not found:', error.message);
      console.log('Create the subscription in Google Cloud Console first');
      return;
    }

    console.log('🎉 Pub/Sub setup looks good!');
    
  } catch (error) {
    console.error('❌ Error testing Pub/Sub setup:', error.message);
  }
}

testPubSubSetup();
