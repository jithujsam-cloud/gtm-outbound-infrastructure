# CTO Architecture Review — GTM Validation Tool

## 1. Current Architecture

**Deployment:** Vercel serverless (Next.js 16, default Node.js runtime, ephemeral functions, ~10-60s timeout)

**Database:** Managed Supabase with 4 tables — `projects`, `leads`, `integration_settings`, `validation_prompts`. All have `auth.uid() = user_id` RLS. No pg_cron, no edge functions, no queue infrastructure.

**Auth:** Supabase Auth via `@supabase/ssr` — cookie-based session → `supabase.auth.getUser()` in every API route → RLS. No service-role usage anywhere. Auth pattern (`createClient + getUser + 401`) copy-pasted 13 times verbatim — no shared helper.

**Validation:** Each validation run is a single synchronous POST to `/validate/icp` or `/validate/email`. Server processes leads one-by-one in a `for` loop, calls external API (Gemini/Clearout), updates DB, returns result synchronously. For 200 leads at ~2s each, that's 400s — way beyond Vercel's timeout window.

**Gemini:** Uses Interactions API v1 endpoint (`https://generativelanguage.googleapis.com/v1/interactions`). This is the correct GA-stable endpoint. Model: `gemini-3.6-flash`. Structured output via `response_format` with JSON schema. Response parsed from `steps[].type==model_output`. Verified working for single-lead validation.

---

## 2. Problems Found

### P0 — Will Break at Scale

| Problem | Location | Impact |
|---------|----------|--------|
| Synchronous loop in serverless function | `validate/icp/route.ts`, `validate/email/route.ts` | 200 leads × 2s = 400s → Vercel timeout kills the request. No recovery. Lost work. |
| No crash recovery | Entire validation system | If function crashes mid-loop, completed leads are lost (no durable state beyond lead field updates). No way to resume from where it stopped. |
| No retry on transient failures | `gemini.ts`, email route | Network blip, 429 rate limit, 502 — all treated as permanent failure. No exponential backoff. |

### P1 — Security & Data Integrity

| Problem | Location | Impact |
|---------|----------|--------|
| Missing `user_id` filter on leads query | `validate/email/route.ts:41`, `leads/route.ts:27` (GET), `stats/route.ts:18` | Authenticated user A can access user B's leads/stats by guessing a projectId. RLS should catch this, but these queries omit the explicit `user_id` filter that the ICP route has. |
| API keys leaked to browser | `integration-settings.ts` → `loadSettings()` → `integrations/page.tsx` | `select("*")` fetches all columns including `gemini_api_key`, `clearout_api_key`. Returned to client. Rendered in DOM inputs. |
| Unchecked `.update()` error | `validate/email/route.ts:58-70` | Supabase update error silently ignored. Lead counted as "processed" but DB never updated. |
| Read-then-write race conditions | `validation-prompts.ts`, `integration-settings.ts` | Manual upsert (select → if exists update else insert) is not atomic. Concurrent calls can duplicate or lose data. |

### P2 — Code Quality & Dead Code

| Problem | Detail |
|---------|--------|
| 13× duplicated auth block | Every API route copy-pastes the same 4-line auth guard |
| Dead `email-validation-button.tsx` | Exported but never imported. Has a "Run" button that does nothing. |
| Dead `import/` multi-step wizard | `import-leads-dialog.tsx`, `csv-upload-step.tsx`, `column-mapping-step.tsx` — all unused |
| Dead `lib/supabase/admin.ts` | `createAdminClient()` defined but never imported |
| Dead `saveIcpPrompt` server action | Exported but no client calls it |
| `model` field in `validation_prompts` | Stored but never read or used |

---

## 3. Recommended Architecture

### Core Principle: The Database IS the Queue

We do NOT add Redis, BullMQ, SQS, Inngest, Trigger.dev, or any external queue service. The project is a small internal tool on Vercel + Supabase. Adding infrastructure complexity for 200-lead validation jobs is premature.

Instead: **validation jobs live in Supabase tables, and a dedicated Next.js API route processes them in controlled batches with lease-based locking.**

### Why This Works for Vercel Serverless

