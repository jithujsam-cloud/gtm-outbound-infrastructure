# GTM Outbound Infrastructure

An end-to-end outbound engine that covers the full lifecycle of a B2B lead generation operation: signal discovery, ICP validation, AI-powered email sequencing, open tracking, and a client-facing visibility platform. Four interconnected products running on a shared operational backbone.

Built and battle-tested in production at MapmyIndia (enterprise, BFSI, public sector) and at Clospect (D2C, fintech, pharma, defense, semiconductor). Not a template. Not a tutorial. These systems earned pipeline.

---

## The Problem This Solves

Outbound has three bottlenecks, and most tools only fix one:

1. **Research eats 40–50% of selling time.** Reps spend hours figuring out which accounts to hit, whether contacts are real, and whether emails will land. By the time a static list is cleaned and loaded, the signals that made it relevant are weeks old.

2. **Identical copy at machine speed gets domains flagged.** Most automation sends the same subject and body to every lead in a batch at uniform intervals. Spam filters are trained on exactly that pattern. Teams also have no visibility into what happened after send — they know emails went out, but not whether any landed in an inbox that got opened.

3. **Clients want visibility, and the default answer is credential sharing.** Handing over Instantly logins, Smartlead logins, or Gmail access gives clients a view into everything: other campaigns, other clients' data, API keys, sending infrastructure. The alternative — static PDF reports — creates a constant back-and-forth that burns hours across every client relationship.

This system fixes all three, end to end.

---

## The Four Layers

```
                         ┌──────────────────────┐
                         │   SIGNAL DISCOVERY   │
                         │   (n8n + Apify +     │
                         │    Gemini)           │
                         │                      │
                         │  Live job postings   │
                         │  → ICP scoring       │
                         │  → Email validation  │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   OUTBOUND ENGINE    │
                         │   (n8n + Claude +    │
                         │    Gmail + Airtable) │
                         │                      │
                         │  AI-rewritten emails │
                         │  → Randomized sends  │
                         │  → Self-built pixel  │
                         │    tracking          │
                         └──────────┬───────────┘
                                    │
                         ┌──────────┴───────────┐
                         │                      │
                         ▼                      ▼
              ┌──────────────────┐   ┌──────────────────┐
              │  VALIDATION TOOL │   │  CLIENT PORTAL    │
              │  (Next.js +      │   │  (Klaroh SaaS)    │
              │   Supabase)      │   │                   │
              │                  │   │  Next.js +        │
              │  CSV import,     │   │  Supabase Auth +  │
              │  spreadsheet UI, │   │  RLS + Resend     │
              │  Gemini +        │   │                   │
              │  Clearout calls  │   │  White-label      │
              │                  │   │  dashboards per   │
              │  The GUI for     │   │  client, with     │
              │  Layer 1         │   │  remarks feed     │
              └──────────────────┘   └──────────────────┘
```

### Layer 1 — Signal-to-Pipeline (Discovery & Validation)

**Location:** `systems/signal-to-pipeline/`

Two n8n workflows chained together. The output feeds the same Airtable table that Layer 2 pulls from.

**Job Signal Scraper:** Apify pulls live LinkedIn job postings by industry and target role set. n8n flattens the raw dataset, normalizes fields, and groups all open roles by company. Gemini generates a hiring analysis per company — what they're building, where they're hiring, seniority spread, stack focus, and urgency indicators — plus a one-line outreach hook that references the actual location, domain, and scale of hiring.

The insight: job postings are a live signal. A company hiring 15 engineers in Bengaluru this week is telling you what they're building, at what scale, and where the pressure is. That's a better opener than a guess based on headcount and industry tag. And it moves faster than list hygiene cycles — pull from live postings, and the signal and the outreach are in the same week.

**Lead Sourcing + ICP Validation:** Apify Leads Finder pulls raw contact records. Leads upsert into Airtable immediately. Gemini scores each contact for ICP fit across five verticals: D2C/E-commerce, Defense/Aviation, Fintech, Pharma, Semiconductor/Data Center. Then a deterministic email scoring system runs: structure check (+20), name match (+15 each for first and last), domain match (+25), pattern quality (+10), generic prefix penalty (-20). Threshold: 60 for VALID. Clearout SMTP verification only fires on leads that pass both ICP and email scoring — because Clearout costs money per check. Running it on every raw lead would burn credits on contacts that get filtered out anyway.

The email scoring is deterministic, not LLM-based, because fuzzy scoring isn't auditable: you can't tell why a lead passed or failed. A point-based system with documented rules is.

**Stack:** n8n, Apify, Gemini (Google AI), Clearout, Airtable

**Files:** `job-signal-scraper.json`, `lead-sourcing-icp-validation.json`

---

### Layer 2 — Outbound Engine (Sending & Tracking)

