# Admin Data Isolation Implementation

## Overview

This implementation provides secure admin access to system monitoring without exposing sensitive email content. The solution separates system operations (full access for processing) from admin operations (limited access for monitoring).

## Security Model

### 🔧 System Operations (SupabaseClient)
- **Purpose**: Email processing, classification, and automation
- **Access**: Full access to all data (uses service role key)
- **Used by**: MCP server, batch processing, email classification
- **Data Access**: Complete email content, user data, tokens

### 🛡️ Admin Operations (AdminSupabaseClient)
- **Purpose**: System monitoring and statistics
- **Access**: Limited to metadata and statistics only
- **Used by**: Admin dashboard, monitoring tools
- **Data Access**: Statistics, metadata, no email content

## Implementation Details

### Database Views

The following views provide filtered access to email data:

```sql
-- Statistics only (no content)
admin_email_stats
- user_id, email_count, archived_count, processed_count, etc.

-- Minimal metadata only (no content, addresses, or subjects)
admin_email_metadata  
- id, user_id, message_id, thread_id, received_at, processed_at, archived, timestamps

-- Classification statistics
admin_classification_stats
- user_id, category_key, classification_count, avg_confidence, etc.

-- Safety queue statistics
admin_safety_queue_stats
- user_id, severity, status, queue_count, etc.
```

### Client Classes

#### SupabaseClient (System Operations)
```typescript
const supabase = new SupabaseClient();

// Full access for processing
await supabase.saveEmail(emailData);
await supabase.getAllUsers();
await supabase.getEmailToken(userId);

// Get admin client for monitoring
const adminClient = supabase.getAdminClient();
```

#### AdminSupabaseClient (Admin Operations)
```typescript
const adminClient = new AdminSupabaseClient();

// Limited access for monitoring
const overview = await adminClient.getSystemOverview();
const emailStats = await adminClient.getEmailStats();
const emailMetadata = await adminClient.getEmailMetadata(100);
const users = await adminClient.getUsers();
```

## Usage Examples

### System Operations (MCP Server)
```typescript
import { SupabaseClient } from './src/database/supabase';

const supabase = new SupabaseClient();

// Process emails (full access needed)
async function processEmails() {
  const users = await supabase.getAllUsersWithTokens();
  
  for (const user of users) {
    const token = await supabase.getEmailToken(user.user_id);
    // Process emails with full access
  }
}
```

### Admin Monitoring
```typescript
import { AdminSupabaseClient } from './src/database/admin-supabase';

const adminClient = new AdminSupabaseClient();

// Monitor system without content access
async function getSystemStatus() {
  const overview = await adminClient.getSystemOverview();
  
  console.log(`Total users: ${overview.users.total}`);
  console.log(`Total emails: ${overview.emails.total}`);
  console.log(`Processed: ${overview.emails.processed}`);
  console.log(`Pending: ${overview.emails.pending}`);
  
  // No access to email content
  const metadata = await adminClient.getEmailMetadata(10);
  // metadata contains: id, user_id, message_id, thread_id, received_at, processed_at, archived
  // metadata does NOT contain: body, snippet, raw_json, tsv, subject, from_address, to_addresses, cc_addresses, labels
}
```

### Admin Dashboard
```typescript
// Admin dashboard - show stats without content
async function renderAdminDashboard() {
  const adminClient = new AdminSupabaseClient();
  
  const [
    overview,
    emailStats,
    classificationStats,
    safetyStats,
    users
  ] = await Promise.all([
    adminClient.getSystemOverview(),
    adminClient.getEmailStats(),
    adminClient.getClassificationStats(),
    adminClient.getSafetyQueueStats(),
    adminClient.getUsers()
  ]);
  
  // Render dashboard with statistics only
  // No email content is accessible
}
```

## Testing

Run the test script to verify implementation:

```bash
node test-admin-isolation.js
```

This will test:
- ✅ System operations still work (full access)
- ✅ Admin operations are limited (no content access)
- ✅ Database views filter sensitive content
- ✅ RLS policies remain intact

## Migration Steps

1. **Apply Database Migration**:
   ```bash
   # Run the migration in Supabase SQL editor
   supabase/migrations/20241201_create_admin_views.sql
   ```

2. **Update Code**:
   - Use `SupabaseClient` for system operations
   - Use `AdminSupabaseClient` for admin monitoring
   - Update admin interfaces to use filtered methods

3. **Test Implementation**:
   ```bash
   node test-admin-isolation.js
   ```

## Security Benefits

### ✅ What's Protected
- **Email content**: Body, snippet, raw JSON not accessible to admin
- **User privacy**: Admin cannot browse user emails
- **Data isolation**: Users still isolated from each other
- **System functionality**: MCP server can still process emails

### ✅ What's Available
- **System monitoring**: Statistics, counts, processing status
- **User management**: User profiles, settings, preferences
- **System health**: Queue status, error rates, performance metrics
- **Email metadata**: Message IDs, timestamps, processing status (for debugging)

## Best Practices

1. **Use Appropriate Client**:
   - `SupabaseClient` for system operations
   - `AdminSupabaseClient` for admin monitoring

2. **Never Mix Access Levels**:
   - Don't use system client for admin operations
   - Don't use admin client for system operations

3. **Monitor Access Patterns**:
   - Log admin access for audit purposes
   - Alert on unusual admin activity

4. **Regular Testing**:
   - Run test script regularly
   - Verify views are working correctly
   - Check that sensitive content is filtered

## Troubleshooting

### Admin Can't See Data
- Check database views exist: `admin_email_stats`, `admin_email_metadata`
- Verify view permissions are granted
- Check Supabase service role key is configured

### System Operations Failing
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is set
- Check RLS policies allow service role access
- Verify database connections

### Sensitive Content Leaking
- Check view definitions exclude sensitive fields
- Verify admin client uses views, not direct table access
- Run test script to validate filtering

## Files Modified

- `supabase/migrations/20241201_create_admin_views.sql` - Database views
- `src/database/admin-supabase.ts` - Admin client class
- `src/database/supabase.ts` - Updated system client
- `test-admin-isolation.js` - Test script
- `ADMIN_ISOLATION.md` - This documentation
