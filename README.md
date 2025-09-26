# Dream Mail MCP Server

A Model Context Protocol (MCP) server for Gmail integration with the Dream Mail dashboard. This server provides tools for email management, automation, and integration with Supabase and n8n workflows.

## Features

- **Gmail API Integration**: Fetch, label, and archive emails
- **Supabase Integration**: Store email metadata and user preferences
- **MCP Tools**: Standardized tools for email operations
- **Webhook Support**: Handle Gmail push notifications
- **n8n Integration**: Trigger automation workflows

## Setup

### Prerequisites

- Node.js 18+ 
- Gmail API credentials
- Supabase project
- n8n instance (optional)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd dream-mail-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp env.example .env
```

4. Configure your environment variables in `.env`

5. Build the project:
```bash
npm run build
```

6. Start the server:
```bash
npm start
```

### Development

For development with hot reload:
```bash
npm run dev
```

## Environment Variables

See `env.example` for all required environment variables.

## MCP Tools

The server provides the following MCP tools:

- `get_emails`: Fetch emails from Gmail
- `create_label`: Create Gmail labels
- `archive_email`: Archive emails
- `classify_email`: Classify emails using AI
- `apply_rules`: Apply custom email rules

## API Endpoints

- `POST /webhook/gmail`: Gmail push notification endpoint
- `GET /health`: Health check endpoint

## Architecture

```
src/
├── index.ts                 # MCP server entry point
├── gmail/
│   ├── client.ts           # Gmail API client
│   ├── auth.ts             # Token management
│   └── webhook.ts          # Gmail push notifications
├── database/
│   ├── supabase.ts         # Database connection
│   └── models.ts           # Data models
└── mcp/
    ├── server.ts           # MCP server setup
    └── tools/
        ├── getEmails.ts    # MCP tool for fetching emails
        ├── createLabel.ts  # MCP tool for creating labels
        └── archiveEmail.ts # MCP tool for archiving
```

## License

MIT
