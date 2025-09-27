import { SupabaseClient } from './database/supabase.js';
import { GmailClient } from './gmail/client.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface ClassificationQueueItem {
  id: string;
  email_id: string;
  user_id: string;
  status: string;
  attempts: number;
  payload?: any;
  created_at: string;
  updated_at: string;
  processed_at?: string;
}

interface EmailData {
  id: string;
  user_id: string;
  message_id: string;
  thread_id: string;
  subject: string;
  from_address: string;
  to_addresses: any;
  cc_addresses?: any;
  snippet: string;
  body: string;
  labels: any;
  received_at: string;
  archived: boolean;
}

interface ClassificationResult {
  email_id: string;
  category: string;
  confidence: number;
  reasoning: string;
}

interface N8nResponse {
  classifications: ClassificationResult[];
  success: boolean;
  error?: string;
}

export class BatchClassificationService {
  private supabaseClient: SupabaseClient;
  private n8nWebhookUrl: string;
  private batchSize: number;
  private processingInterval: number;
  private maxRetries: number;
  private isRunning: boolean = false;
  private testMode: boolean = false;

  constructor() {
    this.supabaseClient = new SupabaseClient();
    this.n8nWebhookUrl = process.env.N8N_CLASSIFICATION_WEBHOOK_URL || '';
    this.batchSize = parseInt(process.env.BATCH_SIZE || '10');
    this.processingInterval = parseInt(process.env.PROCESSING_INTERVAL || '60000'); // 1 minute
    this.maxRetries = parseInt(process.env.MAX_RETRIES || '3');
    this.testMode = process.env.TEST_MODE === 'true' || !this.n8nWebhookUrl;

    if (!this.n8nWebhookUrl && !this.testMode) {
      throw new Error('N8N_CLASSIFICATION_WEBHOOK_URL environment variable is required');
    }

    console.log('BatchClassificationService initialized with:', {
      n8nWebhookUrl: this.n8nWebhookUrl || 'TEST_MODE',
      batchSize: this.batchSize,
      processingInterval: this.processingInterval,
      maxRetries: this.maxRetries,
      testMode: this.testMode
    });
  }

  /**
   * Get unprocessed items from classification_queue
   */
  async getUnprocessedItems(): Promise<ClassificationQueueItem[]> {
    try {
      console.log('Fetching unprocessed items from classification_queue...');
      
      const { data, error } = await this.supabaseClient.getClient()
        .from('classification_queue')
        .select(`
          id,
          email_id,
          user_id,
          status,
          attempts,
          payload,
          created_at,
          updated_at,
          processed_at
        `)
        .is('processed_at', null)
        .eq('status', 'pending')
        .lt('attempts', this.maxRetries)
        .order('created_at', { ascending: true })
        .limit(this.batchSize);

      if (error) {
        throw new Error(`Failed to fetch unprocessed items: ${error.message}`);
      }

      console.log(`Found ${data?.length || 0} unprocessed items`);
      return data || [];
    } catch (error) {
      console.error('Error fetching unprocessed items:', error);
      throw error;
    }
  }

