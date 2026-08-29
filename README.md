# GTM Outbound Infrastructure

A portfolio of outbound GTM systems built from four years of operating real B2B lead generation — enterprise outbound and a lead-gen agency. This repository is the engineering side of that operation: it moves a lead from a live job posting through ICP scoring, email verification, AI-personalized outreach, open tracking, and a client-facing dashboard — with a documented reason for every design decision.

There are no fake clients, invented revenue, or unverifiable production claims in this repository. What is marked **Implemented** is code you can read and run. What is marked **Design Reference** is explicitly not shipped code.

Read it two ways:

- **As a GTM operator** — the "why" sections explain the outbound logic: why ICP scoring runs before paid email verification, why a full AI rewrite beats spintax, why a self-hosted pixel beats a third-party tracking domain, why clients should never get tool logins.
- **As a builder** — the flagship tool shows durable engineering for a GTM problem: a job queue with lease-based claiming, atomic result writes, retries with exponential backoff, provider rate limiting, per-user authentication, and LLM cost tracking.

---

## What This Demonstrates

| Competency | Evidence |
|---|---|
| Outbound domain expertise | Signal-based prospecting, staged list narrowing, deliverability-aware sending, client visibility without credential sharing |
| Workflow automation | Two importable n8n pipelines (discovery + validation, sending + tracking) |
| Web application development | Next.js validation tool with CSV ingest, spreadsheet UI, dashboards |
| Data / database engineering | PostgreSQL schema with RLS, SECURITY DEFINER RPCs, atomic write functions, migrations |
| AI/LLM integration | Gemini + OpenAI structured-output classification; Claude email rewriting; per-run cost tracking |
| API integration | Clearout email verification with rate-limit handling; Supabase Auth |
| Reliability | Retries with backoff, crash recovery, lease-based job processing, provider throttling |

---

## The GTM Workflow

```
                        ┌────────────────────────────────────────────────┐
                        │  SIGNAL + VALIDATION  (n8n workflows)         │
                        │  Apify  →  Gemini ICP  →  Email score  →       │
                        │  Clearout  →  Airtable queue                   │
                        └───────────────────────┬────────────────────────┘
                                                │  Airtable = lead queue
                        ┌───────────────────────▼────────────────────────┐
                        │  OUTBOUND ENGINE  (n8n workflow)               │
                        │  Claude rewrite  →  randomized delay  →         │
                        │  Gmail send  →  self-hosted pixel tracking     │
                        └───────────────────────┬────────────────────────┘
                                                │  open events written back
                        ┌───────────────────────▼────────────────────────┐
                        │  GTM VALIDATION TOOL  (flagship, Next.js)      │
                        │  CSV → ICP (Gemini/OpenAI) → Clearout, with     │
                        │  durable job queue + auth + cost tracking       │
                        └───────────────────────┬────────────────────────┘
                                                │  metrics / status
                        ┌───────────────────────▼────────────────────────┐
                        │  CLIENT VISIBILITY LAYER  (Next.js)            │
                        │  /c/[slug] no-login dashboards                  │
                        └────────────────────────────────────────────────┘
```

