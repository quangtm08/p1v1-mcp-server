#!/usr/bin/env node

/**
 * Simple Admin Dashboard Example
 * 
 * This demonstrates how to use AdminSupabaseClient for system monitoring
 * without accessing sensitive email content.
 */

import { config } from 'dotenv';
import { AdminSupabaseClient } from '../dist/database/admin-supabase.js';

// Load environment variables
config();

class AdminDashboard {
  constructor() {
    this.adminClient = new AdminSupabaseClient();
  }

  async renderDashboard() {
    console.log('📊 Gmail Assistant Admin Dashboard');
    console.log('=====================================\n');

    try {
      // Get system overview
      const overview = await this.adminClient.getSystemOverview();
      
      // Render system stats
      this.renderSystemStats(overview);
      
      // Render user stats
      this.renderUserStats(overview.users.stats);
      
      // Render email stats
      this.renderEmailStats(overview.emails);
      
      // Render classification stats
      this.renderClassificationStats(overview.classifications.stats);
      
      // Render safety queue stats
      this.renderSafetyQueueStats(overview.safetyQueue.stats);
      
      // Render recent activity
      await this.renderRecentActivity();
      
    } catch (error) {
      console.error('❌ Error loading dashboard:', error);
    }
  }

  renderSystemStats(overview) {
    console.log('🔧 System Overview');
    console.log('------------------');
    console.log(`Total Users: ${overview.users.total}`);
    console.log(`Total Emails: ${overview.emails.total}`);
    console.log(`Processed: ${overview.emails.processed}`);
    console.log(`Pending: ${overview.emails.pending}`);
    console.log(`Archived: ${overview.emails.archived}`);
    console.log(`Last 24h: ${overview.emails.last24h}`);
    console.log(`Last 7d: ${overview.emails.last7d}`);
    console.log('');
  }

  renderUserStats(userStats) {
    console.log('👥 User Statistics');
    console.log('------------------');
    
    if (userStats.length === 0) {
      console.log('No users found');
    } else {
      userStats.slice(0, 10).forEach(stat => {
        console.log(`User ${stat.user_id}:`);
        console.log(`  Emails: ${stat.email_count}`);
        console.log(`  Processed: ${stat.processed_count}`);
        console.log(`  Pending: ${stat.pending_count}`);
        console.log(`  Last Email: ${stat.last_email ? new Date(stat.last_email).toLocaleDateString() : 'N/A'}`);
        console.log('');
      });
    }
  }

  renderEmailStats(emailStats) {
    console.log('📧 Email Processing');
    console.log('-------------------');
    console.log(`Total: ${emailStats.total}`);
    console.log(`Processed: ${emailStats.processed} (${((emailStats.processed / emailStats.total) * 100).toFixed(1)}%)`);
    console.log(`Pending: ${emailStats.pending} (${((emailStats.pending / emailStats.total) * 100).toFixed(1)}%)`);
    console.log(`Archived: ${emailStats.archived} (${((emailStats.archived / emailStats.total) * 100).toFixed(1)}%)`);
    console.log('');
  }

  renderClassificationStats(classificationStats) {
    console.log('🏷️ Classification Statistics');
    console.log('-----------------------------');
    
    if (classificationStats.length === 0) {
      console.log('No classifications found');
    } else {
      classificationStats.slice(0, 10).forEach(stat => {
        console.log(`${stat.category_key}:`);
        console.log(`  Count: ${stat.classification_count}`);
        console.log(`  Avg Confidence: ${(stat.avg_confidence * 100).toFixed(1)}%`);
        console.log('');
      });
    }
  }

  renderSafetyQueueStats(safetyStats) {
    console.log('🛡️ Safety Queue');
    console.log('---------------');
    
    if (safetyStats.length === 0) {
      console.log('No safety queue items');
    } else {
      safetyStats.forEach(stat => {
        console.log(`${stat.severity} (${stat.status}): ${stat.queue_count} items`);
      });
    }
    console.log('');
  }

  async renderRecentActivity() {
    console.log('📈 Recent Activity');
    console.log('------------------');
    
    try {
      // Get recent email metadata (no content)
      const recentEmails = await this.adminClient.getEmailMetadata(5);
      
      if (recentEmails.length === 0) {
        console.log('No recent emails');
      } else {
        recentEmails.forEach(email => {
          console.log(`${new Date(email.received_at).toLocaleString()}:`);
          console.log(`  Message ID: ${email.message_id}`);
          console.log(`  User: ${email.user_id}`);
          console.log(`  Processed: ${email.processed_at ? 'Yes' : 'No'}`);
          console.log(`  Archived: ${email.archived ? 'Yes' : 'No'}`);
          console.log('');
        });
      }
      
      // Get queue status
      const queueStatus = await this.adminClient.getQueueStatus();
      if (queueStatus.length > 0) {
        console.log('Processing Queue:');
        queueStatus.forEach(status => {
          console.log(`  ${status.status}: ${status.count} items`);
        });
      }
      
    } catch (error) {
      console.log('Error loading recent activity:', error.message);
    }
  }
}

// Run the dashboard
async function main() {
  const dashboard = new AdminDashboard();
  await dashboard.renderDashboard();
}

main().catch(console.error);
