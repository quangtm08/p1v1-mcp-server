import { McpTool } from '../server.js';
import { GmailClient } from '../../gmail/client.js';
import { SupabaseClient } from '../../database/supabase.js';
import { ArchiveEmailInputSchema } from '../../database/models.js';

export function archiveEmailTool(): McpTool {
  return {
    name: 'archive_email',
    description: 'Archive an email by removing it from the inbox',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to archive email for',
        },
        messageId: {
          type: 'string',
          description: 'Gmail message ID to archive',
        },
      },
      required: ['userId', 'messageId'],
    },
    handler: async (args) => {
      try {
        // Validate input
        const validatedArgs = ArchiveEmailInputSchema.parse(args);
        
        // Create user-specific Gmail client
        const userGmailClient = new GmailClient(validatedArgs.userId);
        
        // Archive the email in Gmail
        await userGmailClient.archiveEmail(validatedArgs.messageId);
        
        // Note: Email record update would need to be handled separately
        // since we don't have access to supabaseClient in this tool
        
        return {
          success: true,
          message: `Email ${validatedArgs.messageId} archived successfully`,
        };
      } catch (error) {
        console.error('Error in archive_email tool:', error);
        throw new Error(`Failed to archive email: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}