Stages that are actually implemented (see [Implementation Status](#implementation-status)):

**Signal** → live LinkedIn job postings grouped per company, analyzed for what the account is building and where the pressure is, plus an outreach hook.

**Data** → raw contacts land in the queue immediately; each lead is ICP-scored across five verticals (verdicts keep written reasoning), and every email score stays attributed to its source rather than "the AI said so".

**Qualification** → Clearout SMTP verification runs only on the survivors, because it costs money per check. Narrow-cheap-first, verify-expensive-last.

**Personalization** → Claude rewrites subject and body on every send — full rewrite with varied openings and paragraph order, not spintax.

**Outbound** → sends are randomized 0–3 minutes apart, capped per run, weekdays 9am–5pm, to break the uniform-burst pattern spam filters are trained on. A self-built 1×1 pixel (no third-party tracking domain) records opens into the same Airtable record the rep already uses.

**Measurement** → client-facing dashboards replace PDF reports and shared tool logins.

---

## Flagship System: GTM Validation Tool

**Location:** [`gtm-validation-tool/`](gtm-validation-tool/README.md)

The strongest GTM engineering in this portfolio. It reimplements the n8n validation pipeline as a web application a non-technical operations team can operate, then rebuilds the processing under it as a durable job system.

Built and implemented, verified in code:

- **CSV ingest** — 3-step wizard (upload → column mapping with fuzzy match → chunked import with progress); parsing via PapaParse lazy-loaded so it never inflates the initial bundle.
- **Spreadsheet UI** — TanStack Table with grouped headers, color-coded badges, filter chips, inline edit, bulk delete, export of the visible set, server-side pagination.
- **ICP validation** — Gemini and OpenAI providers, structured JSON output (`strict: true` schemas), batch classification (5 leads per Gemini call, 3 per OpenAI call), 2 concurrent sub-batches, per-run temperature/model controls.
- **Email validation** — Clearout SMTP verification in the same job system, with configurable requests-per-minute and timeout, persisted rate-limit slot reservation, and auto-pause/resume when the provider returns 429.
- **The job engine** — the database is the queue. `claim_job_items` uses `FOR UPDATE SKIP LOCKED` with a 60s lease; results are written atomically through `apply_icp_results` / `apply_email_results`, which verify lease ownership inside the transaction so a stale worker cannot overwrite fresh data. Retries use exponential backoff (1s → 16s), auto-pause at >50% failure, crash recovery on browser close. Up to 200 leads per run, 10 claimed per batch.
- **Auth & multi-user isolation** — Supabase Auth, cookie sessions, proxy-level redirect plus per-route `getUser` checks, and per-user RLS across all tables.
- **Observability** — every external API call is logged (`api_operation_logs`) with tokens, latency, and computed cost; a run-history UI and a logs page surface it.
- **16 database migrations** for the schema above, each a standalone SQL file.

Honest limitations: no automated test suite, and type errors from Supabase-generated types are currently ignored at build time.

---

## Supporting Systems

### Signal-to-Pipeline (n8n)

**Location:** [`systems/signal-to-pipeline/`](systems/signal-to-pipeline/README.md)

Two workflow definitions that turn live hiring signals into a validated send queue:

- **Job Signal Scraper** — Apify pulls live LinkedIn job postings; n8n normalizes and groups them by company; Gemini writes a hiring analysis (what they're building, seniority spread, urgency) plus a one-line outreach hook that references the actual location, domain, and scale.
- **Lead Sourcing + ICP Validation** — Apify contacts upsert into Airtable immediately; Gemini scores ICP fit across five verticals and assigns an email score with written reasoning in the same structured call; Clearout SMTP verification fires only on the survivors.

Why staging matters: each filter is cheaper than the next, so the paid step (Clearout) never sees contacts the earlier stages would discard.

**Status:** importable workflow definitions. Running them requires an n8n instance and the credentials listed in the README (Apify, Gemini, Clearout, Airtable).

### Outbound Engine (n8n)

**Location:** [`systems/outbound-engine/`](systems/outbound-engine/README.md)

One workflow, two branches:

- **Send** — scheduled every 15 min, weekdays 9am–5pm, max 6 per run; Claude rewrites subject and body every send; a random 0–3 minute delay spaces them; Gmail sends with a self-built 1×1 transparent pixel, URL-encoded with the Airtable record ID.
- **Tracking** — a webhook serves the pixel, extracts the record ID, writes `Opened On` once (idempotent), and returns the image. Airtable stays the single source of truth — no separate analytics tool, no export step.

**Status:** importable workflow definition. Running requires n8n, Claude, Gmail OAuth, Airtable, and a public webhook URL.

### Client Visibility Layer

**Location:** [`systems/client-visibility-layer/`](systems/client-visibility-layer/README.md)

The smallest, sharpest version of the client-portal idea. No auth, deliberately: one agency user, read-only public pages scoped by slug through SECURITY DEFINER RPCs, and a `status` column as a kill switch. Three tables, three RPCs. Agency write endpoints are unauthenticated by design — this is a single-operator tool, not a multi-tenant SaaS.

**Status:** implemented as a self-contained Next.js app with seeded demo data.

---

## Design Reference (not bundled code)

**Klaroh** (full SaaS client visibility platform) exists in this repository only as [`systems/klaroh/mental-model.md`](systems/klaroh/mental-model.md) — an architecture document covering Auth, plan enforcement, remarks, Resend emails, Smartlead integration, AES-256-GCM key encryption, and rate limiting. The code for that larger product, and the `Klaroh-Website` marketing site, live outside this repository. They are referenced here for the design thinking only.

---

## Architecture Decisions

- **The database is the queue.** No Redis, BullMQ, or SQS. Validation jobs live in PostgreSQL tables; a Next.js route processes one batch per invocation and returns before serverless timeouts. Correct infrastructure for a ≤200-lead internal tool.
- **Lease-based claiming over check-then-act.** `FOR UPDATE SKIP LOCKED` plus a 60s lease means two workers can never process the same lead; expired workers' writes are discarded by the atomic result RPCs.
- **Atomic result writes.** Lead data and job-item status update in one Postgres function or neither. No partial completions.
- **Staged cost filter.** ICP classification → email score → Clearout. Clearout costs real money per check; the pipeline makes sure it only ever sees the smallest, most-likely set.
- **Score attribution over black-box scoring.** Clearout's score is stored verbatim (never recomputed) and ICP verdicts carry written reasoning — when a client asks "why wasn't this lead contacted," the answer is documented per lead.
- **Full AI rewrite over spintax.** Spintax keeps sentence structure identical, which filters detect. Claude produces genuinely different emails each time.
- **Self-hosted pixel over third-party tracking.** No third-party tracking domain in email headers, and open events land in the same CRM record the rep reads.
- **No-login client portal.** Read-only, slug-scoped, with a status kill switch. Auth would be theater at this scale — but see the Client Visibility Layer limitation above.
- **Build without credentials.** Supabase initializes lazily client-side so a first deploy isn't a chicken-and-egg problem; credentials can be pasted in the UI.

---

## Implementation Status

| System | Status | What "implemented" means here |
|---|---|---|
| **GTM Validation Tool** | Implemented | Full Next.js app; runnable with a Supabase project + provider API keys. All pipeline stages wired. |
| **Signal-to-Pipeline** | Workflow definitions | Importable n8n JSONs; require an n8n instance + Apify/Gemini/Clearout/Airtable credentials. |
| **Outbound Engine** | Workflow definition | Importable n8n JSON; requires n8n + Claude/Gmail/Airtable + a public webhook URL. |
| **Client Visibility Layer** | Implemented (demo-scale) | Next.js app with seeded demo data; single-operator, no auth by design. |
| **Klaroh (full SaaS)** | Design reference | Architecture document only; code is not in this repository. |

---

## What This Repository Does Not Cover

To keep the claims honest, this portfolio does **not** include: multi-step email sequences/cadences, reply routing or CRM pipeline updates, bounce handling, a live sync layer into the client portal, automated tests, or any real client data.

---

## Technical Stack

Grouped by underlying competency, not as a tool list:

| Competency | Technologies |
|---|---|
| Web application | Next.js 16, TypeScript, React 19, Tailwind CSS 3, TanStack Table v8, shadcn/ui, hand-rolled SVG charts |
| Data layer | Supabase / PostgreSQL — migrations, RLS, SECURITY DEFINER RPCs, atomic functions, generated columns |
| Workflow automation | n8n (importable workflows), Apify, Airtable as the lead queue |
| LLMs | Gemini (structured output), OpenAI `gpt-4.1-mini` (strict JSON schema + batching), Claude (email rewriting) |
| Email verification | Clearout SMTP-level verification with rate-limit + timeout controls |
| Auth & security | Supabase Auth, cookie sessions, proxy auth guard, per-user RLS |
| Scoring | Clearout 0–100 email score (stored verbatim) + LLM ICP classification with written reasoning |
| Observability | Per-API-call logs with tokens, latency, and computed LLM cost |

---

## Repo Map

```
gtm-outbound-infrastructure/
├── systems/
│   ├── signal-to-pipeline/          # n8n: live job signals + ICP + email validation
│   ├── outbound-engine/             # n8n: AI-rewritten sends + self-hosted open tracking
│   ├── client-visibility-layer/     # Next.js: no-login client portal (3 tables)
│   └── klaroh/mental-model.md       # DESIGN REFERENCE — full SaaS architecture doc (not code)
├── gtm-validation-tool/             # Next.js: flagship — durable lead validation pipeline UI
└── README.md
```

---

## Getting Started

Each system has its own README with setup steps:

- **[GTM Validation Tool](gtm-validation-tool/README.md)** — Next.js app + Supabase project; the only system with a local-dev workflow.
- **[Signal-to-Pipeline](systems/signal-to-pipeline/README.md)** — import n8n workflows, configure Apify/Gemini/Clearout/Airtable credentials.
- **[Outbound Engine](systems/outbound-engine/README.md)** — import n8n workflow, configure Claude/Gmail/Airtable + webhook URL.
- **[Client Visibility Layer](systems/client-visibility-layer/README.md)** — Next.js app, three-table Supabase schema, no auth required.

---

[LinkedIn](https://in.linkedin.com/in/jithujsam)