import { z } from 'zod';

// Email schemas
export const EmailRecordSchema = z.object({
  id: z.string().uuid(),
  gmail_id: z.string(),
  thread_id: z.string(),
  subject: z.string(),
  sender: z.string().email(),
  recipient: z.string().email(),
  snippet: z.string(),
  body: z.string(),
  label_ids: z.array(z.string()),
  received_at: z.string().datetime(),
  classified_category: z.string().optional(),
  is_archived: z.boolean().default(false),
  is_read: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateEmailRecordSchema = EmailRecordSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const UpdateEmailRecordSchema = CreateEmailRecordSchema.partial();

// User rule schemas
export const UserRuleSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string(),
  name: z.string(),
  conditions: z.object({
    sender: z.string().optional(),
    subject: z.string().optional(),
    body: z.string().optional(),
    label_ids: z.array(z.string()).optional(),
  }),
  actions: z.object({
    add_labels: z.array(z.string()).optional(),
    remove_labels: z.array(z.string()).optional(),
    archive: z.boolean().optional(),
    mark_read: z.boolean().optional(),
    forward_to: z.string().email().optional(),
  }),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateUserRuleSchema = UserRuleSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const UpdateUserRuleSchema = CreateUserRuleSchema.partial();

// Classification log schemas
export const ClassificationLogSchema = z.object({
  id: z.string().uuid(),
  email_id: z.string(),
  category: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  created_at: z.string().datetime(),
});

export const CreateClassificationLogSchema = ClassificationLogSchema.omit({
  id: true,
  created_at: true,
});

// Gmail API schemas
export const GmailMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  snippet: z.string(),
  payload: z.object({
    headers: z.array(z.object({
      name: z.string(),
      value: z.string(),
    })),
    body: z.object({
      data: z.string().optional(),
    }).optional(),
    parts: z.array(z.object({
      mimeType: z.string(),
      body: z.object({
        data: z.string().optional(),
      }).optional(),
      parts: z.array(z.object({
        mimeType: z.string(),
        body: z.object({
          data: z.string().optional(),
        }).optional(),
      })).optional(),
    })).optional(),
  }),
  labelIds: z.array(z.string()),
  sizeEstimate: z.number(),
});

// MCP tool input schemas
export const GetEmailsInputSchema = z.object({
  maxResults: z.number().min(1).max(100).default(10),
  query: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
  includeSpamTrash: z.boolean().default(false),
});

export const CreateLabelInputSchema = z.object({
  name: z.string().min(1),
  labelListVisibility: z.enum(['labelShow', 'labelHide']).default('labelShow'),
  messageListVisibility: z.enum(['show', 'hide']).default('show'),
});

export const ArchiveEmailInputSchema = z.object({
  messageId: z.string(),
});

export const ClassifyEmailInputSchema = z.object({
  messageId: z.string(),
  useCustomRules: z.boolean().default(true),
});

export const ApplyRulesInputSchema = z.object({
  messageId: z.string(),
  userId: z.string(),
});

// Type exports
export type EmailRecord = z.infer<typeof EmailRecordSchema>;
export type CreateEmailRecord = z.infer<typeof CreateEmailRecordSchema>;
export type UpdateEmailRecord = z.infer<typeof UpdateEmailRecordSchema>;

export type UserRule = z.infer<typeof UserRuleSchema>;
export type CreateUserRule = z.infer<typeof CreateUserRuleSchema>;
export type UpdateUserRule = z.infer<typeof UpdateUserRuleSchema>;

export type ClassificationLog = z.infer<typeof ClassificationLogSchema>;
export type CreateClassificationLog = z.infer<typeof CreateClassificationLogSchema>;

export type GmailMessage = z.infer<typeof GmailMessageSchema>;

export type GetEmailsInput = z.infer<typeof GetEmailsInputSchema>;
export type CreateLabelInput = z.infer<typeof CreateLabelInputSchema>;
export type ArchiveEmailInput = z.infer<typeof ArchiveEmailInputSchema>;
export type ClassifyEmailInput = z.infer<typeof ClassifyEmailInputSchema>;
export type ApplyRulesInput = z.infer<typeof ApplyRulesInputSchema>;

// Email categories
export const EMAIL_CATEGORIES = [
  'inbox',
  'important',
  'promotions',
  'social',
  'updates',
  'forums',
  'safety_queue',
  'archived',
] as const;

export type EmailCategory = typeof EMAIL_CATEGORIES[number];

// Validation helpers
export function validateEmailRecord(data: unknown): EmailRecord {
  return EmailRecordSchema.parse(data);
}

export function validateUserRule(data: unknown): UserRule {
  return UserRuleSchema.parse(data);
}

export function validateClassificationLog(data: unknown): ClassificationLog {
  return ClassificationLogSchema.parse(data);
}

export function validateGmailMessage(data: unknown): GmailMessage {
  return GmailMessageSchema.parse(data);
}
