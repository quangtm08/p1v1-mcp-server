import { McpTool } from '../server.js';
import { GmailClient } from '../../gmail/client.js';
import { CreateLabelInputSchema } from '../../database/models.js';

export function createLabelTool(): McpTool {
  return {
    name: 'create_label',
    description: 'Create a new Gmail label for organizing emails',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to create label for',
        },
        name: {
          type: 'string',
          description: 'Name of the label to create',
          minLength: 1,
        },
        labelListVisibility: {
          type: 'string',
          enum: ['labelShow', 'labelHide'],
          description: 'Whether the label is visible in the label list',
          default: 'labelShow',
        },
        messageListVisibility: {
          type: 'string',
          enum: ['show', 'hide'],
          description: 'Whether messages with this label are visible in the message list',
          default: 'show',
        },
      },
      required: ['userId', 'name'],
    },
    handler: async (args) => {
      try {
        // Validate input
        const validatedArgs = CreateLabelInputSchema.parse(args);
        
        // Create user-specific Gmail client
        const userGmailClient = new GmailClient(validatedArgs.userId);
        
        // Create the label in Gmail
        const label = await userGmailClient.createLabel(validatedArgs.name);
        
        return {
          success: true,
          label: {
            id: label.id,
            name: label.name,
            type: label.type,
            labelListVisibility: label.labelListVisibility,
            messageListVisibility: label.messageListVisibility,
            messagesTotal: label.messagesTotal || 0,
            messagesUnread: label.messagesUnread || 0,
            threadsTotal: label.threadsTotal || 0,
            threadsUnread: label.threadsUnread || 0,
          },
        };
      } catch (error) {
        console.error('Error in create_label tool:', error);
        throw new Error(`Failed to create label: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}
