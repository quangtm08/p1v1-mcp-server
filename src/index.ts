#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { createMcpServer } from './mcp/server.js';
import { GmailClient } from './gmail/client.js';
import { SupabaseClient } from './database/supabase.js';

// Load environment variables
dotenv.config();

async function main() {
  const server = new Server(
    {
      name: process.env.MCP_SERVER_NAME || 'dream-mail-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Initialize clients
  const gmailClient = new GmailClient();
  const supabaseClient = new SupabaseClient();

  // Create MCP server with tools
  const mcpServer = createMcpServer(gmailClient, supabaseClient);

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: mcpServer.getTools(),
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return await mcpServer.handleToolCall(request);
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('Dream Mail MCP Server started');
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