Vercel Hobby plan has a ~10s function timeout, Pro plan has ~60s. We work within that: each worker invocation processes ONE batch (10 leads max), then returns. The browser or a Supabase webhook triggers the next batch. We never hold a function open for 200 leads.

### Job Lifecycle

```
User clicks "Validate Selected (15)" or "Continuously Validate"
  → Browser POSTs to create a validation_job
  → API creates job + 15 job_items (all status="pending")
  → Returns { jobId } immediately (fast response)

Processing starts:
  → Browser polls GET /api/jobs/{jobId}/process
    OR
  → A Vercel Cron job hits the processing endpoint every minute

Processing logic:
  1. SELECT next batch of pending items (LIMIT 10) 
     WHERE status='pending' OR (status='processing' AND lease_expires_at < NOW())
  2. UPDATE status='processing', lease_expires_at=NOW()+30s
  3. For each item in batch:
     a. Create api_operation_log (status="started", attempt=N)
     b. Call external API (Gemini/Clearout)
     c. Validate response
     d. Update lead record
     e. Update api_operation_log (status="success")
     f. Update job_item (status="completed")
  4. If batch finishes: return → trigger next batch
  5. If error: items with issues stay at "failed" or remain "pending" for retry
```

---

## 4. Database Design

### `validation_jobs`

```sql
CREATE TABLE validation_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('icp', 'email')),
  mode TEXT NOT NULL CHECK (mode IN ('selected', 'continuous')),
  prompt TEXT,                      -- stored prompt template (with /variables)
  model TEXT DEFAULT 'gemini-3.6-flash',
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','paused','completed','completed_with_errors','failed','cancelled')),
  total_leads INTEGER NOT NULL DEFAULT 0,
  completed_leads INTEGER NOT NULL DEFAULT 0,
  failed_leads INTEGER NOT NULL DEFAULT 0,
  skipped_leads INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_validation_jobs_user_project ON validation_jobs(user_id, project_id);
CREATE INDEX idx_validation_jobs_status ON validation_jobs(status);

ALTER TABLE validation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns validation jobs" ON validation_jobs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Prevent duplicate active jobs for same user+project+type
CREATE UNIQUE INDEX idx_active_jobs ON validation_jobs(user_id, project_id, type)
  WHERE status IN ('queued', 'running', 'paused');
```

### `validation_job_items`

```sql
CREATE TABLE validation_job_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES validation_jobs(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed','skipped')),
  attempt INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  lease_expires_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(job_id, lead_id)          -- one item per lead per job
);

CREATE INDEX idx_job_items_job_status ON validation_job_items(job_id, status);
CREATE INDEX idx_job_items_claim ON validation_job_items(status, lease_expires_at)
  WHERE status IN ('pending','processing');

ALTER TABLE validation_job_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns job items" ON validation_job_items
  FOR ALL USING (
    job_id IN (SELECT id FROM validation_jobs WHERE user_id = auth.uid())
  )
  WITH CHECK (
    job_id IN (SELECT id FROM validation_jobs WHERE user_id = auth.uid())
  );
```

### `api_operation_logs`

```sql
CREATE TABLE api_operation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,            -- denormalized for RLS + indexing
  project_id UUID NOT NULL,
  lead_id UUID,
  job_id UUID REFERENCES validation_jobs(id) ON DELETE SET NULL,
  job_item_id UUID REFERENCES validation_job_items(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,           -- 'gemini', 'clearout'
  operation TEXT NOT NULL,          -- 'icp_validation', 'email_verification'
  status TEXT NOT NULL              -- 'success', 'failed', 'retryable_error', 'fatal_error'
    CHECK (status IN ('success','failed','retryable_error','fatal_error')),
  attempt INTEGER NOT NULL DEFAULT 1,
  duration_ms INTEGER,
  http_status INTEGER,
  error_code TEXT,
  error_message TEXT,
  request_metadata JSONB,           -- { model, tokens_sent, lead_count }
  response_metadata JSONB,          -- { tokens_received, status }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_logs_user ON api_operation_logs(user_id, created_at DESC);
CREATE INDEX idx_api_logs_job ON api_operation_logs(job_id);
CREATE INDEX idx_api_logs_provider_status ON api_operation_logs(provider, status);

ALTER TABLE api_operation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns api logs" ON api_operation_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- NEVER log: api keys, passwords, tokens, cookies, authorization headers
-- Keep request_metadata and response_metadata safe: tokens, status codes only
```

