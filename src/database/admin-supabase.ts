import { createClient, SupabaseClient as SupabaseClientType } from '@supabase/supabase-js';

/**
 * AdminSupabaseClient - Provides limited admin access without exposing sensitive email content
 * 
 * SECURITY MODEL:
 * - Uses service role key but filters out sensitive data
 * - Admin can monitor system stats but cannot read email content
 * - All email body, snippet, and raw content is excluded
 * - Only metadata and statistics are accessible
 */
export class AdminSupabaseClient {
  private client: SupabaseClientType;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and service role key are required for admin access');
    }

    this.client = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get email statistics per user (no content access)
   */
  async getEmailStats(): Promise<any[]> {
    const { data, error } = await this.client
      .from('admin_email_stats')
      .select('*')
      .order('email_count', { ascending: false });

    if (error) {
      throw new Error(`Failed to get email stats: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get email metadata without content (MINIMAL data - only system fields)
   * Excludes: subject, from_address, to_addresses, cc_addresses, labels, body, snippet, raw_json
   */
  async getEmailMetadata(limit = 100): Promise<any[]> {
    const { data, error } = await this.client
      .from('admin_email_metadata')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get email metadata: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get email processing status for debugging (no sensitive content)
   */
  async getEmailProcessingStatus(limit = 50): Promise<any[]> {
    const { data, error } = await this.client
      .from('admin_email_metadata')
      .select('id, user_id, message_id, received_at, processed_at, archived')
      .order('received_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get email processing status: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get classification statistics
   */
  async getClassificationStats(): Promise<any[]> {
    const { data, error } = await this.client
      .from('admin_classification_stats')
      .select('*')
      .order('classification_count', { ascending: false });

    if (error) {
      throw new Error(`Failed to get classification stats: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get safety queue statistics
   */
  async getSafetyQueueStats(): Promise<any[]> {
    const { data, error } = await this.client
      .from('admin_safety_queue_stats')
      .select('*')
      .order('queue_count', { ascending: false });

    if (error) {
      throw new Error(`Failed to get safety queue stats: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get system overview statistics
   */
  async getSystemOverview(): Promise<any> {
    const [emailStats, classificationStats, safetyStats] = await Promise.all([
      this.getEmailStats(),
      this.getClassificationStats(),
      this.getSafetyQueueStats()
    ]);

    // Calculate totals
    const totalUsers = emailStats.length;
    const totalEmails = emailStats.reduce((sum, stat) => sum + stat.email_count, 0);
    const totalArchived = emailStats.reduce((sum, stat) => sum + stat.archived_count, 0);
    const totalProcessed = emailStats.reduce((sum, stat) => sum + stat.processed_count, 0);
    const totalPending = emailStats.reduce((sum, stat) => sum + stat.pending_count, 0);

    return {
      users: {
        total: totalUsers,
        stats: emailStats
      },
      emails: {
        total: totalEmails,
        archived: totalArchived,
        processed: totalProcessed,
        pending: totalPending,
        last24h: emailStats.reduce((sum, stat) => sum + (stat.emails_last_24h || 0), 0),
        last7d: emailStats.reduce((sum, stat) => sum + (stat.emails_last_7d || 0), 0)
      },
      classifications: {
        stats: classificationStats
      },
      safetyQueue: {
        stats: safetyStats
      }
    };
  }

  /**
   * Get user list (profiles only, no email content)
   */
  async getUsers(): Promise<any[]> {
    const { data, error } = await this.client
      .from('profiles')
      .select('id, display_name, email, timezone, is_admin, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get users: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get rules statistics (no rule content)
   */
  async getRulesStats(): Promise<any[]> {
    const { data, error } = await this.client
      .from('rules')
      .select('user_id, enabled, priority, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get rules stats: ${error.message}`);
    }

    // Group by user
    const userRules = (data || []).reduce((acc: any, rule: any) => {
      if (!acc[rule.user_id]) {
        acc[rule.user_id] = { total: 0, enabled: 0, disabled: 0 };
      }
      acc[rule.user_id].total++;
      if (rule.enabled) {
        acc[rule.user_id].enabled++;
      } else {
        acc[rule.user_id].disabled++;
      }
      return acc;
    }, {});

    return Object.entries(userRules).map(([userId, stats]: [string, any]) => ({
      user_id: userId,
      ...stats
    }));
  }

  /**
   * Get digest settings statistics
   */
  async getDigestStats(): Promise<any[]> {
    const { data, error } = await this.client
      .from('digest_settings')
      .select('user_id, frequency, time_of_day, timezone, include_summary, last_sent_at, next_run_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get digest stats: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get email tokens statistics (no actual tokens)
   */
  async getTokenStats(): Promise<any[]> {
    const { data, error } = await this.client
      .from('email_tokens')
      .select('user_id, provider, expires_at, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get token stats: ${error.message}`);
    }

    // Group by user and provider
    const tokenStats = (data || []).reduce((acc: any, token: any) => {
      const key = `${token.user_id}_${token.provider}`;
      if (!acc[key]) {
        acc[key] = {
          user_id: token.user_id,
          provider: token.provider,
          created_at: token.created_at,
          updated_at: token.updated_at,
          expires_at: token.expires_at,
          is_expired: token.expires_at ? new Date(token.expires_at) < new Date() : false
        };
      }
      return acc;
    }, {});

    return Object.values(tokenStats);
  }

  /**
   * Check if a specific email exists (metadata only)
   */
  async emailExists(messageId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('admin_email_metadata')
      .select('id')
      .eq('message_id', messageId)
      .limit(1);

    if (error) {
      throw new Error(`Failed to check email existence: ${error.message}`);
    }

    return (data && data.length > 0);
  }

  /**
   * Get processing queue status
   */
  async getQueueStatus(): Promise<any> {
    const { data, error } = await this.client
      .from('classification_queue')
      .select('status');

    if (error) {
      throw new Error(`Failed to get queue status: ${error.message}`);
    }

    // Group by status manually
    const statusCounts = (data || []).reduce((acc: any, item: any) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count
    }));
  }

  /**
   * Get raw Supabase client for custom queries (use with caution)
   * Only use this for non-sensitive operations
   */
  getClient(): SupabaseClientType {
    return this.client;
  }
}
