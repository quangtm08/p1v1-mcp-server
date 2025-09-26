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

### 2.3 Smart Classification (via MCP Agent + n8n)

- MCP agent runs periodically (scheduled job), fetching new/unread emails for all users.
- Steps:
  1. Retrieve user tokens from Supabase; refresh if expired.
  2. Fetch new/unread emails (not yet processed).
  3. Check Supabase for custom rule match.
  4. If no match → send to n8n for AI categorization.
  5. Apply Gmail label + archive if non-urgent.
  6. Store classification log and processed `messageId` in Supabase.

**Success Criteria:**

- New emails labeled within ~5 seconds.
- Classification logs written for every email.

---

### 2.4 Digest / Brief (Twice Daily)

- MCP agent or n8n cron workflow runs 2× daily (morning + evening).
- Fetch all emails in non-urgent categories since last digest.
- Summarize with OpenAI API → group into bullets per category.
- Send digest back via Gmail API.

**Success Criteria:**

- User receives digest at configured times.
- Digest includes summaries of at least 90% of non-urgent emails.

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

- **Workflow 1 (New Email):** MCP agent scheduled job → Supabase rule check → n8n AI fallback → Gmail label/archive → Log classification.
- **Workflow 2 (Digest):** Cron → Supabase fetch → n8n AI summarize → Gmail send digest → Update last_digest_time.
- **Workflow 3 (Safety Queue):** User action → Backend API updates queue → MCP agent or n8n executes Gmail action on approval.

### 4.2 Responsibilities

- **MCP Agent:** Dynamic Gmail API access, token refresh, email fetching, labeling, archiving, logging, and batching for scalability.
- **n8n:** Orchestration (AI calls, digest, safety queue execution).
- **Supabase:** Store users, tokens, categories, rules, logs, processed emails, safety queue.
- **LLM (OpenAI):** Categorization, summaries, reply drafting.
- **Frontend (React SPA):** Rule management UI, safety queue UI, digest settings.

---

## 5. Tech Stack

- **Frontend:** Vite + React + TypeScript + TailwindCSS + shadcn-ui.
- **Backend:** Supabase (Postgres, Auth, API routes/Edge functions).
- **Automation:** MCP agent (scheduled job), n8n Cloud.
- **LLM:** OpenAI GPT-4o-mini (categorization + summaries), GPT-4o (draft replies).
- **Deployment:** Frontend → Vercel (or Netlify). Supabase Cloud. n8n Cloud (hosted).

---

## 6. MVP Checklist

- [ ] Gmail connect + label auto-creation.
- [ ] Categorization workflow (system + custom rules).
- [ ] Twice-daily digest email.
- [ ] Safety queue (approve/undo actions).
- [ ] Draft reply generation. (last)
