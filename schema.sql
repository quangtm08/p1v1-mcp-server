


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."classification_safety_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- push to safety queue if AI-sourced and score below threshold (e.g. 0.6)
  if (new.source = 'ai' and new.score is not null and new.score < 0.6) then
    insert into public.safety_queue (email_id, user_id, reason, severity, metadata)
    values (new.email_id, new.user_id, 'Low-confidence classification', 'medium', jsonb_build_object('score', new.score, 'raw', new.raw_response));
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."classification_safety_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."emails_tsv_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.tsv := to_tsvector('english', coalesce(new.subject,'') || ' ' || coalesce(new.body,''));
  return new;
end;
$$;


ALTER FUNCTION "public"."emails_tsv_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_classification_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  insert into public.classification_queue (email_id, user_id, payload)
  values (new.id, new.user_id, jsonb_build_object('message_id', new.message_id, 'subject', new.subject));
  return new;
end;
$$;


ALTER FUNCTION "public"."enqueue_classification_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'name',
    new.email
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."classifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email_id" "uuid",
    "user_id" "uuid",
    "category_id" integer,
    "category_key" "text",
    "score" numeric,
    "source" "text",
    "model" "text",
    "raw_response" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."classifications" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_classification_stats" AS
 SELECT "user_id",
    "category_key",
    "count"(*) AS "classification_count",
    "avg"("score") AS "avg_confidence",
    "min"("created_at") AS "first_classification",
    "max"("created_at") AS "last_classification"
   FROM "public"."classifications" "c"
  GROUP BY "user_id", "category_key";


ALTER VIEW "public"."admin_classification_stats" OWNER TO "postgres";


COMMENT ON VIEW "public"."admin_classification_stats" IS 'Admin view: Classification statistics';



CREATE TABLE IF NOT EXISTS "public"."emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "message_id" "text" NOT NULL,
    "thread_id" "text",
    "subject" "text",
    "from_address" "text",
    "to_addresses" "text"[],
    "cc_addresses" "text"[],
    "snippet" "text",
    "body" "text",
    "labels" "text"[],
    "received_at" timestamp with time zone,
    "processed_at" timestamp with time zone,
    "archived" boolean DEFAULT false,
    "raw_json" "jsonb",
    "tsv" "tsvector",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."emails" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_email_metadata" AS
 SELECT "id",
    "user_id",
    "message_id",
    "thread_id",
    "received_at",
    "processed_at",
    "archived",
    "created_at",
    "updated_at"
   FROM "public"."emails";


ALTER VIEW "public"."admin_email_metadata" OWNER TO "postgres";


COMMENT ON VIEW "public"."admin_email_metadata" IS 'Admin view: Minimal email metadata - only system fields, no content or addresses';



CREATE OR REPLACE VIEW "public"."admin_email_stats" AS
 SELECT "user_id",
    "count"(*) AS "email_count",
    "count"(
        CASE
            WHEN ("archived" = true) THEN 1
            ELSE NULL::integer
        END) AS "archived_count",
    "count"(
        CASE
            WHEN ("processed_at" IS NOT NULL) THEN 1
            ELSE NULL::integer
        END) AS "processed_count",
    "count"(
        CASE
            WHEN ("processed_at" IS NULL) THEN 1
            ELSE NULL::integer
        END) AS "pending_count",
    "min"("received_at") AS "first_email",
    "max"("received_at") AS "last_email",
    "count"(
        CASE
            WHEN ("received_at" >= ("now"() - '24:00:00'::interval)) THEN 1
            ELSE NULL::integer
        END) AS "emails_last_24h",
    "count"(
        CASE
            WHEN ("received_at" >= ("now"() - '7 days'::interval)) THEN 1
            ELSE NULL::integer
        END) AS "emails_last_7d"
   FROM "public"."emails"
  GROUP BY "user_id";


ALTER VIEW "public"."admin_email_stats" OWNER TO "postgres";


COMMENT ON VIEW "public"."admin_email_stats" IS 'Admin view: Email statistics without content access';



CREATE TABLE IF NOT EXISTS "public"."safety_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email_id" "uuid",
    "user_id" "uuid",
    "reason" "text",
    "severity" "text" DEFAULT 'medium'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "assigned_to" "uuid",
    "notes" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "safety_queue_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "safety_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewing'::"text", 'resolved'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."safety_queue" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_safety_queue_stats" AS
 SELECT "user_id",
    "severity",
    "status",
    "count"(*) AS "queue_count",
    "min"("created_at") AS "oldest_item",
    "max"("created_at") AS "newest_item"
   FROM "public"."safety_queue" "sq"
  GROUP BY "user_id", "severity", "status";


