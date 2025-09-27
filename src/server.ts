import express from 'express';
import cors from 'cors';
import { GmailWebhookHandler } from './gmail/webhook.js';
import { GmailClient } from './gmail/client.js';
import { GmailAuth } from './gmail/auth.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || process.env.MCP_SERVER_PORT || '3001', 10);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize webhook handler
const webhookHandler = new GmailWebhookHandler();

// System labels to create for new users (from PRD)
const SYSTEM_LABELS = [
  'Important information',
  'Action',
  'Newsletter', 
  'Payment',
  'Social',
  'Calendar',
  'Others'
];

/**
 * Complete user onboarding after OAuth authentication
 */
async function completeUserOnboarding(userId: string): Promise<{
  success: boolean;
  labelsCreated: number;
  watchStarted: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  let labelsCreated = 0;
  let watchStarted = false;

  try {
    console.log(`Starting onboarding for user: ${userId}`);
    
    // 1. Create Gmail client for the user
    const gmailClient = new GmailClient(userId);
    
    // 2. Create system labels
    console.log('Creating system labels...');
    for (const labelName of SYSTEM_LABELS) {
      try {
        const label = await gmailClient.createLabel(labelName);
        console.log(`Created label: ${labelName} (ID: ${label.id})`);
        labelsCreated++;
      } catch (error) {
        const errorMsg = `Failed to create label "${labelName}": ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }
    
    // 3. Start Gmail watching
    console.log('Starting Gmail watch...');
    try {
      const watchResult = await gmailClient.startWatching(userId);
      console.log('Gmail watch started:', watchResult);
      watchStarted = true;
    } catch (error) {
      const errorMsg = `Failed to start Gmail watch: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
    
    console.log(`Onboarding completed for user ${userId}: ${labelsCreated} labels, watch: ${watchStarted}`);
    
    return {
      success: errors.length === 0,
      labelsCreated,
      watchStarted,
      errors
    };
    
  } catch (error) {
    const errorMsg = `Onboarding failed: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMsg);
    errors.push(errorMsg);
    
    return {
      success: false,
      labelsCreated,
      watchStarted,
      errors
    };
  }
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = await webhookHandler.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
});

// Gmail webhook endpoint
app.post('/webhook/gmail', async (req, res) => {
  try {
    console.log('Received webhook request:', {
      headers: req.headers,
      body: req.body
    });

    // Verify webhook signature (implement based on your security requirements)
    const signature = req.headers['x-hub-signature-256'] as string;
    if (process.env.NODE_ENV === 'production' && !webhookHandler.verifySignature(JSON.stringify(req.body), signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process the push notification
    const result = await webhookHandler.handlePushNotification(req.body);

    if (result.success) {
      res.json({
        success: true,
        message: 'Webhook processed successfully',
        processed: result.processed,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
});

// OAuth URL generation endpoint
app.get('/auth/oauth-url', async (req, res) => {
  try {
    const gmailAuth = new GmailAuth();
    const authUrl = gmailAuth.generateAuthUrl();
    
    res.json({
      success: true,
      authUrl,
      message: 'Visit this URL to authorize Gmail access'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Enhanced OAuth callback endpoint with complete onboarding
app.get('/auth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    const userId = state as string;
    console.log(`OAuth callback received for user: ${userId}`);

    // 1. Complete OAuth authorization
    const auth = new GmailAuth();
    await auth.authorize(code as string, userId);
    console.log(`OAuth authorization completed for user: ${userId}`);

    // 2. Complete user onboarding
    const onboardingResult = await completeUserOnboarding(userId);
    
    // 3. Return comprehensive result
    res.json({ 
      success: true, 
      message: 'Authentication and onboarding completed',
      userId: userId,
      onboarding: onboardingResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
});

// Start Gmail watching endpoint (for manual use)
app.post('/gmail/start-watching', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const gmailClient = new GmailClient(userId);
    const result = await gmailClient.startWatching(userId);

    res.json({
      success: true,
      message: 'Gmail watching started',
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error starting Gmail watch:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
});

// Create system labels endpoint (for manual use)
app.post('/gmail/create-system-labels', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const gmailClient = new GmailClient(userId);
    const createdLabels = [];
    const errors = [];

    for (const labelName of SYSTEM_LABELS) {
      try {
        const label = await gmailClient.createLabel(labelName);
        createdLabels.push({
          name: labelName,
          id: label.id,
          success: true
        });
      } catch (error) {
        errors.push({
          name: labelName,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    res.json({
      success: errors.length === 0,
      message: `Created ${createdLabels.length} labels`,
      labels: createdLabels,
      errors: errors,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error creating system labels:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
});

// Debug endpoint to check emails in database
app.get('/debug/emails', async (req, res) => {
  try {
    const { limit = 10, userId } = req.query;
    
    let query = webhookHandler['supabaseClient'].getClient()
      .from('emails')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string));
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch emails: ${error.message}`);
    }
    
    res.json({
      success: true,
      count: data?.length || 0,
      emails: data || [],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Debug emails error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
});

// Debug endpoint to check users with tokens
app.get('/debug/users', async (req, res) => {
  try {
    const users = await webhookHandler['supabaseClient'].getAllUsersWithTokens();
    
    res.json({
      success: true,
      count: users.length,
      users: users.map(user => ({
        user_id: user.user_id,
        provider: user.provider,
        expires_at: user.expires_at,
        created_at: user.created_at
      })),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Debug users error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
});

// Debug endpoint to check all users in main users table
app.get('/debug/all-users', async (req, res) => {
  try {
    const allUsers = await webhookHandler['supabaseClient'].getAllUsers();
    
    res.json({
      success: true,
      count: allUsers.length,
      users: allUsers,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Debug all users error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
});

// Test endpoint for development
app.post('/webhook/gmail/test', async (req, res) => {
  try {
    // Mock Gmail push notification for testing with real Gmail format
    const mockNotification = {
      message: {
        data: Buffer.from(JSON.stringify({
          emailAddress: req.body.emailAddress || 'quangtm.gp@gmail.com',
          historyId: req.body.historyId || '12345'
        })).toString('base64'),
        messageId: 'test-message-id',
        publishTime: new Date().toISOString()
      },
      subscription: 'projects/techyouth2025/subscriptions/gmail-webhook-subscription'
    };

    const result = await webhookHandler.handlePushNotification(mockNotification);

    res.json({
      success: true,
      message: 'Test webhook processed',
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Gmail Webhook Server running on port ${port}`);
  console.log(`📧 Webhook endpoint: http://localhost:${port}/webhook/gmail`);
  console.log(`🧪 Test endpoint: http://localhost:${port}/webhook/gmail/test`);
  console.log(`❤️  Health check: http://localhost:${port}/health`);
  console.log(`🔐 OAuth callback: http://localhost:${port}/auth/callback`);
  console.log(`📋 System labels: http://localhost:${port}/gmail/create-system-labels`);
});

export default app;
