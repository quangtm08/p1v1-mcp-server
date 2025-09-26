import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { GmailClient } from '../gmail/client.js';
import { SupabaseClient } from '../database/supabase.js';
import { getEmailsTool } from './tools/getEmails.js';
import { createLabelTool } from './tools/createLabel.js';
import { archiveEmailTool } from './tools/archiveEmail.js';

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  handler: (args: any) => Promise<any>;
}

export class McpServer {
  private tools: McpTool[] = [];

  constructor(
    private gmailClient: GmailClient,
    private supabaseClient: SupabaseClient
  ) {
    this.initializeTools();
  }

  private initializeTools() {
    this.tools = [
      getEmailsTool(this.gmailClient, this.supabaseClient),
      createLabelTool(this.gmailClient),
      archiveEmailTool(this.gmailClient),
    ];
  }

  getTools() {
    return this.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }

  async handleToolCall(request: CallToolRequestSchema) {
    const { name, arguments: args } = request.params;
    
    const tool = this.tools.find(t => t.name === name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    try {
      const result = await tool.handler(args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
}

export function createMcpServer(gmailClient: GmailClient, supabaseClient: SupabaseClient) {
  return new McpServer(gmailClient, supabaseClient);
}