ALTER VIEW "public"."admin_safety_queue_stats" OWNER TO "postgres";


COMMENT ON VIEW "public"."admin_safety_queue_stats" IS 'Admin view: Safety queue statistics';



CREATE TABLE IF NOT EXISTS "public"."attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email_id" "uuid",
    "user_id" "uuid",
    "storage_path" "text" NOT NULL,
    "filename" "text",
    "content_type" "text",
    "size" bigint,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" integer NOT NULL,
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_builtin" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."categories_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."categories_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."categories_id_seq" OWNED BY "public"."categories"."id";



CREATE TABLE IF NOT EXISTS "public"."classification_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email_id" "uuid",
    "user_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempts" integer DEFAULT 0,
    "payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone
);


ALTER TABLE "public"."classification_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."digest_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "digest_job_id" "uuid" NOT NULL,
    "category_id" integer,
    "category_key" "text",
    "summary" "text",
    "email_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."digest_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."digest_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "scheduled_for" timestamp with time zone,
    "status" "text" DEFAULT 'queued'::"text",
    "payload" "jsonb",
    "result" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "digest_jobs_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'processing'::"text", 'sent'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."digest_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."digest_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "frequency" "text" DEFAULT 'daily'::"text" NOT NULL,
    "time_of_day" time without time zone,
    "timezone" "text" DEFAULT 'Asia/Bangkok'::"text",
    "categories" "text"[],
    "include_summary" boolean DEFAULT true,
    "last_sent_at" timestamp with time zone,
    "next_run_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "digest_settings_frequency_check" CHECK (("frequency" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."digest_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_labels" (
    "email_id" "uuid" NOT NULL,
    "label_id" bigint NOT NULL
);


ALTER TABLE "public"."email_labels" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."email_labels_label_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."email_labels_label_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."email_labels_label_id_seq" OWNED BY "public"."email_labels"."label_id";



CREATE TABLE IF NOT EXISTS "public"."email_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "provider" "text" NOT NULL,
    "access_token" "text" NOT NULL,
    "refresh_token" "text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."labels" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."labels" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."labels_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."labels_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."labels_id_seq" OWNED BY "public"."labels"."id";



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "email" "text",
    "timezone" "text" DEFAULT 'Asia/Bangkok'::"text",
    "is_admin" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rule_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rule_id" "uuid",
    "user_id" "uuid",
    "changes" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."rule_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text",
    "description" "text",
    "priority" integer DEFAULT 100 NOT NULL,
    "enabled" boolean DEFAULT true,
    "conditions" "jsonb" NOT NULL,
    "actions" "jsonb" NOT NULL,
    "match_type" "text" DEFAULT 'any'::"text",
    "continue_on_match" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "version" integer DEFAULT 1
);


ALTER TABLE "public"."rules" OWNER TO "postgres";


ALTER TABLE ONLY "public"."categories" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."categories_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."email_labels" ALTER COLUMN "label_id" SET DEFAULT "nextval"('"public"."email_labels_label_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."labels" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."labels_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classification_queue"
    ADD CONSTRAINT "classification_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classifications"
    ADD CONSTRAINT "classifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."digest_entries"
    ADD CONSTRAINT "digest_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."digest_jobs"
    ADD CONSTRAINT "digest_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."digest_settings"
    ADD CONSTRAINT "digest_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_labels"
    ADD CONSTRAINT "email_labels_pkey" PRIMARY KEY ("email_id", "label_id");



ALTER TABLE ONLY "public"."email_tokens"
    ADD CONSTRAINT "email_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_tokens"
    ADD CONSTRAINT "email_tokens_user_id_provider_key" UNIQUE ("user_id", "provider");



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_user_id_message_id_key" UNIQUE ("user_id", "message_id");



ALTER TABLE ONLY "public"."labels"
    ADD CONSTRAINT "labels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rule_audit"
    ADD CONSTRAINT "rule_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rules"
    ADD CONSTRAINT "rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."safety_queue"
    ADD CONSTRAINT "safety_queue_pkey" PRIMARY KEY ("id");



CREATE INDEX "email_tokens_user_id_idx" ON "public"."email_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_classification_queue_status" ON "public"."classification_queue" USING "btree" ("status", "created_at");