**Location:** `systems/outbound-engine/`

One n8n workflow, two branches: the send branch and the tracking branch.

**Send branch:** Schedule trigger fires every 15 minutes, weekdays 9am–5pm. Fetches leads from Airtable filtered to `Safe To Send = yes`, capped at 6 per run. Generates a random float delay (0–3 minutes) between sends to break SMTP patterns. Claude (Anthropic) rewrites the subject and body on every call — full rewrite, different opening line, different sentence structure, different framing. Not spintax. Spintax is detectable because the sentence structure stays the same even when individual words swap. A full rewrite with varied openings and different paragraph order looks like separate emails written by a person.

Sends via Gmail with a self-built 1×1 transparent PNG tracking pixel embedded in the body, URL-encoded with the Airtable record ID.

**Tracking branch:** A separate webhook endpoint receives GET requests when the pixel loads. Extracts the record ID, checks whether `Opened On` is already set, writes the timestamp to Airtable if not, and returns the pixel. If already set, skips the write and returns the image anyway. Writing open events directly to Airtable means the CRM is the single source of truth — no separate analytics tool, no export step, just a timestamp in the same record the rep is already looking at.

The pixel tracker is self-built because third-party tools add a tracking domain to every link in the email, which is itself a signal that spam filters flag. A pixel served directly from your own n8n webhook has no third-party domain in the header.

**Stack:** n8n, Claude (Anthropic), Gmail, Airtable

**Files:** `email-automation-openrate.json`

---

### Layer 3 — GTM Validation Tool (Lead Operations UI)

**Location:** `gtm-validation-tool/`

A Next.js 16 web dashboard that gives the operations team a spreadsheet interface for lead sourcing and validation. This is the GUI counterpart to the n8n `lead-sourcing-icp-validation.json` workflow — same logic, same verticals, same scoring, but wrapped in a UI that a non-technical team member can operate.

**What's built:**
- CSV import with a hand-rolled parser (quote-aware, no dependencies), 3-step wizard: upload → column mapping with auto fuzzy-match → chunked import with progress bar
- TanStack Table spreadsheet with grouped column headers, color-coded badges, quick filter chips, column visibility picker, expandable row detail, inline edit, bulk delete, CSV export
- Dashboard with stat cards and SVG charts (donut for ICP match rate, bar chart by vertical)
- Integration settings for Supabase, Gemini, and Clearout credentials — stored in localStorage + cookies so they survive deploys

**What's planned (mapped out but not wired up):** Gemini API call for ICP classification, Clearout API call for email verification, authentication, scheduled validation runs.

**Stack:** Next.js 16, TypeScript, Tailwind CSS 3, Supabase, TanStack Table v8, shadcn/ui

---

### Layer 4 — Klaroh (Client Visibility Platform)

**Two artifacts:** A full-featured SaaS product (`klaroh/`) and a minimal self-contained portal (`systems/client-visibility-layer/`).

**Klaroh** is the commercial product — a white-label client visibility platform for lead generation agencies. Each client gets a public URL (`/c/[slug]`) showing real-time campaign metrics. Agencies post structured remarks. The system sends email notifications.

The product has: Supabase Auth (signup, login, password reset), plan-enforced client limits (trial: 3, basic: 3, standard: 10, pro: 25), campaign management (Smartlead API or demo data), public client dashboards, an append-only remarks feed with file attachments, Resend email notifications (onboarding, invite, remark alerts), email infrastructure health signals, agency logo upload and white-labeling, and a billing page. 22 database migrations. AES-256-GCM encryption for Smartlead API keys. SECURITY DEFINER Postgres RPCs for public reads — no blanket RLS. Rate limiting on all write endpoints.

**Stack:** Next.js 16, Supabase, Resend, OpenAI, Recharts, Framer Motion

**The Client Visibility Layer** (`systems/client-visibility-layer/`) is a stripped-down version of the same concept. No auth. No remarks. No Smartlead. No multi-tenancy. Exactly three database tables and three RPCs. Designed for a single-agency operator who just needs a read-only portal so clients can check their stats without ever touching a tool login. The entire security model is: `SECURITY DEFINER` functions scoped to a single slug, plus a `status` column on clients that acts as a kill switch — set it to `paused` and the portal stops resolving.

Also: **Klaroh-Website** (in `/Klaroh-Website`) is the marketing landing page for the Klaroh product — a Vite + React SPA with waitlist collection and an interactive demo sandbox.

---

## How Data Flows