---

## 5. State Machines

### Job State
```
queued → running → completed
                  → completed_with_errors
                  → failed (system-level failure — bad API key, etc.)
        → paused  → running
        → cancelled (user cancels)
```

### Job Item State
```
pending → processing → completed
                      → failed (retries exhausted)
                      → skipped (already validated)
        ↑              ↑
        (lease expired)(manual retry)
```

`status='processing' AND lease_expires_at < NOW()` → reclaimable as pending

### API Operation Log State
```
Each call creates one log with:
  status='success'        (HTTP 2xx + valid response)
  status='retryable_error' (429, 5xx, timeout, network error)
  status='fatal_error'    (400, 401, 403 — bad key, bad request)
```

Retryable errors increment `attempt` count and the item goes back to `pending`. Fatal errors mark the item `failed` immediately.

---

## 6. Retry Strategy

| Error | Classification | Action |
|-------|---------------|--------|
| HTTP 429 (rate limit) | retryable | Exponential backoff: 1s, 2s, 4s, 8s, 16s max. Max 5 attempts. |
| HTTP 500/502/503 | retryable | Retry after 1s, 2s, 4s. Max 3 attempts. |
| Network timeout / connection refused | retryable | Retry after 2s. Max 3 attempts. |
| Malformed Gemini response (invalid JSON) | retryable | Retry once. If still invalid, mark failed. |
| HTTP 400 (bad request) | fatal | Don't retry. Mark item failed. Log error. |
| HTTP 401/403 (bad auth) | fatal | Don't retry. **Pause entire job.** This is a system-level failure. |
| Missing Gemini API key | fatal | Pause job. |
| Supabase update failure | retryable (per-lead) | Retry the DB update only (not the API call). 1 retry. |

### System-Level vs Lead-Level

- **Lead-level**: Gemini timeout for ONE lead → retry that lead, continue others.
- **System-level**: Invalid Gemini API key → pause the ENTIRE job. Don't burn 199 more calls with a bad key.

A job auto-pauses when `failed_leads / (completed_leads + failed_leads) > 0.5` within the first 10 items (50% failure rate suggests systemic issue).

---

## 7. Crash Recovery — Lease-Based

```
Item claim (atomic):
  UPDATE validation_job_items
  SET status = 'processing',
      lease_expires_at = NOW() + INTERVAL '30 seconds',
      attempt = attempt + 1,
      started_at = NOW()
  WHERE id IN (
    SELECT id FROM validation_job_items
    WHERE job_id = $jobId
      AND (
        status = 'pending'
        OR (status = 'processing' AND lease_expires_at < NOW())
      )
    ORDER BY created_at
    LIMIT $batchSize
  )
  RETURNING id, lead_id;
```

The `RETURNING` clause gives us the claimed items. This is a single atomic SQL statement — no two processors can claim the same item.

When a processor completes an item:
```
UPDATE validation_job_items SET status='completed', completed_at=NOW() WHERE id=$id;
```

If a processor crashes: the lease expires (30s), next processor's claim query picks up the stale `processing` item.

For Vercel (one function per request), there's no risk of concurrent processors *within one job* unless the user triggers multiple processing requests. The UNIQUE index on active jobs prevents that.

---

## 8. Processing Strategy

### Phase 1: Sequential (current pattern, made reliable)

- One item at a time with lease protection
- Works within Vercel's 60s timeout
- Processing endpoint can be called repeatedly until job is done
- Browser polls `GET /api/jobs/{jobId}` for progress every 2-3 seconds

### Phase 2: Small Batches (after sequential proven)

- Gemini batch: 5-10 leads per API call
- Clearout: Single email per call (Clearout API limitation)
- Concurrency: 2 parallel items max (p-limit)
- Total per worker invocation: 10 leads, ~20s