CREATE INDEX "idx_classifications_email" ON "public"."classifications" USING "btree" ("email_id", "created_at");



CREATE INDEX "idx_digest_entries_category_id" ON "public"."digest_entries" USING "btree" ("category_id");



CREATE INDEX "idx_digest_entries_digest_job_id" ON "public"."digest_entries" USING "btree" ("digest_job_id");



CREATE INDEX "idx_digest_entries_email_ids" ON "public"."digest_entries" USING "gin" ("email_ids");



CREATE INDEX "idx_emails_labels" ON "public"."emails" USING "gin" ("labels");



CREATE INDEX "idx_emails_rawjson" ON "public"."emails" USING "gin" ("raw_json");



CREATE INDEX "idx_emails_tsv" ON "public"."emails" USING "gin" ("tsv");



CREATE INDEX "idx_rules_conditions_gin" ON "public"."rules" USING "gin" ("conditions");



CREATE INDEX "idx_safety_pending" ON "public"."safety_queue" USING "btree" ("status", "created_at") WHERE ("status" = 'pending'::"text");



CREATE OR REPLACE TRIGGER "classifications_after_insert_safety" AFTER INSERT ON "public"."classifications" FOR EACH ROW EXECUTE FUNCTION "public"."classification_safety_trigger"();



CREATE OR REPLACE TRIGGER "emails_after_insert_enqueue" AFTER INSERT ON "public"."emails" FOR EACH ROW EXECUTE FUNCTION "public"."enqueue_classification_trigger"();



CREATE OR REPLACE TRIGGER "emails_tsv_before_insupd" BEFORE INSERT OR UPDATE ON "public"."emails" FOR EACH ROW EXECUTE FUNCTION "public"."emails_tsv_trigger"();



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."classification_queue"
    ADD CONSTRAINT "classification_queue_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classification_queue"
    ADD CONSTRAINT "classification_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."classifications"
    ADD CONSTRAINT "classifications_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."classifications"
    ADD CONSTRAINT "classifications_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classifications"
    ADD CONSTRAINT "classifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."digest_entries"
    ADD CONSTRAINT "digest_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."digest_entries"
    ADD CONSTRAINT "digest_entries_digest_job_id_fkey" FOREIGN KEY ("digest_job_id") REFERENCES "public"."digest_jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."digest_jobs"
    ADD CONSTRAINT "digest_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."digest_settings"
    ADD CONSTRAINT "digest_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."email_labels"
    ADD CONSTRAINT "email_labels_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_labels"
    ADD CONSTRAINT "email_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."labels"
    ADD CONSTRAINT "labels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rule_audit"
    ADD CONSTRAINT "rule_audit_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rule_audit"
    ADD CONSTRAINT "rule_audit_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."rules"
    ADD CONSTRAINT "rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."safety_queue"
    ADD CONSTRAINT "safety_queue_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."safety_queue"
    ADD CONSTRAINT "safety_queue_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."safety_queue"
    ADD CONSTRAINT "safety_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE "public"."attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "attachments: delete own" ON "public"."attachments" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "attachments: insert own" ON "public"."attachments" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "attachments: select own" ON "public"."attachments" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "attachments: update own" ON "public"."attachments" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."classification_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "classifications: select own" ON "public"."classifications" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."emails" "e"
  WHERE (("e"."id" = "classifications"."email_id") AND ("e"."user_id" = "auth"."uid"())))));



CREATE POLICY "digest: delete own" ON "public"."digest_settings" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "digest: insert own" ON "public"."digest_settings" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "digest: select own" ON "public"."digest_settings" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "digest: update own" ON "public"."digest_settings" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."digest_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "digest_entries: delete own" ON "public"."digest_entries" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."digest_jobs" "dj"
  WHERE (("dj"."id" = "digest_entries"."digest_job_id") AND ("dj"."user_id" = "auth"."uid"())))));



CREATE POLICY "digest_entries: insert own" ON "public"."digest_entries" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."digest_jobs" "dj"
  WHERE (("dj"."id" = "digest_entries"."digest_job_id") AND ("dj"."user_id" = "auth"."uid"())))));



CREATE POLICY "digest_entries: select own" ON "public"."digest_entries" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."digest_jobs" "dj"
  WHERE (("dj"."id" = "digest_entries"."digest_job_id") AND ("dj"."user_id" = "auth"."uid"())))));