```
LinkedIn Job Posts ──Apify──► n8n ──Gemini──► Hiring Analysis
                                                      │
                                                      ▼
                                              Airtable (Lead Queue)
                                                      │
Raw Contacts ──Apify──► n8n ──Gemini──► ICP Score     │
                            │                         │
                            ├──► Email Score          │
                            │         │               │
                            │    Clearout Verification│
                            │         │               │
                            └─────────┴───────────────┘
                                                      │
                                                      ▼
                                              Safe To Send = yes
                                                      │
                                                      ▼
                                     n8n ──Claude──► AI Rewrite
                                         │
                                         ├──► Random delay
                                         ├──► Gmail send
                                         └──► Pixel embed
                                                     │
                                                     ▼
                                         Webhook ◄── Pixel loads
                                                     │
                                                     ▼
                                         Opened On → Airtable
                                                     │
                        ┌────────────────────────────┘
                        │
                        ▼
              Klaroh Client Portal
              ┌──────────────────────┐
              │ /c/[slug]            │
              │                      │
              │ ▸ 4 stat cards       │
              │ ▸ Cumulative chart   │
              │ ▸ Remarks timeline   │
              │ ▸ Email infra health │
              └──────────────────────┘
```

One Airtable table is the queue. Signal-to-Pipeline writes to it. Outbound Engine reads from it and writes tracking events back to it. Klaroh or the Client Visibility Layer surfaces a subset of that data to each client through a branded, no-login URL.

---

## Why It's Built This Way

**Job signals over static lists.** An Apollo export is stale by the time it's cleaned. Live LinkedIn postings mean the signal and the outreach land in the same week, with context about what the account is actually building.

**ICP scoring before email verification.** Clearout charges per check. Running it on every raw lead burns credits on contacts the ICP filter would have discarded. The pipeline narrows the set at each stage: raw → ICP → email score → Clearout. Each step is cheaper than the next.

**Deterministic email scoring, not LLM.** Audit matters. A point-based system with documented rules tells you exactly why a lead passed or failed. An LLM can't — and when a client asks "why didn't this lead get contacted," you need a real answer.

**Full AI rewrite, not spintax.** Spintax swaps words but keeps sentence structure identical. That pattern is detectable. Claude generates genuinely different emails every time — different openings, different paragraph order, different framing. Same core message and CTA, but each one reads like it was written for that specific person.

**Self-built pixel tracking.** Third-party tracking domains in email headers are a signal spam filters look for. A pixel served from your own n8n webhook carries no third-party footprint. Open events write directly to Airtable so the CRM stays the single source of truth.

**No auth on the client portal.** Adding a login page would be theater — the portal is read-only and scoped by slug. The `status` column is the kill switch. Set it to `paused`, the URL stops resolving. No sessions to manage, no tokens to expire, no invite flows to build.

---

## Repo Map

```
gtm-outbound-infrastructure/
├── systems/
│   ├── signal-to-pipeline/          # n8n: lead discovery + ICP + email validation
│   ├── outbound-engine/             # n8n: AI email sending + pixel tracking
│   ├── client-visibility-layer/     # Next.js: minimal client portal (3 tables, no auth)
│   └── klaroh/
│       └── mental-model.md          # Full Klaroh architecture doc
├── gtm-validation-tool/             # Next.js: lead validation spreadsheet UI
├── klaroh/                          # Next.js: full SaaS client visibility platform
├── Klaroh-Website/                  # Vite + React: marketing landing page + demo
└── README.md
```

---

## Stack Summary

| Layer | Technologies |
|---|---|
| Signal Discovery | n8n, Apify, Gemini (Google AI), Airtable |
| Email Validation | Clearout, Gemini (Google AI) |
| Email Sending | n8n, Claude (Anthropic), Gmail, Airtable |
| Validation UI | Next.js 16, TypeScript, Supabase, TanStack Table, shadcn/ui |
| Client Portal (SaaS) | Next.js 16, Supabase (Auth + RLS + RPCs), Resend, Recharts, Framer Motion |
| Client Portal (Minimal) | Next.js 16, Supabase (RPCs), Recharts |
| Marketing Site | Vite, React 19, Tailwind CSS v4, Framer Motion |

---

## Getting Started

Each system has its own README with setup instructions:

- **[Signal-to-Pipeline](systems/signal-to-pipeline/README.md)** — Import n8n workflows, configure Apify/Gemini/Clearout/Airtable credentials
- **[Outbound Engine](systems/outbound-engine/README.md)** — Import n8n workflow, configure Claude/Gmail/Airtable, set your webhook URL
- **[GTM Validation Tool](gtm-validation-tool/README.md)** — Next.js app, Supabase project, CSV import
- **[Client Visibility Layer](systems/client-visibility-layer/README.md)** — Next.js app, three-table Supabase schema, no auth required
- **[Klaroh Mental Model](systems/klaroh/mental-model.md)** — Architecture doc if you're evolving toward the full SaaS

---

[LinkedIn](https://in.linkedin.com/in/jithujsam)
