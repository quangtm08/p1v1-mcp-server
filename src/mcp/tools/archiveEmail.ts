import { McpTool } from '../server.js';
import { GmailClient } from '../../gmail/client.js';
import { SupabaseClient } from '../../database/supabase.js';
import { ArchiveEmailInputSchema } from '../../database/models.js';

export function archiveEmailTool(gmailClient: GmailClient, supabaseClient?: SupabaseClient): McpTool {
  return {
    name: 'archive_email',
    description: 'Archive an email by removing it from the inbox',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: {
          type: 'string',
          description: 'Gmail message ID to archive',
        },
      },
      required: ['messageId'],
    },
    handler: async (args) => {
      try {
        // Validate input
        const validatedArgs = ArchiveEmailInputSchema.parse(args);
        
        // Archive the email in Gmail
        await gmailClient.archiveEmail(validatedArgs.messageId);
        
        // Update the email record in Supabase if client is available
        if (supabaseClient) {
          try {
            await supabaseClient.updateEmail(validatedArgs.messageId, {
              is_archived: true,
              updated_at: new Date().toISOString(),
            });
          } catch (error) {
            console.warn(`Failed to update email record in database: ${error}`);
            // Don't fail the entire operation if database update fails
          }
        }
        
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
