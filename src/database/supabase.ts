import { createClient, SupabaseClient as SupabaseClientType } from '@supabase/supabase-js';

export interface EmailRecord {
  id: string;
  user_id: string;
  message_id: string;
  thread_id: string;
  subject: string;
  from_address: string;
  to_addresses: any;
  cc_addresses?: any;
  snippet: string;
  body: string;
  labels: any;
  received_at: string;
  processed_at?: string;
  archived: boolean;
  raw_json?: any;
  tsv?: string;
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

export interface EmailToken {
  id: string;
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
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

  async getEmailByMessageId(messageId: string): Promise<EmailRecord | null> {
    const { data, error } = await this.client
      .from('emails')
      .select('*')
      .eq('message_id', messageId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw new Error(`Failed to get email: ${error.message}`);
    }

    return data;
  }

  async updateEmail(messageId: string, updates: Partial<EmailRecord>): Promise<EmailRecord> {
    const { data, error } = await this.client
      .from('emails')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('message_id', messageId)
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

  async moveEmailToSafetyQueue(messageId: string): Promise<void> {
    // Note: Safety queue functionality would need to be implemented
    // based on your specific requirements
    console.log(`Moving email ${messageId} to safety queue`);
  }

  async removeEmailFromSafetyQueue(messageId: string, newCategory: string): Promise<void> {
    // Note: Safety queue functionality would need to be implemented
    // based on your specific requirements
    console.log(`Removing email ${messageId} from safety queue to ${newCategory}`);
  }

  // Email token operations
  async getEmailToken(userId: string, provider: string = 'gmail'): Promise<EmailToken | null> {
    const { data, error } = await this.client
      .from('email_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw new Error(`Failed to get email token: ${error.message}`);
    }

    return data;
  }

  async saveEmailToken(token: Partial<EmailToken>): Promise<EmailToken> {
    const { data, error } = await this.client
      .from('email_tokens')
      .upsert({
        ...token,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save email token: ${error.message}`);
    }

    return data;
  }

  async updateEmailToken(userId: string, provider: string, updates: Partial<EmailToken>): Promise<EmailToken> {
    const { data, error } = await this.client
      .from('email_tokens')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('provider', provider)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update email token: ${error.message}`);
    }

    return data;
  }

  async deleteEmailToken(userId: string, provider: string): Promise<void> {
    const { error } = await this.client
      .from('email_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('provider', provider);

    if (error) {
      throw new Error(`Failed to delete email token: ${error.message}`);
    }
  }

  async getAllUsersWithTokens(): Promise<EmailToken[]> {
    const { data, error } = await this.client
      .from('email_tokens')
      .select('*')
      .eq('provider', 'gmail');

    if (error) {
      throw new Error(`Failed to get users with tokens: ${error.message}`);
    }

    return data || [];
  }

  async getAllUsers(): Promise<any[]> {
    // Try different possible table names for users
    const possibleTables = ['users', 'user', 'profiles', 'auth.users'];
    
    for (const tableName of possibleTables) {
      try {
        const { data, error } = await this.client
          .from(tableName)
          .select('*')
          .limit(10); // Just get a few to test

        if (!error && data) {
          console.log(`Found users table: ${tableName}`);
          return data;
        }
      } catch (err) {
        // Table doesn't exist, try next one
        continue;
      }
    }
    
    throw new Error('Could not find users table. Tried: users, user, profiles, auth.users');
  }

  // Get raw Supabase client for custom queries
  getClient(): SupabaseClientType {
    return this.client;
  }
}