  /**
   * Get email data for classification queue items
   */
  async getEmailDataForItems(items: ClassificationQueueItem[]): Promise<EmailData[]> {
    try {
      const emailIds = items.map(item => item.email_id);
      
      const { data, error } = await this.supabaseClient.getClient()
        .from('emails')
        .select(`
          id,
          user_id,
          message_id,
          thread_id,
          subject,
          from_address,
          to_addresses,
          cc_addresses,
          snippet,
          body,
          labels,
          received_at,
          archived
        `)
        .in('id', emailIds);

      if (error) {
        throw new Error(`Failed to fetch email data: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching email data:', error);
      throw error;
    }
  }

  /**
   * Send batch to n8n webhook for classification
   */
  async sendBatchToN8n(emails: EmailData[]): Promise<N8nResponse> {
    if (this.testMode) {
      return this.mockClassification(emails);
    }

    try {
      console.log(`Sending batch of ${emails.length} emails to n8n webhook...`);

      const payload = {
        emails: emails.map(email => ({
          email_id: email.id,
          user_id: email.user_id,
          message_id: email.message_id,
          subject: email.subject,
          from_address: email.from_address,
          snippet: email.snippet,
          body: email.body.substring(0, 2000), // Limit body size for API
          received_at: email.received_at
        }))
      };

      const response = await fetch(this.n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DreamMail-BatchService/1.0'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`n8n webhook responded with status ${response.status}: ${response.statusText}`);
      }

      const result: N8nResponse = await response.json();
      
      if (!result.success) {
        throw new Error(`n8n classification failed: ${result.error || 'Unknown error'}`);
      }

      console.log(`Successfully received classifications for ${result.classifications.length} emails`);
      return result;
    } catch (error) {
      console.error('Error sending batch to n8n:', error);
      throw error;
    }
  }

  /**
   * Mock classification for testing (when n8n is not available)
   */
  private mockClassification(emails: EmailData[]): N8nResponse {
    console.log(`🧪 TEST MODE: Mocking classification for ${emails.length} emails`);
    
    const classifications: ClassificationResult[] = emails.map(email => {
      // Simple mock classification logic based on email content
      let category = 'Others';
      let confidence = 0.8;
      let reasoning = 'Mock classification for testing';

      const subject = email.subject.toLowerCase();
      const fromAddress = email.from_address.toLowerCase();
      const snippet = email.snippet.toLowerCase();

      // Mock classification rules
      if (subject.includes('newsletter') || fromAddress.includes('newsletter') || snippet.includes('unsubscribe')) {
        category = 'Newsletter';
        confidence = 0.9;
        reasoning = 'Contains newsletter indicators (unsubscribe, newsletter in subject/from)';
      } else if (subject.includes('payment') || subject.includes('invoice') || subject.includes('receipt')) {
        category = 'Payment';
        confidence = 0.95;
        reasoning = 'Contains payment-related keywords';
      } else if (subject.includes('meeting') || subject.includes('calendar') || subject.includes('appointment')) {
        category = 'Calendar';
        confidence = 0.85;
        reasoning = 'Contains calendar/meeting keywords';
      } else if (subject.includes('urgent') || subject.includes('important') || subject.includes('asap')) {
        category = 'Important information';
        confidence = 0.9;
        reasoning = 'Contains urgency indicators';
      } else if (subject.includes('action') || subject.includes('todo') || subject.includes('task')) {
        category = 'Action';
        confidence = 0.8;
        reasoning = 'Contains action-related keywords';
      } else if (fromAddress.includes('facebook') || fromAddress.includes('twitter') || fromAddress.includes('linkedin')) {
        category = 'Social';
        confidence = 0.9;
        reasoning = 'From social media platform';
      }

      return {
        email_id: email.id,
        category,
        confidence,
        reasoning
      };
    });

    console.log(`🧪 TEST MODE: Generated ${classifications.length} mock classifications`);
    classifications.forEach(c => {
      console.log(`  - Email ${c.email_id}: ${c.category} (${Math.round(c.confidence * 100)}%)`);
    });

    return {
      classifications,
      success: true
    };
  }

  /**
   * Process classification results from n8n
   */
  async processResults(
    queueItems: ClassificationQueueItem[], 
    classifications: ClassificationResult[]
  ): Promise<void> {
    try {
      console.log(`Processing ${classifications.length} classification results...`);

      for (const classification of classifications) {
        const queueItem = queueItems.find(item => item.email_id === classification.email_id);
        if (!queueItem) {
          console.warn(`No queue item found for email_id: ${classification.email_id}`);
          continue;
        }

        try {
          // Apply classification to email
          await this.applyClassification(queueItem, classification);
          
          // Mark as processed
          await this.markAsProcessed(queueItem.id);
          
          console.log(`Successfully processed email ${classification.email_id} with category: ${classification.category}`);
        } catch (error) {
          console.error(`Error processing email ${classification.email_id}:`, error);
          await this.markAsFailed(queueItem.id, error instanceof Error ? error.message : String(error));
        }
      }
    } catch (error) {
      console.error('Error processing classification results:', error);
      throw error;
    }
  }

  /**
   * Apply classification to email (update database and apply Gmail labels)
   */
  async applyClassification(queueItem: ClassificationQueueItem, classification: ClassificationResult): Promise<void> {
    try {
      // 1. Update email record with basic classification info
      const { error: updateError } = await this.supabaseClient.getClient()
        .from('emails')
        .update({
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', queueItem.email_id);

      if (updateError) {
        throw new Error(`Failed to update email: ${updateError.message}`);
      }

      // 2. Save classification log
      const { error: logError } = await this.supabaseClient.getClient()
        .from('classifications')
        .insert({
          email_id: queueItem.email_id,
          user_id: queueItem.user_id,
          category_key: classification.category.toLowerCase().replace(/\s+/g, '_'),
          score: classification.confidence,
          source: 'batch_service',
          model: 'mock_classifier',
          raw_response: JSON.stringify({
            category: classification.category,
            confidence: classification.confidence,
            reasoning: classification.reasoning
          })
        });

      if (logError) {
        console.error('Failed to save classification log:', logError);
        // Don't throw here - classification is still applied to email
      }

      // 3. Apply Gmail labels
      await this.applyGmailLabels(queueItem.user_id, queueItem.email_id, classification.category);

    } catch (error) {
      console.error('Error applying classification:', error);
      throw error;
    }
  }

  /**
   * Apply Gmail labels based on classification
   */
  async applyGmailLabels(userId: string, emailId: string, category: string): Promise<void> {
    if (this.testMode) {
      console.log(`🧪 TEST MODE: Would apply label '${category}' to email ${emailId} for user ${userId}`);
      return;
    }

    try {
      // Get email data to find message_id
      const { data: emailData, error: emailError } = await this.supabaseClient.getClient()
        .from('emails')
        .select('*')
        .eq('id', emailId)
        .single();

      if (emailError || !emailData) {
        throw new Error(`Email not found: ${emailId}`);
      }

      // Create Gmail client for user
      const gmailClient = new GmailClient(userId);
      
      // Map category to Gmail label name
      const labelName = this.mapCategoryToLabel(category);
      
      // Get existing labels to check if our label exists
      const existingLabels = await gmailClient.getLabels();
      const existingLabel = existingLabels.find(label => label.name === labelName);
      
      let labelId: string;
      if (existingLabel) {
        labelId = existingLabel.id;
      } else {
        // Create new label
        const newLabel = await gmailClient.createLabel(labelName);
        labelId = newLabel.id;
      }
      
      // Apply label to email
      await gmailClient.addLabel(emailData.message_id, [labelId]);
      
      // Archive if not important category
      if (!this.isImportantCategory(category)) {
        await gmailClient.archiveEmail(emailData.message_id);
      }

      console.log(`Applied label '${labelName}' (${labelId}) to email ${emailData.message_id}`);
    } catch (error) {
      console.error('Error applying Gmail labels:', error);
      throw error;
    }
  }

  /**
   * Map category to Gmail label name
   */
  private mapCategoryToLabel(category: string): string {
    const categoryMap: { [key: string]: string } = {
      'Important information': 'Important information',
      'Action': 'Action',
      'Newsletter': 'Newsletter',
      'Payment': 'Payment',
      'Social': 'Social',
      'Calendar': 'Calendar',
      'Others': 'Others'
    };
    
    return categoryMap[category] || 'Others';
  }

  /**
   * Check if category is important (should not be archived)
   */
  private isImportantCategory(category: string): boolean {
    const importantCategories = ['Important information', 'Action', 'Payment'];
    return importantCategories.includes(category);
  }

  /**
   * Mark queue item as processed
   */
  async markAsProcessed(queueItemId: string): Promise<void> {
    const { error } = await this.supabaseClient.getClient()
      .from('classification_queue')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', queueItemId);

    if (error) {
      throw new Error(`Failed to mark as processed: ${error.message}`);
    }
  }

  /**
   * Mark queue item as failed
   */
  async markAsFailed(queueItemId: string, errorMessage: string): Promise<void> {
    // First get the current attempts count
    const { data: currentItem } = await this.supabaseClient.getClient()
      .from('classification_queue')
      .select('attempts')
      .eq('id', queueItemId)
      .single();

    const newAttempts = (currentItem?.attempts || 0) + 1;

    const { error } = await this.supabaseClient.getClient()
      .from('classification_queue')
      .update({
        status: 'failed',
        attempts: newAttempts,
        payload: { error: errorMessage },
        updated_at: new Date().toISOString()
      })
      .eq('id', queueItemId);

    if (error) {
      console.error(`Failed to mark as failed: ${error.message}`);
    }
  }

  /**
   * Process a single batch
   */
  async processBatch(): Promise<void> {
    try {
      console.log('Starting batch processing...');
      
      // 1. Get unprocessed items
      const queueItems = await this.getUnprocessedItems();
      if (queueItems.length === 0) {
        console.log('No items to process');
        return;
      }

      // 2. Get email data for items
      const emails = await this.getEmailDataForItems(queueItems);
      if (emails.length === 0) {
        console.log('No email data found for queue items');
        return;
      }

      // 3. Send to n8n for classification
      const results = await this.sendBatchToN8n(emails);

      // 4. Process results
      await this.processResults(queueItems, results.classifications);

      console.log(`Batch processing completed successfully for ${queueItems.length} items`);
    } catch (error) {
      console.error('Error in batch processing:', error);
      throw error;
    }
  }

  /**
   * Start the batch service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Batch service is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting batch classification service...');

    // Process immediately on start
    await this.processBatch();

    // Set up interval
    const intervalId = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(intervalId);
        return;
      }

      try {
        await this.processBatch();
      } catch (error) {
        console.error('Error in scheduled batch processing:', error);
      }
    }, this.processingInterval);

    console.log(`Batch service started with ${this.processingInterval}ms interval`);
  }

  /**
   * Stop the batch service
   */
  stop(): void {
    this.isRunning = false;
    console.log('Batch service stopped');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; queueSize: number; timestamp: string }> {
    try {
      const { count } = await this.supabaseClient.getClient()
        .from('classification_queue')
        .select('*', { count: 'exact', head: true })
        .is('processed_at', null);

      return {
        status: 'healthy',
        queueSize: count || 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        queueSize: -1,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const service = new BatchClassificationService();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    service.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    service.stop();
    process.exit(0);
  });

  // Start the service
  service.start().catch(error => {
    console.error('Failed to start batch service:', error);
    process.exit(1);
  });
}
