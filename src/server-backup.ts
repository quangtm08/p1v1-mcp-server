import express from 'express';
import cors from 'cors';
import { GmailWebhookHandler } from './gmail/webhook.js';
import { GmailClient } from './gmail/client.js';
import { GmailAuth } from './gmail/auth.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.MCP_SERVER_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize webhook handler
const webhookHandler = new GmailWebhookHandler();

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

// OAuth callback endpoint
app.get('/auth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    const auth = new GmailAuth();
    await auth.authorize(code as string, state as string);
    
    res.json({ 
      success: true, 
      message: 'Authentication successful',
      userId: state,
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

// Start Gmail watching endpoint
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
app.listen(port, () => {
  console.log(`🚀 Gmail Webhook Server running on port ${port}`);
  console.log(`📧 Webhook endpoint: http://localhost:${port}/webhook/gmail`);
  console.log(`🧪 Test endpoint: http://localhost:${port}/webhook/gmail/test`);
  console.log(`❤️  Health check: http://localhost:${port}/health`);
});

export default app;