### Gemini Batching

Send 5 leads in one prompt:
```
Lead 1: [resolved lead data]
Lead 2: [resolved lead data]
...

Return JSON array:
[{lead_id, vertical_match, matched_vertical, reasoning}, ...]
```

Validate response has exactly 5 items, all IDs match, no duplicates, no missing.

---

## 9. API Routes

### POST `/api/projects/{projectId}/jobs` — Create Job

Body: `{ type: "icp", mode: "selected"|"continuous", leadIds?: string[], prompt: string }`

- For `selected` mode: creates items only for `leadIds`
- For `continuous` mode: queries leads WHERE `vertical_match IS NULL` for ICP (or `email_check IS NULL` for email)
- Returns `{ jobId, totalLeads, status }`

### GET `/api/jobs/{jobId}` — Job Status

Returns `{ job, items, progress }` — the browser polls this.

### POST `/api/jobs/{jobId}/process` — Process Batch

Claims and processes one batch (max 10 items). Called by browser polling or Vercel Cron.

### POST `/api/jobs/{jobId}/pause` / `/resume` / `/cancel` / `/retry-failed`

Standard job control operations.

### GET `/api/logs` — Logs Page

Paginated, filterable query of `api_operation_logs` with filters for provider, operation, status, project, date range.

---

## 10. Existing Code to Reuse

| Pattern | Source | Reuse |
|---------|--------|-------|
| Auth guard | Every route | Extract into `lib/auth.ts` → `getAuthenticatedUser()` that throws or returns user |
| Lead query + ownership check | `validate/icp/route.ts:51-73` | Extract into `lib/leads.ts` → `fetchAndVerifyLeads(userId, projectId, leadIds)` |
| Gemini call | `lib/validation/gemini.ts` | Reuse as-is — it works. Add retry wrapper. |
| Variable resolution | `lib/validation/variables.ts` | Reuse as-is. Fix the substring bug (sort by key length descending). |
| Prompt storage | `lib/validation-prompts.ts` | Reuse. Fix the race condition (use Supabase `upsert`). Fix `getDefaultIcpPrompt` to dynamically include `ICP_VERTICALS`. |
| Popover component | `ui/popover.tsx` | Reuse for ICP reasoning popover |
| Table component | `leads-table.tsx` | Reuse for Logs page (same TanStack table pattern) |
| Badge component | `ui/badge.tsx` | Reuse for ICP results in table |
| Stats/donut chart | `charts/validation-summary.tsx`, `donut-chart.tsx` | Reuse for validation job progress visualization |

---

## 11. Files to Delete (Dead Code)

| File | Why |
|------|-----|
| `components/spreadsheet/email-validation-button.tsx` | Never imported. Has non-functional "Run" button. |
| `components/import/import-leads-dialog.tsx` | Never imported. Multi-step wizard superseded by simple version. |
| `components/import/csv-upload-step.tsx` | Only used by the dead multi-step wizard. |
| `components/import/column-mapping-step.tsx` | Only used by the dead multi-step wizard. |
| `lib/supabase/admin.ts` | Unused. If needed later, can be recreated. |

---

## 12. Security Fixes Required

| Fix | File |
|-----|------|
| Add `.eq("user_id", user.id)` to leads query | `validate/email/route.ts:41` |
| Add `.eq("user_id", user.id)` to leads GET | `leads/route.ts:27` |
| Add `.eq("user_id", user.id)` to stats query | `stats/route.ts:18` |
| Change `select("*")` to only select non-sensitive fields, OR never return API keys to client | `integration-settings.ts:9` |
| Add shared `getAuthenticatedUser()` to eliminate 13× duplicated auth block | New `lib/auth.ts` |
| Add lead ownership verification to email route | `validate/email/route.ts` |

---

## 13. Migration Order

1. `00006_validation_jobs.sql` — validation_jobs table + indexes + RLS
2. `00007_validation_job_items.sql` — job_items table + lease index + RLS
3. `00008_api_operation_logs.sql` — api_operation_logs table + indexes + RLS

---

## 14. Phased Implementation Plan

### Phase 1 — Foundation (security fixes + auth helper)

