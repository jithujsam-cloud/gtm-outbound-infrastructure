# Implementation State — GTM Validation Tool Performance Optimization

> **Generated:** 2026-08-11  
> **Repository:** gtm-outbound-infrastructure  
> **Project:** gtm-validation-tool

---

## 1. Repository Identity

| Property | Value |
|----------|-------|
| **Project name** | `gtm-validation-tool` |
| **Working directory** | `/data/data/com.termux/files/home/gtm-outbound-infrastructure/gtm-validation-tool` |
| **Git remote** | `https://github.com/jithujsam-cloud/gtm-outbound-infrastructure.git` |
| **Current branch** | `main` |
| **Current HEAD** | `f4a23ed` (`feat: show git timestamp in IST timezone via runtime formatting`) |
| **Uncommitted changes** | 7 modified files + 1 new file (untracked) |
| **Pushed** | HEAD is pushed (no unpushed commits) |
| **Framework** | Next.js 16 (App Router), TypeScript |
| **Database** | Supabase (PostgreSQL), accessed via `@supabase/supabase-js` + `@supabase/ssr` |
| **Deployment** | Vercel (configured in `vercel.json`) |
| **External APIs** | OpenAI (`/v1/chat/completions`), Google Gemini (`/v1/interactions`), Clearout (`v2/email_verify/instant`) |

---

## 2. Project Purpose

A lead validation dashboard that ingests CSV lead data and classifies leads using two pipelines:

- **ICP classification** — OpenAI or Gemini AI classifies each lead against 5 verticals (D2C/E-commerce, Defense/Aviation, Fintech, Pharma, Semiconductor/Data Center)
- **Email validation** — Clearout.io verifies email deliverability

The original system processed leads sequentially (one API call + one DB write per lead). This implementation migrated it to a batch job system with atomic database operations, controlled concurrency, and database-level retry scheduling.

**Main user workflow:**
1. Create a project → import leads via CSV
2. View leads in a spreadsheet UI (search, filter, sort, paginate)
3. Click "Validate ICP" → config dialog → processing loop runs batches via the job system
4. Click "Validate Email" → old sequential route processes leads one-by-one
5. Dashboard shows aggregate stats (total leads, email valid/invalid, ICP match rate, vertical breakdown)

---

## 3. Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│   Browser (icp-validation-button.tsx)                       │
│   Client-driven processing loop:                            │
│                                                             │
│   ┌──────────────────────────────────────┐                  │
│   │ POST /api/projects/[id]/jobs         │  create job +    │
│   │                                      │  items (bulk)    │
│   └─────────────────────────────┬────────┘                  │
│                                 │                            │
│   ┌──────────────────────────────────────┐                  │
│   │ while (not complete):                │                  │
│   │   GET  /api/jobs/[id]    ── status   │                  │
│   │   POST /api/jobs/[id]/process        │  process ONE     │
│   │                      ── batch result │  batch (10 leads)│
│   │   sleep(500ms)                       │                  │
│   └──────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
     │                          │
     ▼                          ▼
POST /process              GET /jobs/[id]
     │                          │
     ▼                          ▼
