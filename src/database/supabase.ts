import { createClient, SupabaseClient as SupabaseClientType } from '@supabase/supabase-js';

export interface EmailRecord {
  id: string;
  gmail_id: string;
  thread_id: string;
  subject: string;
  sender: string;
  recipient: string;
  snippet: string;
  body: string;
  label_ids: string[];
  received_at: string;
  classified_category?: string;
  is_archived: boolean;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRule {
  id: string;
  user_id: string;
  name: string;
  conditions: any;
  actions: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClassificationLog {
  id: string;
  email_id: string;
  category: string;
  confidence: number;
  reasoning: string;
  created_at: string;
}

export class SupabaseClient {
  private client: SupabaseClientType;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and key are required');
    }

    this.client = createClient(supabaseUrl, supabaseKey);
  }

  // Email operations
  async saveEmail(email: Partial<EmailRecord>): Promise<EmailRecord> {
    const { data, error } = await this.client
      .from('emails')
      .insert(email)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save email: ${error.message}`);
    }

    return data;
  }

  async getEmailByGmailId(gmailId: string): Promise<EmailRecord | null> {
    const { data, error } = await this.client
      .from('emails')
      .select('*')
      .eq('gmail_id', gmailId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw new Error(`Failed to get email: ${error.message}`);
    }

    return data;
  }

  async updateEmail(gmailId: string, updates: Partial<EmailRecord>): Promise<EmailRecord> {
    const { data, error } = await this.client
      .from('emails')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('gmail_id', gmailId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update email: ${error.message}`);
    }

    return data;
  }

  async getEmailsByCategory(category: string, limit = 50): Promise<EmailRecord[]> {
    const { data, error } = await this.client
      .from('emails')
      .select('*')
      .eq('classified_category', category)
      .order('received_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get emails by category: ${error.message}`);
    }

    return data || [];
  }

  // User rules operations
  async getUserRules(userId: string): Promise<UserRule[]> {
    const { data, error } = await this.client
      .from('user_rules')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get user rules: ${error.message}`);
    }

    return data || [];
  }

  async saveUserRule(rule: Partial<UserRule>): Promise<UserRule> {
    const { data, error } = await this.client
      .from('user_rules')
      .insert(rule)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save user rule: ${error.message}`);
    }

    return data;
  }

  // Classification log operations
  async saveClassificationLog(log: Partial<ClassificationLog>): Promise<ClassificationLog> {
    const { data, error } = await this.client
      .from('classification_logs')
      .insert(log)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save classification log: ${error.message}`);
    }

    return data;
  }

  async getClassificationStats(): Promise<any> {
    const { data, error } = await this.client
      .from('classification_logs')
      .select('category')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      throw new Error(`Failed to get classification stats: ${error.message}`);
    }

    // Count categories
    const stats = (data || []).reduce((acc: any, log: any) => {
      acc[log.category] = (acc[log.category] || 0) + 1;
      return acc;
    }, {});

    return stats;
  }

  // Safety queue operations
  async getSafetyQueueEmails(): Promise<EmailRecord[]> {
    const { data, error } = await this.client
      .from('emails')
      .select('*')
      .eq('classified_category', 'safety_queue')
      .order('received_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get safety queue emails: ${error.message}`);
    }

    return data || [];
  }

  async moveEmailToSafetyQueue(gmailId: string): Promise<void> {
    await this.updateEmail(gmailId, { classified_category: 'safety_queue' });
  }

  async removeEmailFromSafetyQueue(gmailId: string, newCategory: string): Promise<void> {
    await this.updateEmail(gmailId, { classified_category: newCategory });
  }

  // Get raw Supabase client for custom queries
  getClient(): SupabaseClientType {
    return this.client;
  }
}