**Goal:** Fix security bugs. Extract shared utilities. No new features.

**Files:**
- NEW `src/lib/auth.ts` — `getAuthenticatedUser()` helper
- MODIFY `validate/email/route.ts` — add user_id filter, add ownership check, fix unchecked update
- MODIFY `leads/route.ts` — add user_id filter
- MODIFY `stats/route.ts` — add user_id filter
- MODIFY `integration-settings.ts` — fix credential leak (don't return keys to client)
- MODIFY `integrations/page.tsx` — adapt to not receiving full keys
- MODIFY `validation-prompts.ts` — fix race condition (use Supabase upsert)
- DELETE dead code files (5 files)

**DONE WHEN:** Security bugs fixed. Auth helper extracted. Dead code removed. Build passes. No regressions.

---

### Phase 2 — API Operation Logging

**Goal:** One reusable logging system for all external API calls.

**Files:**
- NEW migration `00006_api_operation_logs.sql`
- NEW `src/lib/api-logger.ts` — `createApiLog(userId, projectId, provider, operation)`, `updateApiLog(id, result)`
- MODIFY `validate/icp/route.ts` — wrap Gemini call with logging
- MODIFY `validate/email/route.ts` — wrap Clearout call with logging
- MODIFY `src/types/database.ts` — add api_operation_logs type

**DONE WHEN:** Every Gemini and Clearout call creates a log entry. Failed and successful calls both logged. No secrets in logs.

---

### Phase 3 — Validation Jobs (schema + creation)

**Goal:** Job tables exist. Creating a job works. No processing yet.

**Files:**
- NEW migration `00007_validation_jobs.sql`
- NEW migration `00008_validation_job_items.sql`
- NEW `src/lib/jobs.ts` — `createValidationJob()`, helper functions
- MODIFY `leads-table.tsx` — "Validate Selected" and "Validate All" create jobs instead of calling validate API directly
- MODIFY `icp-validation-button.tsx` — creates job on submit, shows initial feedback

**DONE WHEN:** Clicking "Validate Selected" creates a job record with items. Items appear in DB with correct lead_ids. Job status shows "queued". Browser sees jobId.

---

### Phase 4 — Reliable One-Lead Processor

**Goal:** Process one lead at a time through the job system. Full end-to-end flow.

**Files:**
- NEW `src/app/api/jobs/[jobId]/process/route.ts` — the batch processor
- NEW `src/app/api/jobs/[jobId]/route.ts` — job status endpoint
- NEW `src/lib/processor.ts` — `claimBatch()`, `processItem()`, `completeItem()`, `failItem()`
- NEW `src/lib/retry.ts` — `classifyError()`, `shouldRetry()`, `backoffDelay()`
- MODIFY `icp-validation-button.tsx` — poll for progress, show progress UI
- MODIFY `leads-table.tsx` — trigger processing after job creation

**DONE WHEN:** Select 1 lead → create job → process → Gemini → update lead → mark done. Select 3 leads → all 3 processed sequentially. Previously validated leads are skipped. Browser refresh shows correct progress. Kill the browser mid-processing → reopen → job continues from where it left off.

---

### Phase 5 — Crash Recovery + Retry

**Goal:** Lease-based recovery. Retry with backoff. Error classification.

**Files:**
- MODIFY `src/lib/processor.ts` — implement lease-based claiming
- MODIFY `src/lib/retry.ts` — implement backoff, max attempts, fatal vs retryable
- MODIFY `process/route.ts` — handle lease expiry, stale item recovery

**DONE WHEN:** Start processing 10 leads. Kill the server after 3 complete. Restart processing. Remaining 7 are processed. Completed 3 are NOT re-processed.

---

### Phase 6 — Progress UI

**Goal:** User sees job progress. Job status in the same dialog where validation was triggered.

**Files:**
- MODIFY `icp-validation-button.tsx` — show progress bar, counts, cancel button
- MODIFY `leads-table.tsx` — show active job indicator, refresh on completion

**DONE WHEN:** Dialog shows "7/10 completed, 1 failed". Can close dialog and reopen to see same state. Can cancel a running job.

---

### Phase 7 — Logs Page

**Goal:** Dedicated page showing all API operation history.

**Files:**
- NEW `src/app/logs/page.tsx` — logs table (reuse TanStack table pattern)
- NEW `src/app/api/logs/route.ts` — paginated, filterable logs endpoint

**DONE WHEN:** Logs page accessible from nav. Shows all Gemini/Clearout operations. Filterable by provider, status, date. Sortable by timestamp. Paginated.

---

### Phase 8 — Continuous Validate Mode

**Goal:** "Continuously Validate" button that processes all unvalidated leads.

**Files:**
- MODIFY `leads-table.tsx` — add "Continuously Validate" option
- MODIFY jobs creation logic — support `mode: "continuous"`
- MODIFY `src/lib/jobs.ts` — `getUnvalidatedLeadIds()` for continuous mode

**DONE WHEN:** Click "Continuously Validate" → all unvalidated leads become job items. Already-validated leads skipped.

---

### Phase 9 — ICP Reasoning Popover

**Goal:** Click ICP result in table → see matched vertical + reasoning.

**Files:**
- MODIFY `leads-table.tsx` — ICP cell becomes clickable, opens popover
- NEW or reuse `ui/popover.tsx` — small popover content

**DONE WHEN:** Click "✓ Defense / Aviation" in ICP column → popover shows matched vertical + reasoning text.

---

### Phase 10 — Gemini Batching

**Goal:** Send 5-10 leads per Gemini call for efficiency.

**Files:**
- MODIFY `src/lib/processor.ts` — batch processing mode
- MODIFY `src/lib/validation/gemini.ts` — add `callGeminiBatch(apiKey, prompts[])`
- NEW validation for batch responses (ID matching, completeness)

**DONE WHEN:** 10 leads processed in 2 Gemini calls instead of 10. Response validates correctly. Partial batch failures handled gracefully.

---

### Phase 11 — Concurrency (if needed after batching)

**Goal:** Controlled parallel processing.

**Files:**
- MODIFY `src/lib/processor.ts` — add p-limit concurrency control
- Start conservative: concurrency=2

---

### Phase 12 — Load Testing & Hardening

**Goal:** Prove the system works at 200 leads.

**Files:**
- MODIFY `src/lib/processor.ts` — adjust batch sizes, timeouts
- Add retry limits, rate limit detection, cost estimation

---

## 15. Critical "Do Not Touch" Rules

- **Do not change the Gemini endpoint/model.** `v1/interactions` with `gemini-3.6-flash` is correct.
- **Do not add Redis/queue/external services.** DB-as-queue is sufficient.
- **Do not modify RLS policy patterns.** `auth.uid() = user_id` is correct.
- **Do not change the lead table schema.** Only add new tables.
- **Do not remove the skip-already-validated logic.** It's correct and working.
- **Do not change the variable resolution system.** Only fix the substring ordering bug.

---

## 16. Risks

| Risk | Mitigation |
|------|-----------|
| Vercel function timeout during batch | Batch size capped at 10 (max ~20s). If one Gemini call hangs, item remains "processing" and lease expires. |
| Rate limiting by Gemini | Exponential backoff. Non-blocking — failed items go back to pending for retry. |
| DB contention on job_items claim query | Lease index optimizes this. Only one processor per job (active job UNIQUE constraint). |
| User starts two simultaneous jobs | Prevented by UNIQUE partial index on `(user_id, project_id, type) WHERE status IN ('queued','running','paused')`. |
| Prompt save failure | Non-blocking. Prompt stored on the job record itself (not just validation_prompts), so it's captured at creation time. |

---

## 17. Final CTO Recommendation

**Build the job system in the database. Process in controlled batches. Use lease-based crash recovery. Keep the Gemini integration as-is (it works). Fix the security bugs first. Delete the dead code. Ship Phase 1-5 before doing anything else.**

The current architecture's core problem isn't the Gemini integration — it's that validation runs are synchronous, unrecoverable, and will timeout at scale. The job system solves this with zero new infrastructure dependencies.

Total new code: ~500-700 lines across 6-8 new files + modifications to existing routes. No new packages needed. No new services needed.
