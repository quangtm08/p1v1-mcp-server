import { McpTool } from '../server.js';
import { GmailClient } from '../../gmail/client.js';
import { SupabaseClient } from '../../database/supabase.js';
import { GetEmailsInputSchema } from '../../database/models.js';

export function getEmailsTool(supabaseClient: SupabaseClient): McpTool {
  return {
    name: 'get_emails',
    description: 'Fetch emails from Gmail with optional filtering and store metadata in Supabase',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to fetch emails for',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of emails to fetch (1-100)',
          minimum: 1,
          maximum: 100,
          default: 10,
        },
        query: {
          type: 'string',
          description: 'Gmail search query (e.g., "from:example@gmail.com", "subject:urgent")',
        },
        labelIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of label IDs to filter by',
        },
        includeSpamTrash: {
          type: 'boolean',
          description: 'Whether to include spam and trash emails',
          default: false,
        },
      },
      required: ['userId'],
    },
    handler: async (args) => {
      try {
        // Validate input
        const validatedArgs = GetEmailsInputSchema.parse(args);
        
        // Create user-specific Gmail client
        const userGmailClient = new GmailClient(validatedArgs.userId);
        
        // Fetch emails from Gmail
        const emails = await userGmailClient.getEmails({
          maxResults: validatedArgs.maxResults,
          q: validatedArgs.query,
          labelIds: validatedArgs.labelIds,
          includeSpamTrash: validatedArgs.includeSpamTrash,
        });

        // Process and store emails in Supabase
        const processedEmails = [];
        
        for (const email of emails) {
          try {
            // Extract email metadata
            const headers = email.payload.headers;
            const subject = headers.find(h => h.name === 'Subject')?.value || '';
            const fromAddress = headers.find(h => h.name === 'From')?.value || '';
            const toAddresses = headers.find(h => h.name === 'To')?.value || '';
            const ccAddresses = headers.find(h => h.name === 'Cc')?.value || '';
            
            // Convert comma-separated strings to arrays
            const toAddressesArray = toAddresses ? toAddresses.split(',').map(addr => addr.trim()) : [];
            const ccAddressesArray = ccAddresses ? ccAddresses.split(',').map(addr => addr.trim()) : [];
            const date = headers.find(h => h.name === 'Date')?.value || '';

            // Extract body content
            let body = '';
            if (email.payload.body?.data) {
              body = Buffer.from(email.payload.body.data, 'base64').toString('utf-8');
            } else if (email.payload.parts) {
              // Handle multipart emails
              for (const part of email.payload.parts) {
                if (part.mimeType === 'text/plain' && part.body?.data) {
                  body = Buffer.from(part.body.data, 'base64').toString('utf-8');
                  break;
                } else if (part.mimeType === 'text/html' && part.body?.data && !body) {
                  body = Buffer.from(part.body.data, 'base64').toString('utf-8');
                }
              }
            }

            // Check if email already exists in database
            const existingEmail = await supabaseClient.getEmailByMessageId(email.id);
            
            if (existingEmail) {
              // Update existing email
              const updatedEmail = await supabaseClient.updateEmail(email.id, {
                labels: email.labelIds || [],
                snippet: email.snippet,
                body: body,
                updated_at: new Date().toISOString(),
              });
              processedEmails.push(updatedEmail);
            } else {
              // Create new email record
              const newEmail = await supabaseClient.saveEmail({
                user_id: validatedArgs.userId,
                message_id: email.id,
                thread_id: email.threadId,
                subject: subject,
                from_address: fromAddress,
                to_addresses: toAddressesArray,
                cc_addresses: ccAddressesArray,
                snippet: email.snippet,
                body: body,
                labels: email.labelIds || [],
                received_at: date,
                archived: !(email.labelIds || []).includes('INBOX'),
                raw_json: email,
              });
              processedEmails.push(newEmail);
            }
          } catch (error) {
            console.error(`Error processing email ${email.id}:`, error);
            // Continue processing other emails
          }
        }

        return {
          success: true,
          count: processedEmails.length,
          emails: processedEmails.map(email => ({
            id: email.message_id,
            subject: email.subject,
            from: email.from_address,
            to: email.to_addresses,
            snippet: email.snippet,
            labels: email.labels,
            received_at: email.received_at,
            archived: email.archived,
          })),
        };
      } catch (error) {
        console.error('Error in get_emails tool:', error);
        throw new Error(`Failed to get emails: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}
