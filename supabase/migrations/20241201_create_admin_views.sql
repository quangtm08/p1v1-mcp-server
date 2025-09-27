-- Migration: Create admin views that exclude sensitive email content
-- This ensures admin can monitor the system without accessing email content

-- View for admin email statistics (no content, just counts)
CREATE VIEW admin_email_stats AS
SELECT 
  user_id,
  COUNT(*) as email_count,
  COUNT(CASE WHEN archived = true THEN 1 END) as archived_count,
  COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END) as processed_count,
  COUNT(CASE WHEN processed_at IS NULL THEN 1 END) as pending_count,
  MIN(received_at) as first_email,
  MAX(received_at) as last_email,
  COUNT(CASE WHEN received_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as emails_last_24h,
  COUNT(CASE WHEN received_at >= NOW() - INTERVAL '7 days' THEN 1 END) as emails_last_7d
FROM emails
GROUP BY user_id;

-- View for admin email metadata (MINIMAL data - only system info)
CREATE VIEW admin_email_metadata AS
SELECT 
  id,
  user_id,
  message_id,
  thread_id,
  received_at,
  processed_at,
  archived,
  created_at,
  updated_at
FROM emails;
-- Note: subject, from_address, to_addresses, cc_addresses, labels, body, snippet, raw_json, tsv are intentionally excluded

-- View for admin classification stats
CREATE VIEW admin_classification_stats AS
SELECT 
  c.user_id,
  c.category_key,
  COUNT(*) as classification_count,
  AVG(c.score) as avg_confidence,
  MIN(c.created_at) as first_classification,
  MAX(c.created_at) as last_classification
FROM classifications c
GROUP BY c.user_id, c.category_key;

-- View for admin safety queue stats
CREATE VIEW admin_safety_queue_stats AS
SELECT 
  sq.user_id,
  sq.severity,
  sq.status,
  COUNT(*) as queue_count,
  MIN(sq.created_at) as oldest_item,
  MAX(sq.created_at) as newest_item
FROM safety_queue sq
GROUP BY sq.user_id, sq.severity, sq.status;

-- Grant permissions for admin views
GRANT SELECT ON admin_email_stats TO authenticated;
GRANT SELECT ON admin_email_metadata TO authenticated;
GRANT SELECT ON admin_classification_stats TO authenticated;
GRANT SELECT ON admin_safety_queue_stats TO authenticated;

-- Add comments for documentation
COMMENT ON VIEW admin_email_stats IS 'Admin view: Email statistics without content access';
COMMENT ON VIEW admin_email_metadata IS 'Admin view: Minimal email metadata - only system fields, no content or addresses';
COMMENT ON VIEW admin_classification_stats IS 'Admin view: Classification statistics';
COMMENT ON VIEW admin_safety_queue_stats IS 'Admin view: Safety queue statistics';
