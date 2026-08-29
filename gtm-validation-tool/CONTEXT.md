# GTM Validation Tool — Project Summary

## What It Is

A Next.js 16 lead validation dashboard. Users import CSV lead lists; the tool scores ICP fit (5 verticals) via Gemini or OpenAI and verifies emails via Clearout, through a durable job system (leases, retries, rate limits, atomic writes). Results show in a spreadsheet UI with run history and cost/API logs.

## Stack

Next.js 16 (App Router), TypeScript, Tailwind CSS 3, Supabase (PostgreSQL), TanStack Table v8, shadcn/ui

---

## Project Status (truthful)

**Implemented and wired:** CSV ingest, spreadsheet UI, dashboard charts, ICP validation (Gemini + OpenAI, structured output, batching), Clearout email verification (job-based, rate-limit + timeout controls), job system (lease claiming, atomic RPC writes, exponential-backoff retries, auto-pause, crash recovery), auth (Supabase Auth via proxy + per-route `getUser`) + per-user RLS, API/cost logging, run history + logs pages. 16 migrations in `supabase/migrations/`.

**Limitations:** no test suite; `typescript.ignoreBuildErrors: true` in next.config.ts (pre-existing Supabase type errors); legacy `/validate/*` routes still exist as fallbacks; migrations must be applied to the Supabase project for the RPCs to exist.

---

## Project Structure

```
gtm-validation-tool/
├── next.config.ts, tsconfig.json, tailwind.config.ts, postcss.config.mjs
├── vercel.json, .gitignore, .env.local.example, README.md
├── supabase/migrations/00001..00016
└── src/
    ├── proxy.ts                        # Auth redirect guard (matches all routes)
    ├── app/
    │   ├── layout.tsx, globals.css, page.tsx          # Dashboard
    │   ├── projects/page.tsx                          # Projects grid
    │   ├── projects/[projectId]/page.tsx              # Spreadsheet view
    │   ├── integrations/page.tsx                      # API key management
    │   ├── auth/ (login page, callback route, actions)
    │   ├── logs/page.tsx                              # API/logs viewer
    │   ├── settings/actions.ts                        # Per-user settings server actions
    │   └── api/
    │       ├── projects/route.ts                      # GET (list), POST (create)
    │       ├── projects/[projectId]/route.ts          # GET, PUT, DELETE
    │       ├── projects/[projectId]/leads/route.ts    # GET (paginated), POST (bulk)
    │       ├── projects/[projectId]/leads/[leadId]/route.ts  # GET, PUT, DELETE (whitelisted fields)
    │       ├── projects/[projectId]/jobs/route.ts     # POST — create icp/email job
    │       ├── projects/[projectId]/stats/route.ts    # GET — SQL aggregate stats
    │       ├── jobs/route.ts                          # GET — job list
    │       ├── jobs/[jobId]/route.ts                  # GET — status/progress
    │       ├── jobs/[jobId]/detail/route.ts           # GET — run detail + items
    │       ├── jobs/[jobId]/process/route.ts          # POST — process one batch
    │       ├── logs/route.ts                          # GET — api_operation_logs
    │       └── projects/[projectId]/validate/{icp,email}/route.ts  # legacy fallbacks
    ├── components/
    │   ├── ui/          # button, card, badge, dialog, input, label, popover, select, skeleton
    │   ├── layout/      # app-shell, header, page-loader
    │   ├── providers/   # SupabaseProvider (lazy useEffect init)
    │   ├── dashboard/   # StatsCards, RecentProjects
    │   ├── projects/    # ProjectCard, CreateProjectDialog
    │   ├── spreadsheet/ # LeadsTable, ImportLeadsDialog, IcpValidationButton, EmailValidationDialog
    │   ├── validation/  # RunHistory, RunDetail
    │   └── charts/      # DonutChart, BarChart, DashboardCharts, ProjectStats, ValidationSummary (SVG, zero deps)
    ├── lib/
    │   ├── supabase/    # client.ts (browser), server.ts (server/cookie-based)
    │   ├── validation/  # gemini.ts, openai.ts, icp-prompt.ts, variables.ts
    │   ├── processor.ts # job batch processing (ICP + email dispatch)
    │   ├── jobs.ts      # job creation + email run stats
    │   ├── retry.ts     # error classification, backoff, auto-pause
    │   ├── clearout.ts / clearout-rate.ts   # Clearout client + rate-limit config
    │   ├── llm-pricing.ts                   # token/cost calc per model
    │   ├── api-logger.ts # create/update api_operation_logs
    │   ├── auth.ts      # getAuthenticatedUser helper
    │   └── integration-settings.ts
    └── types/           # database.ts, index.ts (ICP_VERTICALS, ICP_*)
```

---

## Database Schema (7 tables, 16 migrations)

