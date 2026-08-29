# GTM Validation Tool

A production-style lead validation pipeline with a spreadsheet UI: upload raw CSVs, score ICP fit across five verticals (Gemini or OpenAI), verify emails via Clearout SMTP checks, and export send-ready lists. This is the engineering core of the portfolio — the same logic as the n8n workflow at `systems/signal-to-pipeline/lead-sourcing-icp-validation.json`, rebuilt as a durable job system a non-technical operations team can operate without touching n8n.

---

## The Problem This Solves

Before this tool existed, the lead validation pipeline ran inside n8n:

```
Apify export → n8n transforms → Gemini ICP scoring → Email score → Clearout
```

It worked, but every parameter change — a new vertical definition, a different threshold, a different source column — meant opening n8n, editing a JSON node, and hoping nothing upstream broke. The pipeline was opaque: no way to see why a specific lead scored the way it did, no way to bulk-edit misclassified records, no way to run a one-off import without understanding the whole workflow.

This tool puts a UI on the same pipeline, then rebuilds the processing under it properly.

---

## The Pipeline

```
CSV Upload ─► Column Mapping ─► Spreadsheet ─► ICP (Gemini/OpenAI) ─► Email Score ─► Clearout ─► Export
                                                │
                                                ▼
                                 Durable job system: leases, retries, rate limits
```

### Stage 1: Ingest

Drag-and-drop a CSV. Parsing is handled by PapaParse, lazy-loaded so it doesn't inflate the initial bundle — handles quoted fields, commas inside quotes, escaped quotes, multi-line fields, and both `\r\n` and `\n` line endings.

A 3-step wizard walks through: preview the data → map columns to the 13-source-field schema (auto fuzzy-matched) → chunked import at 100 leads per request with an animated progress bar. Missing required fields are flagged before import begins, not after 500 rows have been written.

### Stage 2: Validate — implemented, not planned

ICP classification and email verification are both wired, both user-triggerable from the spreadsheet, and both run through the job system below.

**ICP Classification** — each lead is scored for fit across five verticals:

| Vertical | What it covers |
|---|---|
| **D2C / E-commerce** | D2C brands, e-com platforms, logistics tech, retail POS, loyalty platforms |
| **Defense / Aviation** | Defense contractors, aerospace, MRO, drones, defense software, ATC tech |
| **Fintech** | Payments, neo-banks, BNPL, InsurTech, RegTech, crypto infra, fraud detection |
| **Pharma** | Drug development, biotech, CROs/CDMOs, medical devices, pharma AI |
| **Semiconductor / Data Center** | GCCs, fabless design, foundries, EDA, hyperscalers, OSAT |

Recruitment and staffing firms are always excluded. Model output is enforced with structured JSON schemas, returns `vertical_match`, `matched_vertical`, `reasoning` (a written explanation of the verdict), and an `ai_summary`. Two LLM providers supported: Gemini and OpenAI.

**Email Verification (Clearout)** — SMTP-level verification via the Clearout v2 API. Configurable requests-per-minute and request timeout, saved per user. Provider 429s pause the job and resume it after the limit reset instead of failing leads.

**Email Quality (Clearout)** — every verified lead stores Clearout's quality verdict as returned: a 0–100 `score` (`email_score`), a `status` (`email_check`), a `safe_to_send` flag, and SMTP-level detail (`smtp_provider`, `mx_record`). The number in the UI is Clearout's number, stored verbatim — not a locally recomputed guess. Because ICP verdicts keep written `reasoning` and email verdicts keep their attribution, "why did this lead pass or fail" is always answerable per lead.

### Stage 3: Output

Validated, verified leads get flagged `Safe To Send = yes`. The spreadsheet exports any filtered view as CSV, so the operations team can slice the data and push it wherever the next step lives.

---

## The Job System (the actual engineering)

Validation runs are not a `for` loop over a fetch. They are durable jobs:

- **The database is the queue.** One `validation_jobs` row per run; one `validation_job_items` row per lead. No Redis, no BullMQ — appropriate for a ≤200-lead internal tool on serverless.
- **Lease-based claiming.** `claim_job_items` uses `FOR UPDATE SKIP LOCKED` with a 60s lease. Two workers can never claim the same lead.
- **Atomic, lease-verified writes.** `apply_icp_results` / `apply_email_results` update lead columns and job-item status in a single Postgres function, joining on `lease_expires_at > NOW()`. A stale worker's writes are silently discarded.
- **Retries with exponential backoff.** 1s → 2s → 4s → 8s → 16s, max 3 attempts, scheduled at the database level (`next_attempt_at`) instead of blocking with `setTimeout`.
- **Auto-pause.** >50% failure rate over ≥5 items pauses the job and surfaces an error instead of corrupting the list.
- **Crash recovery.** If the browser closes mid-run, in-flight items stay `processing` until their lease expires, then become reclaimable. No lost work.
- **Concurrency.** Batches of 10 leads per claim; sub-batches of 5 (Gemini) or 3 (OpenAI) per LLM call; 2 concurrent sub-batches; email verification concurrency governed by the rate-limit slot reservation.
- **Rate-limit engineering.** Clearout slots are reserved in the database per user (persisted, survived across requests), and 429 responses with a reset time pause/resume the whole job.