CREATE POLICY "digest_entries: update own" ON "public"."digest_entries" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."digest_jobs" "dj"
  WHERE (("dj"."id" = "digest_entries"."digest_job_id") AND ("dj"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."digest_jobs" "dj"
  WHERE (("dj"."id" = "digest_entries"."digest_job_id") AND ("dj"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."digest_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "email_tokens: delete own" ON "public"."email_tokens" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "email_tokens: insert own" ON "public"."email_tokens" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "email_tokens: select own" ON "public"."email_tokens" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "email_tokens: update own" ON "public"."email_tokens" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."emails" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "emails: delete own" ON "public"."emails" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "emails: insert own" ON "public"."emails" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "emails: select own" ON "public"."emails" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "emails: update own" ON "public"."emails" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "queue: select own" ON "public"."classification_queue" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."emails" "e"
  WHERE (("e"."id" = "classification_queue"."email_id") AND ("e"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rules: delete own" ON "public"."rules" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "rules: insert own" ON "public"."rules" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "rules: select own" ON "public"."rules" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "rules: update own" ON "public"."rules" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."safety_queue" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "safety_queue: select own" ON "public"."safety_queue" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."emails" "e"
  WHERE (("e"."id" = "safety_queue"."email_id") AND ("e"."user_id" = "auth"."uid"())))));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."classification_safety_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."classification_safety_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."classification_safety_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."emails_tsv_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."emails_tsv_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."emails_tsv_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_classification_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_classification_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_classification_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON TABLE "public"."classifications" TO "anon";
GRANT ALL ON TABLE "public"."classifications" TO "authenticated";
GRANT ALL ON TABLE "public"."classifications" TO "service_role";



GRANT ALL ON TABLE "public"."admin_classification_stats" TO "anon";
GRANT ALL ON TABLE "public"."admin_classification_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_classification_stats" TO "service_role";



GRANT ALL ON TABLE "public"."emails" TO "anon";
GRANT ALL ON TABLE "public"."emails" TO "authenticated";
GRANT ALL ON TABLE "public"."emails" TO "service_role";



GRANT ALL ON TABLE "public"."admin_email_metadata" TO "anon";
GRANT ALL ON TABLE "public"."admin_email_metadata" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_email_metadata" TO "service_role";



GRANT ALL ON TABLE "public"."admin_email_stats" TO "anon";
GRANT ALL ON TABLE "public"."admin_email_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_email_stats" TO "service_role";



GRANT ALL ON TABLE "public"."safety_queue" TO "anon";
GRANT ALL ON TABLE "public"."safety_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."safety_queue" TO "service_role";



GRANT ALL ON TABLE "public"."admin_safety_queue_stats" TO "anon";
GRANT ALL ON TABLE "public"."admin_safety_queue_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_safety_queue_stats" TO "service_role";



GRANT ALL ON TABLE "public"."attachments" TO "anon";
GRANT ALL ON TABLE "public"."attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."attachments" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."classification_queue" TO "anon";
GRANT ALL ON TABLE "public"."classification_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."classification_queue" TO "service_role";



GRANT ALL ON TABLE "public"."digest_entries" TO "anon";
GRANT ALL ON TABLE "public"."digest_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."digest_entries" TO "service_role";



GRANT ALL ON TABLE "public"."digest_jobs" TO "anon";
GRANT ALL ON TABLE "public"."digest_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."digest_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."digest_settings" TO "anon";
GRANT ALL ON TABLE "public"."digest_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."digest_settings" TO "service_role";



GRANT ALL ON TABLE "public"."email_labels" TO "anon";
GRANT ALL ON TABLE "public"."email_labels" TO "authenticated";
GRANT ALL ON TABLE "public"."email_labels" TO "service_role";



GRANT ALL ON SEQUENCE "public"."email_labels_label_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."email_labels_label_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."email_labels_label_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."email_tokens" TO "anon";
GRANT ALL ON TABLE "public"."email_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."email_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."labels" TO "anon";
GRANT ALL ON TABLE "public"."labels" TO "authenticated";
GRANT ALL ON TABLE "public"."labels" TO "service_role";



GRANT ALL ON SEQUENCE "public"."labels_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."labels_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."labels_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."rule_audit" TO "anon";
GRANT ALL ON TABLE "public"."rule_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."rule_audit" TO "service_role";



GRANT ALL ON TABLE "public"."rules" TO "anon";
GRANT ALL ON TABLE "public"."rules" TO "authenticated";
GRANT ALL ON TABLE "public"."rules" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







RESET ALL;