| Table | Purpose | Notes |
|---|---|---|
| `projects` | id, name, description, user_id, timestamps | RLS: `auth.uid() = user_id` |
| `leads` | 13 source + validation columns, user_id | RLS per user |
| `integration_settings` | user_id UNIQUE, llm_api_key, clearout_api_key, llm_provider, clearout_requests_per_minute, clearout_timeout_seconds | RLS per user |
| `validation_prompts` | user_id, project_id, type (icp/email), prompt, model | RLS per user |
| `api_operation_logs` | per-call audit: provider, tokens, cost, latency, status | RLS per user |
| `validation_jobs` | type (icp/email), mode, status, counters, model snapshot, provider_reset_at, requests_per_minute, timeout_seconds | partial unique index on active jobs |
| `validation_job_items` | job_id, lead_id, status, attempt, max_attempts, lease_expires_at, next_attempt_at | unique (job_id, lead_id) |

Key RPCs: `claim_job_items` (FOR UPDATE SKIP LOCKED, 60s lease), `apply_icp_results` / `apply_email_results` (atomic, lease-verified bulk writes), `reserve_clearout_request_slot`, `release_rate_limited_items`, `get_project_stats`, `get_dashboard_vertical_breakdown`.

---

## Pages & Features

### Dashboard (`/`)
4 stat cards, donut (ICP match rate), bar (leads by vertical), recent projects, "not configured" banner.

### Projects (`/projects`)
Card grid, "New Project" dialog navigates into the project.

### Spreadsheet (`/projects/[projectId]`)
TanStack table, grouped headers, color badges, filter chips, column visibility, expandable row detail, bulk delete, inline edit (whitelisted fields), CSV export of visible set, server-side pagination, search. Import dialog (3-step). ICP + Email validation buttons open job-driven dialogs with live progress, run summary, and rate-limit state.

### Integrations (`/integrations`)
Per-user provider keys saved via server actions (Supabase, Gemini/OpenAI LLM key, Clearout).

### Logs (`/logs`)
api_operation_logs viewer. Run history/detail on the project page.

---

## Auth

- Supabase Auth cookie session; `src/proxy.ts` redirects unauthenticated users to `/auth/login`; every API route also calls `supabase.auth.getUser()`.
- RLS scopes every table to `auth.uid() = user_id`.

---

## Credential Resolution

| What | Where it lives |
|---|---|
| Supabase connection | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars — used by browser + server clients |
| Provider API keys (LLM, Clearout) | per-user `integration_settings` rows, written via server actions on `/integrations`, read server-side by the job processor; never loaded back into the browser |
| Session | Supabase Auth cookie via `@supabase/ssr` |

All clients return `null` instead of throwing when credentials are missing.

---

## Key Architectural Decisions

- **Database is the queue**: jobs + items in PostgreSQL; `/process` handles one batch per invocation (10 leads), client loops until done. No external queue service.
- **Lease-based claiming**: `FOR UPDATE SKIP LOCKED` + 60s lease → no double-processing; expired worker writes discarded by atomic lease-verified RPCs.
- **Retries**: error classification (retryable/fatal/system), exponential backoff 1s→16s scheduled via `next_attempt_at` (non-blocking), auto-pause at >50% failure.
- **Clearout rate limits**: persisted slot reservation per user + 429 pause/resume with reset-time parsing.
- **No Supabase at build time**: `SupabaseProvider` lazy-init in `useEffect`; Vercel builds pass without env vars.
- **Credential survival**: per-user rows in `integration_settings`; keys never sent to the browser.
- **CSV parsing via PapaParse**: lazy-loaded (`await import("papaparse")`) so it isn't in the initial bundle.
- **SVG charts**: no chart library.
- **Tailwind 3** over 4: v4 WASM parser crashes on Android/ARM64.

---

## Vertical Definitions

| Vertical | Examples |
|---|---|
| **D2C / E-commerce** | D2C brands, e-com platforms, logistics tech, retail POS, loyalty platforms |
| **Defense / Aviation** | Defense contractors, aerospace, MRO, drones, defense software, ATC tech |
| **Fintech** | Payments, neo-banks, BNPL, InsurTech, RegTech, crypto infra, fraud detection |
| **Pharma** | Drug development, biotech, CROs/CDMOs, medical devices, pharma AI |
| **Semiconductor / Data Center** | GCCs, fabless design, foundries, EDA, hyperscalers, OSAT |

Recruitment/staffing firms are **always excluded**.

---

## Vercel Deployment

Deploys from the `gtm-validation-tool/` subdirectory (root `vercel.json` sets `rootDirectory`). Root directory must be `gtm-validation-tool` in Vercel project settings.

### Environment Variables (optional — can use UI + signup instead)

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Local Development

```bash
cd gtm-validation-tool
npm install
cp .env.local.example .env.local   # fill in Supabase credentials
npm run dev                         # starts on localhost:3000
```

Apply `supabase/migrations/*.sql` (00001 → 00016) to the Supabase project first — the RPCs the job system calls only exist after migration 00013+.

On Android/ARM64, build with `-- --webpack` (SWC WASM can't type-check on ARM64).

---

## Reference

Built from the n8n workflow:
`systems/signal-to-pipeline/lead-sourcing-icp-validation.json`