# 📄 Product Requirements Document (PRD) — MVP (Revised)

**Project:** Gmail Assistant (Cora-style clone with differentiators)
**Version:** Final (React SPA, scalable MCP agent-first MVP)

---

## 1. Goals

- Build an AI companion that works **on top of Gmail**:
  - Creates and manages Gmail labels for system + custom categories.
  - Auto-categorizes new emails, archives/categorizes accordingly, and leaves only critical ones in inbox.
- Summarize user emails. Group them into categories, and provide a **twice-daily digest/brief**.
- Draft replies in user’s voice. (not prioritized)
- **Differentiator (don't included in MVP yet):**
  - **Safety Queue** → reversible automation for unsubscribe/auto-archive.

---

## 2. Core Features

### 2.1 Gmail Integration & Labels

- Connect to Gmail via OAuth; store `access_token`, `refresh_token`, and `expires_at` in Supabase for each user.
- MCP agent retrieves and refreshes tokens as needed for dynamic, scalable access.
- On connect → auto-create system labels:
  - `Important information`
  - `Action`
  - `Newsletter`
  - `Payment`
  - `Social`
  - `Calendar`
  - `Others`
- Users can add custom categories from the app UI. Stored in Supabase.
- Each category corresponds to a Gmail label. When a new email arrives, MCP agent:
  - Checks for custom rule match.
  - Applies label and archives if not important.
  - Summarizes and adds to the brief.
- Only new/unread emails in the inbox are processed; processed emails are archived and tracked by Gmail `messageId` in Supabase.

**Technical Success Criteria:**

- Labels visible in Gmail sidebar after setup.
- At least one email auto-labeled and archived correctly.

---

### 2.2 Categorization System

- **System categories:** fixed set above.
- **Custom categories:** user defines via rules in UI.
  - Rule types: sender, domain, subject keyword.
- **Classification order:**
  1. Apply user’s custom rules (Supabase).
  2. Else fallback to AI categorization (via n8n).

**Tech Requirements:**

- `categories` table: id, user_id, name, type (system/custom).
- `rules` table: id, category_id, conditions (JSON).
- `processed_emails` table: user_id, message_id, processed_at.

**Success Criteria:**

- Every new email gets exactly one category.
- Custom category rules override AI categories.

---


### 2.3 Smart Classification (via MCP Batch Service + n8n)

- **MCP Batch Classification Service** runs every minute, processing `classification_queue` items.
- **Workflow:**
  1. **Email Arrival:** Gmail webhook (Heroku) → stores email in Supabase → triggers `enqueue_classification_trigger`
  2. **Batch Processing:** MCP service fetches unprocessed items from `classification_queue`
  3. **Rule Check:** MCP checks Supabase `rules` table for custom matches
  4. **AI Fallback:** If no rule match → send batch to n8n webhook for AI categorization
  5. **Apply Actions:** MCP applies Gmail labels + archives non-urgent emails
  6. **Logging:** Store results in `classifications` table, mark queue items as processed

**Success Criteria:**

- New emails processed within ~5 seconds of arrival
- Classification logs written for every email
- Failed items retry up to 3 times with exponential backoff

---

### 2.4 Digest / Brief (Twice Daily)

- **MCP Digest Batch Service** runs twice daily based on user `digest_settings`.
- **Workflow:**
  1. **Scheduling:** MCP creates `digest_jobs` based on user frequency/timezone settings
  2. **Data Collection:** Fetch emails from all categories (including urgent) since last digest
  3. **AI Summarization:** Send email batches to n8n for individual email summarization
  4. **Storage:** Store individual summaries in `digest_entries` table with `email_ids[]`
  5. **Delivery:** MCP sends formatted digest email via Gmail API
- **Content:** Individual email summaries grouped by category, includes urgent emails (not archived)

**Success Criteria:**

- User receives digest at configured times
- Digest includes individual summaries of at least 90% of emails
- Urgent emails remain in inbox but included in digest

---

### 2.5 Draft Replies in User’s Voice

- User provides 3 sample replies at onboarding → stored as “voice profile” in Supabase.
- When user requests: LLM drafts reply in Gmail (Drafts folder).

**Success Criteria:**

- Draft appears in Gmail within a few seconds.
- Reply style resembles stored samples.

---

### 2.6 Differentiator: Safety Queue

- Aggressive actions (auto-unsubscribe, bulk archive) are **proposed, not executed**.
- Stored in `safety_queue` table: id, user_id, message_id, proposed_action, status.
- UI lets user approve → MCP agent or n8n executes Gmail API action. Undo → rollback.

**Success Criteria:**

- Pending actions visible in UI.
- Approve/Undo works with Gmail API.

---

## 3. Non-Goals (Not in MVP)

- Multi-account support.
- Cross-channel integrations (Slack, Teams, Calendar, etc.).
- Complex rule DSL.
- Full email client UI (users stay inside Gmail).

---

## 4. Architecture



### 4.1 Execution Flow

**Workflow 1 (New Email Processing):**
1. Gmail webhook (Heroku) → stores email in Supabase
2. Database trigger → adds to `classification_queue`
3. MCP Batch Classification Service → processes queue items
4. Rule check (Supabase) → custom rules or AI fallback (n8n)
5. MCP applies Gmail labels + archives non-urgent emails
6. Results stored in `classifications` table

**Workflow 2 (Digest Generation):**
1. MCP Digest Service → creates `digest_jobs` based on user settings
2. Fetch emails from all categories since last digest
3. Send email batches to n8n for AI summarization
4. Store individual summaries in `digest_entries` table
5. MCP formats and sends digest email via Gmail API


### 4.2 Responsibilities

- **MCP Server:** 
  - Batch Classification Service (every minute)
  - Batch Digest Service (twice daily)
  - Gmail API operations (labels, archiving, sending)
  - Token management and refresh
  - Error handling and retry logic
- **n8n Cloud:** 
  - AI categorization (OpenAI GPT-4o-mini)
  - AI summarization (OpenAI GPT-4o-mini)
  - Webhook endpoints for MCP communication
- **Supabase:** 
  - User data, tokens, categories, rules
  - Email storage and classification logs
  - Digest jobs and entries
  - Safety queue (future)
- **Heroku:** Gmail webhook endpoint
- **Frontend (React SPA):** Rule management, digest settings, safety queue UI

---

## 5. Tech Stack

- **Frontend:** Vite + React + TypeScript + TailwindCSS + shadcn-ui
- **Backend:** Supabase (Postgres, Auth, Row Level Security)
- **Automation:** 
  - MCP Server (Node.js, TypeScript)
  - Batch Classification Service (scheduled every minute)
  - Batch Digest Service (scheduled twice daily)
  - n8n Cloud (AI orchestration)
- **LLM:** OpenAI GPT-4o-mini (categorization + summaries)
- **Deployment:** 
  - Frontend → Vercel/Netlify
  - MCP Server → Heroku
  - Gmail Webhook → Heroku
  - Supabase Cloud
  - n8n Cloud (hosted)

---

## 6. MVP Checklist

- [ ] Gmail OAuth integration + system label auto-creation
- [ ] MCP Batch Classification Service + n8n AI categorization
- [ ] Custom rules system (Supabase + UI)
- [ ] MCP Batch Digest Service + individual email summaries
- [ ] Digest email delivery via Gmail API
- [ ] Safety queue (approve/undo actions) - Phase 2
- [ ] Draft reply generation - Phase 3
