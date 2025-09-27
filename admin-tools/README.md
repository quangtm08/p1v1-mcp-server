# Admin Tools

This directory contains administrative tools for monitoring and managing the Gmail Assistant system.

## Available Tools

### Admin Dashboard
```bash
node admin-tools/admin-dashboard.js
```

**Purpose**: Provides a comprehensive system overview without accessing sensitive email content.

**Features**:
- System statistics (users, emails, processing rates)
- User activity monitoring
- Email processing status
- Classification statistics
- Safety queue monitoring
- Recent activity (metadata only)

**Security**: Uses `AdminSupabaseClient` which only accesses filtered database views that exclude sensitive content.

## Usage

### Prerequisites
1. Ensure environment variables are set (`.env` file)
2. Build the project: `npm run build`
3. Apply database migrations (admin views)

### Running the Dashboard
```bash
# From project root
node admin-tools/admin-dashboard.js
```

### Example Output
```
📊 Gmail Assistant Admin Dashboard
=====================================

🔧 System Overview
------------------
Total Users: 2
Total Emails: 9
Processed: 0
Pending: 9
Archived: 0

👥 User Statistics
------------------
User 62bdd1e1-68cc-49fd-b10f-3ecf45298301:
  Emails: 7
  Processed: 0
  Pending: 7
  Last Email: 9/27/2025
```

## Security Model

- **No Email Content Access**: Dashboard cannot view email bodies, subjects, or addresses
- **Metadata Only**: Only system fields like message IDs, timestamps, processing status
- **Audit Trail**: All admin access is logged for compliance
- **Role-Based Access**: Different admin roles have different permissions

## Adding New Admin Tools

When creating new admin tools:

1. **Use AdminSupabaseClient**: Never use the main SupabaseClient for admin operations
2. **Follow Security Guidelines**: Only access filtered views, never raw tables
3. **Add Documentation**: Document what data the tool accesses
4. **Test Security**: Verify no sensitive content is exposed

## Database Views Used

- `admin_email_stats` - Email statistics per user
- `admin_email_metadata` - Minimal email metadata (no content)
- `admin_classification_stats` - Classification statistics
- `admin_safety_queue_stats` - Safety queue statistics

## Troubleshooting

### "Supabase URL and key are required"
- Check `.env` file exists and has correct values
- Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set

### "Cannot find module"
- Run `npm run build` to compile TypeScript files
- Check that `dist/` folder contains compiled files

### "No data returned"
- Verify database views exist: `admin_email_stats`, `admin_email_metadata`
- Check RLS policies are properly configured
- Ensure service role key has correct permissions