┌─────────────────────────────────────────────────────────────┐
│  /api/jobs/[jobId]/process                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ if job.type === "icp":  processJobBatch()            │  │
│  │ if job.type === "email": processEmailBatch()         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  processor.ts                                               │
│                                                             │
│  claim_job_items RPC → claim 10 items (atomic, 60s lease)  │
│  select leads (14 columns for prompt resolution)            │
│                                                             │
│  For ICP:                                                   │
│    Split into sub-batches (3 OpenAI / 5 Gemini)            │
│    2 concurrent via Promise.all                             │
│    Per sub-batch: createApiLog + LLM call + updateApiLog    │
│    Collect results → apply_icp_results RPC (atomic bulk)   │
│                                                             │
│  For Email:                                                 │
│    3 concurrent Clearout calls via Promise.allSettled       │
│    Collect results → apply_email_results RPC (atomic bulk) │
│                                                             │
│  recalculateJobProgress / finalizeJob                       │
│  Return { processed, matched/valid, errors, complete }     │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase PostgreSQL                                        │
│                                                             │
│  apply_icp_results(p_updates JSONB):                        │
│    INNER JOIN validation_job_items                          │
│      ON id + lead_id + status='processing'                  │
│      + lease_expires_at > NOW()                             │
│    → UPDATE leads + UPDATE validation_job_items             │
│    → RETURN count (0 if all leases expired)                 │
│                                                             │
│  apply_email_results(p_updates JSONB): same pattern         │
└─────────────────────────────────────────────────────────────┘
```

**Key architectural properties:**
- **Client-driven:** The browser loops, calling `/process` once per batch. No server-side worker or cron.
- **Synchronous per batch:** Each `/process` call runs one batch of 10 leads synchronously and returns in 2-5 seconds.
- **Browser close behavior:** Processing stops. In-flight items remain `status='processing'` with a 60s lease. After expiry, they're reclaimable by a future session. No data loss.
- **The `/process` endpoint can handle both ICP and email jobs** — it inspects `job.type` and dispatches accordingly.

---

## 4. Database

### Key Tables

**`leads`** — 26 columns including 13 source fields, ICP results (`vertical_match`, `matched_vertical`, `reasoning`, `ai_response`), and email results (`email_check`, `safe_to_send`, `email_score`, `status`, `smtp_provider`, `mx_record`, `account`, `clearout_domain`).

**`validation_jobs`** — One row per validation run.
- Status: `queued` → `running` → `completed` / `completed_with_errors` / `paused` / `failed` / `cancelled`
- Type: `icp` or `email`
- Counters: `total_leads`, `completed_leads`, `failed_leads`, `skipped_leads`
- Partial unique index: one active job per `(user_id, project_id, type)` where status IN (`queued`, `running`, `paused`)

**`validation_job_items`** — One row per lead in a job.
- Status: `pending` → `processing` → `completed` / `failed` / `skipped`
- Lease: `lease_expires_at` (set on claim, 60s)
- Retry: `attempt` (0-based), `max_attempts` (default 3), `next_attempt_at` (new — for backoff scheduling)
- Unique constraint on `(job_id, lead_id)`

**`api_operation_logs`** — Audit trail for every external API call (Gemini, OpenAI, Clearout).

**`projects`** — User project containers. `user_id` links to `auth.users`.

**`integration_settings`** — Per-user API keys. One row per user (`user_id` UNIQUE). Stores `llm_api_key`, `clearout_api_key`, `llm_provider`.

### Important Fields for Processing

| Table | Fields | Purpose |
|-------|--------|---------|
| `validation_jobs` | `status`, `type` | Orchestration dispatch |
| `validation_job_items` | `status`, `attempt`, `max_attempts`, `lease_expires_at`, `next_attempt_at` | Claim, retry, lease |
| `leads` | `vertical_match`, `matched_vertical`, `reasoning`, `ai_response` | ICP results |
| `leads` | `email_check`, `safe_to_send`, `email_score`, `status`, `smtp_provider`, `mx_record`, `account`, `clearout_domain` | Email results |

---

## 5. Migration State

All migration files are under `gtm-validation-tool/supabase/migrations/`:

| # | File | Purpose | Applied |
|---|------|---------|---------|
| 00001 | `initial_schema.sql` | Core tables: projects, leads, integration_settings, RLS, updated_at trigger | **Unknown** |
| 00002 | `auth_rls.sql` | RLS policy updates for authenticated users | **Unknown** |
| 00003 | `user_ownership.sql` | Add `user_id` to projects + leads, RLS per-user | **Unknown** |
| 00004 | `fix_integration_settings.sql` | Rebuild integration_settings with user_id | **Unknown** |
| 00005 | `validation_prompts.sql` | validation_prompts table | **Unknown** |
| 00006 | `api_operation_logs.sql` | api_operation_logs table | **Unknown** |
| 00007 | `validation_jobs.sql` | validation_jobs table, active-job unique index | **Unknown** |
| 00008 | `validation_job_items.sql` | validation_job_items table, indexes | **Unknown** |
| 00009 | `claim_job_items_function.sql` | Initial claim_job_items RPC | **Unknown** |
| 00010 | `openai_provider.sql` | Rename gemini_api_key → llm_api_key, add llm_provider, add model/prompt/temperature columns to validation_jobs | **Unknown** |
| 00011 | `fix_claim_job_items_ambiguous_id.sql` | Fix ambiguous column references in claim_job_items | **Unknown** |
| 00012 | `job_generation_params.sql` | Add temperature/max_tokens to validation_jobs | **Unknown** |
| **00013** | `performance_indexes_and_atomic_rpcs.sql` | **NEW**, see below | **NOT APPLIED** |

**Migration 00013 details (NOT yet applied):**

| Category | Items |
|----------|-------|
| **Indexes** | `idx_leads_project_user` (project_id, user_id), `idx_job_items_lead` (lead_id FK), `idx_job_items_claim_opt` (job_id, status, created_at), `idx_leads_project_user_created` (project_id, user_id, created_at DESC) |
| **Column added** | `validation_job_items.next_attempt_at TIMESTAMPTZ` |
| **RPC replaced** | `claim_job_items` — now filters `pending` items by `next_attempt_at` (IS NULL or <= NOW()) |
| **RPC created** | `apply_icp_results(p_updates JSONB)` → INTEGER — atomic lease-verified bulk result write |
| **RPC created** | `apply_email_results(p_updates JSONB)` → INTEGER — same for email columns |
| **RPC created** | `get_project_stats(p_project_id, p_user_id)` → TABLE — SQL aggregate instead of 6 JS `.filter()` passes |
| **RPC created** | `get_dashboard_vertical_breakdown()` → TABLE — GROUP BY instead of unbounded row fetch |

All 4 indexes use `CREATE INDEX IF NOT EXISTS` (not CONCURRENTLY) — consistent with prior migration conventions and compatible with any transaction-wrapping migration runner.

---

## 6. Performance Work Completed

### Database Layer

| Change | Mechanism | File / Lines |
|--------|-----------|--------------|
| Atomic ICP bulk writes | `apply_icp_results` RPC — single transaction, lease-verified join | migration 00013 lines 91-144 |
| Atomic email bulk writes | `apply_email_results` RPC — same pattern | migration 00013 lines 148-213 |
| Atomic job claiming | `claim_job_items` RPC — `FOR UPDATE SKIP LOCKED`, 60s lease | migration 00013 lines 40-81 |
| Expired worker protection | RPC joins on `lease_expires_at > NOW()` — stale workers' writes are silently discarded | migration 00013 lines 120, 185 |
| SQL stats aggregation | `get_project_stats` RPC — single `COUNT(*) FILTER` query | migration 00013 lines 221-244; `stats/route.ts` |
| Dashboard aggregation | `get_dashboard_vertical_breakdown` RPC — GROUP BY | migration 00013 lines 248-261; `page.tsx` line 37 |
| Composite indexes | 4 new indexes on leads + validation_job_items | migration 00013 lines 11-25 |
| Column projection | Processor fetches only 14/26 lead columns and 12/18 job columns | `processor.ts` lines 20-31 |

### Processing Layer

| Change | Mechanism | File / Lines |
|--------|-----------|--------------|
| ICP prompt-level batching | 3 leads (OpenAI) or 5 (Gemini) per LLM call | `processor.ts` lines 9-10, 115 |
| ICP concurrency | 2 sub-batches parallel via `Promise.all`, 10 leads claimed per batch | `processor.ts` lines 8, 11, 244 |
| Email concurrency | 3 Clearout calls parallel via `Promise.allSettled` | `processor.ts` lines 12, 369 |
| Non-blocking retry | Retryable errors set `next_attempt_at` instead of `await setTimeout()` | `processor.ts` lines 219-227, 418-427 |
| Bounded retries | Max 3 attempts, 1s→2s→4s exponential backoff via `retry.ts` delays | `processor.ts` line 216; `retry.ts` lines 46-51 |
| Auto-pause | >50% failure rate over ≥5 items pauses the job | `processor.ts` lines 269, 489; `retry.ts` lines 53-61 |
| API logging | Per-sub-batch create/update log for ICP; per-lead for email (Clearout API) | `processor.ts` lines 138-152, 189-193, 371-392 |
| Removed redundant operations | Stale-lease reset, duplicate `recalculateJobProgress`/`finalizeJob` | `processor.ts` — both removed |
| Email in job system | `processEmailBatch()` uses same claim/lease/retry as ICP | `processor.ts` lines 292-498 |
| Route dispatch | `/process` inspects `job.type` and dispatches | `process/route.ts` lines 33, 61 |

### Frontend Layer

| Change | Mechanism | File / Lines |
|--------|-----------|--------------|
| ICP processing loop | `while` loop calls `/process` repeatedly until `pending === 0` | `icp-validation-button.tsx` lines 226-273 |
| Job status checking | `GET /jobs/[id]` at start of each loop iteration | `icp-validation-button.tsx` lines 228-243 |
| Progress accumulation | Tracks `totalProcessed`, `totalMatched`, `allErrors` across batches | `icp-validation-button.tsx` lines 259-261 |
| 500ms inter-batch pause | Natural spacing between batches; avoids hammering the API | `icp-validation-button.tsx` line 272 |
| `setInterval` polling removed | Progress now checked inline in the loop, no interval timer | `icp-validation-button.tsx` (pollRef removed entirely) |
| Field whitelist on PUT /leads/[id] | Only 13 source fields are updatable (not computed/validation columns) | `leads/[leadId]/route.ts` lines 42-57 |
| OpenAI batch structured output | `response_format: json_schema` with `strict: true` on batch calls | `openai.ts` lines 198-205 |

---

## 7. Correctness Guarantees

| Question | Answer | Implementation |
|----------|--------|----------------|
| Can two workers claim the same job item? | **No** | `claim_job_items` RPC line 74: `FOR UPDATE SKIP LOCKED`. Atomic UPDATE+SELECT in single statement. |
| Can an expired worker overwrite results? | **No** | `apply_icp_results` line 120 and `apply_email_results` line 185: `INNER JOIN ... ON vji.lease_expires_at > NOW()`. Expired leases produce zero rows. |
| Are result writes atomic? | **Yes** | Single Postgres function with CTEs in one implicit transaction. Both lead data and job_item status updated or neither. |
| Are retries bounded? | **Yes** | Max 3 attempts per item (`max_attempts DEFAULT 3`). Exponential backoff: 1s, 2s, 4s. After max, marked `failed`. |
| What happens at max attempts? | Item marked `failed` | `processor.ts` line 229-232 (ICP), 428-432 (email) — permanent failure count tracked. |
| What if the browser closes? | Processing stops; items are reclaimable | In-flight items remain `status='processing'` with 60s lease. After expiry, `claim_job_items` re-claims them. |
| What if a provider request fails? | Classified as `retryable`/`fatal`/`system` | `retry.ts` `classifyError()` inspects error message. `system` → pause job. `retryable` → re-queue with backoff. `fatal` → mark failed. |

---

## 8. OpenAI Implementation

**File:** `src/lib/validation/openai.ts`

**Models available:** `gpt-4.1-mini-2025-04-14` (default), `gpt-5.6-luna`, `gpt-5.4-mini`

**Single mode** (`callOpenAI`, line 110): `POST /v1/chat/completions` with `response_format: json_schema`, `strict: true`, `max_completion_tokens: 512`.

**Batch mode** (`callOpenAIBatch`, line 163): Same endpoint, 3 leads per request (application-level prompt batching, NOT OpenAI's async `/v1/batches`). `response_format: json_schema` with `buildBatchSchema()` (array of lead items). `strict: true`. `max_completion_tokens: 2048`.

**Schema verification (`buildIcpSchema` lines 21-41 / `buildBatchSchema` lines 43-58):**
- Root object: `additionalProperties: false` ✓
- Required properties array present ✓
- Batch array items have `additionalProperties: false` ✓
- Token parameter: `max_completion_tokens` used exclusively (no `max_tokens` anywhere) ✓

**Previously reported 400 errors — both FIXED:**
1. `"Unsupported parameter: 'max_tokens'"` — code uses `max_completion_tokens` exclusively
2. `"additionalProperties is required to be supplied and to be false"` — both schemas have `additionalProperties: false` at every level

---

## 9. Email Validation — Two Coexisting Systems

### New Job-Based System (exists, but no UI trigger)

**Files:** `processor.ts` lines 292-498 (`processEmailBatch`), `process/route.ts` lines 61-78 (dispatches for `type: 'email'`)

**How it works:**
- Creates a `validation_jobs` row with `type: 'email'`
- Claims items via same `claim_job_items` RPC as ICP
- 3 concurrent Clearout calls via `Promise.allSettled`
- Results written via `apply_email_results` RPC (atomic, lease-verified)
- Same retry, backoff, auto-pause as ICP
- `batchFailures` now properly incremented at line 432

### Old Sequential Route (current UI path)

**Files:** `validate/email/route.ts` (177 lines), `leads-table.tsx` line 358

**How it works:** The "Validate Email" button in the spreadsheet UI calls `POST /api/projects/[projectId]/validate/email`. This route processes leads one-at-a-time in a `for` loop: fetches API key → fetches lead → calls Clearout → updates lead → updates log. No batching, no concurrency, no retry mechanism.

**IMPORTANT:** The email UI migration to the job system has been **intentionally deferred**. See Section 11.

---

## 10. Current Known Issues

### P0 — None

The system builds successfully. There are no known runtime blockers other than the migration not yet being applied (without it, the new RPCs don't exist in the database).

### P1 — Should fix before production use

1. **Migration 00013 not applied to the database** — `apply_icp_results`, `apply_email_results`, `get_project_stats`, `get_dashboard_vertical_breakdown`, and the updated `claim_job_items` RPC do not exist in the database. The ICP processor will fail at runtime on the `supabase.rpc("apply_icp_results")` call.

2. **Email UI uses old sequential route** — `leads-table.tsx` line 358 calls `POST /api/projects/[projectId]/validate/email` (per-lead loop). The job-based system exists but is unreachable from the UI.

3. **`fetchAllIds()` fetches all matching IDs** — `icp-validation-button.tsx` line 181 loads all filtered lead IDs before creating a job. The backend re-queries for truly unvalidated leads, making this redundant.

### P2 — Quality improvements, not blocking

4. **Prompt deduplication not implemented** — Full user template repeated per lead in batch calls (OpenAI ×3, Gemini ×5).
5. **`leads/route.ts` still `select("*")`** — line 32, all 26 columns fetched on every page load.
6. **Gemini schemas missing `additionalProperties`** — Not required by Google's API today, but inconsistent with OpenAI pattern.
7. **`projects/route.ts` GET has no pagination** — Returns all projects.
8. **Old validation routes still active** — `validate/icp/route.ts` and `validate/email/route.ts` remain as fallback paths.

### Future — Not currently needed

- Durable background worker/queue (Vercel Cron calling `/process` every 30s)
- Frontend virtualization for >100 lead page sizes
- Trigram GIN index for ILIKE search on leads
- Chunked CSV import for >500 row imports
- Automated test suite

---

## 11. Deferred Work (Intentional)

These items were in the performance audit plan but are **explicitly deferred**:

| Item | Reason | Priority |
|------|--------|----------|
| Email UI migration to job system | Needs staged rollout — test ICP first, then port email | P1 |
| `fetchAllIds()` redundancy removal | Not blocking — backend handles correct selection anyway | P1 |
| Prompt deduplication in batch calls | Optimization; current approach is correct | P2 |
| Replace remaining `select("*")` in API routes | Column projection on list endpoints | P2 |
| Project list pagination | Not needed at current scale | P2 |
| Progress aggregation for >200 leads | Current `SELECT status` scan is fine for ≤200 items | P2 |
| Chunked CSV import | Current 200-lead cap makes this unnecessary | Future |
| Trigram GIN index for ILIKE search | Only needed if search latency is measured as slow | Future |
| Automated tests | No test infrastructure exists | Future |
| Durable background worker/queue | Client-driven loop is adequate for ≤200 leads | Future |

---

## 12. Testing Status

| Check | Result |
|-------|--------|
| **Build** | PASS — `npm run build -- --webpack` succeeds, all 18 routes compile |
| **Typecheck** | FAIL (pre-existing) — 102 errors from Supabase type generation (`Property does not exist on type 'never'`). `next.config.ts` has `typescript: { ignoreBuildErrors: true }`. No new errors introduced by this implementation. |
| **Lint** | NOT RUN — no lint config in project |
| **Test suite** | NONE — no test infrastructure exists |
| **Migration applied** | **NO** — migration 00013 is a new unversioned file, not applied to the database |
| **Manual tests** | None performed yet — waiting for migration application |

**Critical reminder:** A successful build does NOT mean the Supabase migration has been applied. The new RPCs exist only in the migration SQL file.

---

## 13. Next Recommended Steps

1. **Verify Supabase CLI / migration workflow** — determine whether `supabase/config.toml` exists (currently absent), how prior migrations were applied
2. **Apply migration 00013** — using SQL Editor, `psql`, or whatever tool was used for migrations 00001-00012
3. **Verify RPCs exist** — `SELECT proname FROM pg_proc WHERE proname IN ('apply_icp_results', 'apply_email_results', 'get_project_stats', 'get_dashboard_vertical_breakdown', 'claim_job_items')`
4. **Verify indexes exist** — `SELECT indexname FROM pg_indexes WHERE tablename = 'leads'`
5. **Manual test: ICP with 10 leads** — create project, import 10 leads, run ICP validation, verify results on leads table, verify job completes
6. **Manual test: ICP with 50 leads** — verify client loop calls `/process` 5 times (50/10), progress reaches 100%
7. **Manual test: ICP with 200 leads** — verify end-to-end, observe processing time, check for errors
8. **Manual test: browser close during processing** — close browser after 3 batches, reopen, verify unprocessed items are reclaimable
9. **Migrate email UI to job system** — add email-type job creation + process loop to `leads-table.tsx`, similar to ICP pattern in `icp-validation-button.tsx`
10. **Manual test: email validation** — 10-lead and 50-lead tests using the job system
11. **Then address P2 improvements** — prompt dedup, column projection, etc.

---

## 14. Files Changed

| File | Change | Status |
|------|--------|--------|
| `supabase/migrations/00013_performance_indexes_and_atomic_rpcs.sql` | **NEW** — 4 indexes, `next_attempt_at` column, 5 RPCs (1 updated, 4 new) | Uncommitted (untracked) |
| `src/lib/processor.ts` | Rewritten — bulk RPC writes, non-blocking retry, column projection, email processor, merge progress/finalize, remove stale-lease reset, `batchFailures++` fix | Uncommitted (modified) |
| `src/app/api/jobs/[jobId]/process/route.ts` | Rewritten — dispatches by `job.type`, fetches correct API key per type | Uncommitted (modified) |
| `src/app/api/projects/[projectId]/stats/route.ts` | Replaced — uses `get_project_stats` RPC instead of JS aggregation | Uncommitted (modified) |
| `src/app/page.tsx` | Updated — `get_dashboard_vertical_breakdown` RPC replaces unbounded row fetch | Uncommitted (modified) |
| `src/components/spreadsheet/icp-validation-button.tsx` | Rewritten — client-driven loop, removed `setInterval`, removed `pollRef` | Uncommitted (modified) |
| `src/lib/validation/openai.ts` | Updated — `buildBatchSchema()` added, batch call uses `response_format: json_schema` with `strict: true` | Uncommitted (modified) |
| `src/app/api/projects/[projectId]/leads/[leadId]/route.ts` | Updated — PUT now has field whitelist (13 updatable columns only) | Uncommitted (modified) |
| `next.config.ts` | Pre-existing uncommitted change — Vercel fallback for git info | Uncommitted (modified, unrelated) |

---

## 15. Git Handoff

| Property | Value |
|----------|-------|
| **Repository name** | `gtm-outbound-infrastructure` |
| **Remote** | `origin → https://github.com/jithujsam-cloud/gtm-outbound-infrastructure.git` |
| **Branch** | `main` |
| **Current HEAD** | `f4a23ed0cba64e124561aa5c26342b007bf1a6ca` |
| **Last commit message** | `feat: show git timestamp in IST timezone via runtime formatting` |
| **Changes committed** | **NO** — 7 modified files + 1 new file are uncommitted |
| **Changes pushed** | **NO** — nothing to push (HEAD is already on remote, local changes are unstaged) |
| **What to commit** | All 8 changed files as a single commit with message: `perf: atomic result writes, retry backoff, SQL stats, ICP processing loop` |
| **Before committing** | Review `next.config.ts` change — was this from a prior session? It's unrelated to performance work. |

---

## 16. Session Continuation Instructions — START HERE

1. **Read this entire file** (`docs/IMPLEMENTATION_STATE.md`) completely.
2. **Inspect git status** — `git status` and `git diff --stat HEAD`.
3. **The migration is NOT applied** — do not assume new RPCs exist. Verify with `SELECT proname FROM pg_proc WHERE proname LIKE 'apply_%'` before testing.
4. **Do not redo completed performance work** — bulk writes, retry backoff, lease safety, column projection, client loop, OpenAI schemas are all implemented.
5. **Do not modify P2 items** (prompt dedup, `select("*")`, project pagination, Gemini schemas) until explicitly requested.
6. **Do not migrate the email UI** to the job system yet — it's intentionally deferred. The old route still works.
7. **Ask for clarification** if the repository state differs from this document — stale file content, extra changes, missing files.
8. **Continue from Section 13 (Next Recommended Steps)** — start by finding out how migrations are applied, then apply 00013, then test.