---

## Auth & Security

- Supabase Auth (signup/login on `/auth/login`, cookie session via `@supabase/ssr`).
- A proxy (`src/proxy.ts`) redirects unauthenticated requests to login; every API route also validates the session with `supabase.auth.getUser()`.
- Per-user RLS on every table (`auth.uid() = user_id`), added in dedicated migrations.
- Provider API keys are stored per user in `integration_settings`, written via server actions and read server-side by the job processor; they are never loaded back into the browser.

---

## Observability

Every external API call is written to `api_operation_logs` — provider, operation, model, latency, HTTP status, tokens, cached tokens, and computed cost. A logs page (`/logs`) and per-run history/detail views surface this, so each validation run has a real unit-economics audit trail.

---

## Credential Resolution

| What | Where it lives |
|---|---|
| Supabase connection | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars — used by the browser and server clients |
| Provider API keys (LLM, Clearout) | Per-user rows in `integration_settings`, written through server actions on `/integrations`, read server-side by the job processor. Never loaded back into the browser. |
| Session | Supabase Auth cookie via `@supabase/ssr` |

`SupabaseProvider` initializes lazily inside `useEffect`, so Vercel builds succeed even without environment variables set — build first, configure later. Consumers check for a `null` client and show a "not configured" state instead of crashing.

---

## Database Schema

Seven tables across 16 migrations:

| Table | Purpose |
|---|---|
| `projects` | User-owned project containers |
| `leads` | 13 source columns + ICP/email validation columns, denormalized `user_id` for RLS |
| `integration_settings` | Per-user provider keys (LLM API key, provider, Clearout key) + rate-limit settings |
| `validation_prompts` | Per-project prompt templates with `/variable` placeholders, resolved server-side |
| `api_operation_logs` | Audit trail for every external API call |
| `validation_jobs` | One row per validation run, with status, counters, provider/model snapshot, rate-limit state |
| `validation_job_items` | One row per lead in a job; `status`, `attempt`, `lease_expires_at`, `next_attempt_at` |

Key migrations: `00002/00003` (auth + per-user RLS), `00009/00011/00013` (lease-based claiming + atomic result RPCs + indexes), `00014` (LLM usage/cost tracking), `00015/00016` (Clearout rate limiting and slot reservation).

---

## API Surface

| Route | Methods | Description |
|---|---|---|
| `/api/projects` | GET, POST | List, create |
| `/api/projects/[projectId]` | GET, PUT, DELETE | Single project CRUD |
| `/api/projects/[projectId]/leads` | GET, POST | Paginated list + bulk create |
| `/api/projects/[projectId]/leads/[leadId]` | GET, PUT, DELETE | Single lead CRUD (PUT is field-whitelisted — validation columns can't be hand-edited) |
| `/api/projects/[projectId]/jobs` | POST | Create an ICP or email validation job |
| `/api/projects/[projectId]/stats` | GET | Project stats via SQL aggregate RPC |
| `/api/jobs/[jobId]` | GET | Job status + progress |
| `/api/jobs/[jobId]/detail` | GET | Run detail + item-level results |
| `/api/jobs/[jobId]/process` | POST | Process one batch (dispatches by `job.type`) |
| `/api/logs` | GET | API operation logs |
| `/api/projects/[projectId]/validate/icp` · `/validate/email` | POST | Legacy single-lead fallback routes (kept, not the main path) |

---

## Implementation Status & Known Limitations

**Implemented:** CSV ingest, spreadsheet UI, dashboard, ICP validation (Gemini + OpenAI), Clearout email verification with rate limiting, job system (leases, atomic writes, retries, auto-pause, crash recovery), auth + per-user RLS, API/cost logging, run history and logs pages.

**Limitations — stated honestly:**

- No automated test suite exists.
- `next.config.ts` sets `typescript.ignoreBuildErrors: true` — Supabase-generated types currently produce `never` errors that are pre-existing and not fixed.
- The two legacy `/validate/*` routes still exist as fallbacks.
- The migrations are files in this repo. You must apply them to your Supabase project (SQL editor or migration runner) before the RPCs used by the job system exist.

---

## Stack

- **Next.js 16** — App Router, Server Components for data fetching
- **TypeScript** — shared types between API and UI
- **Tailwind CSS 3** — v4's WASM parser crashes on Android/ARM64; v3 stays stable everywhere
- **Supabase** — PostgreSQL, RLS, SECURITY DEFINER RPCs, atomic functions
- **TanStack Table v8** — headless table with server-side pagination, column visibility, row expansion
- **shadcn/ui** — accessible primitives
- **SVG charts** — hand-rolled donut and bar charts, zero chart-library dependencies

---

## Getting Started

```bash
cd gtm-validation-tool
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
# Apply supabase/migrations/*.sql to your Supabase project (00001 → 00016)

npm install
npm run dev  # → http://localhost:3000
```

If env vars are skipped, the app still loads — paste credentials in `/integrations` and log in on `/auth/login`.

---

## Reference

Built from the n8n workflow:
`systems/signal-to-pipeline/lead-sourcing-icp-validation.json`

Same five-vertical model and the same provider approach — rebuilt as a web app a non-technical team can operate, with a durable job engine underneath.