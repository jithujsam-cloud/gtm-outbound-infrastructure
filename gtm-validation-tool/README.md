# GTM Validation Tool

The production-grade automation system for lead sourcing, ICP validation, and email verification. A full pipeline wrapped in a spreadsheet UI — upload raw CSVs, score ICP fit across five verticals, verify emails via SMTP-level checks, and export send-ready lists to Airtable. Built from the n8n workflow at `systems/signal-to-pipeline/lead-sourcing-icp-validation.json`, upgraded into a web application a non-technical operations team can run without touching n8n.

---

## The Problem This Solves

Before this tool existed, the lead validation pipeline ran entirely inside n8n:

```
Apify export → n8n transforms → Gemini ICP scoring → Email score → Clearout
```

It worked. But every time the pipeline needed a parameter change — a new vertical definition, a different scoring threshold, a different set of source columns — someone had to open n8n, edit a JSON node, and pray nothing broke upstream. The pipeline was opaque. There was no way to inspect why a specific lead scored the way it did, no way to bulk-edit misclassified records, and no way for a team member to run a one-off import without understanding the entire workflow.

This tool takes that same pipeline and puts a UI on it. Same logic, same verticals, same scoring thresholds — but now every step is visible, editable, and auditable.

---

## The Pipeline

```
CSV Upload ──► Column Mapping ──► Spreadsheet ──► Gemini ICP ──► Email Score ──► Clearout ──► Airtable Queue
                                              │
                                              ▼
                                        Filter, sort, edit, export
```

### Stage 1: Ingest

Drag-and-drop a CSV. The hand-rolled parser handles quoted fields, commas inside quotes, escaped quotes, multi-line fields, and both `\r\n` and `\n` line endings — no PapaParse dependency.

A 3-step wizard walks through: preview the data → map columns to the 13-source-field schema (auto fuzzy-matched) → chunked import at 100 leads per request with an animated progress bar. Missing required fields are flagged before import begins, not after 500 rows have been written.

### Stage 2: Validate

This is where the pipeline lives. ICP scoring and email validation run against leads in the spreadsheet.

**Gemini ICP Classification** — each lead is scored for fit across five verticals:

| Vertical | What it covers |
|---|---|
| **D2C / E-commerce** | D2C brands, e-com platforms, logistics tech, retail POS, loyalty platforms |
| **Defense / Aviation** | Defense contractors, aerospace, MRO, drones, defense software, ATC tech |
| **Fintech** | Payments, neo-banks, BNPL, InsurTech, RegTech, crypto infra, fraud detection |
| **Pharma** | Drug development, biotech, CROs/CDMOs, medical devices, pharma AI |
| **Semiconductor / Data Center** | GCCs, fabless design, foundries, EDA, hyperscalers, OSAT |

Recruitment and staffing firms are always excluded — regardless of industry served. Gemini returns `vertical_match` (true/false), `matched_vertical`, `reasoning` (a written explanation of what triggered the verdict), and an `ai_summary`.

**Deterministic Email Scoring** — a point-based system, not an LLM:

| Check | Points |
|---|---|
| Email structure valid (username@domain.tld) | +20 |
| First name found in local part | +15 |
| Last name found in local part | +15 |
| Domain matches company domain | +25 |
| Pattern quality (first.last, f.last, firstl) | +10 |
| Generic prefix (info@, admin@, hello@) | **-20** |
| **Threshold for VALID** | **60** |

This is deterministic because audit matters. When a client asks "why didn't this lead get contacted," you need a real answer — not "the AI said so." A point-based system with documented rules gives you that answer.

**Clearout SMTP Verification** — the final filter. Only fires on leads that passed both ICP and email scoring, because Clearout costs money per check. Running it on every raw lead would burn credits on contacts the earlier stages would have discarded. The pipeline narrows the set at each step: raw → ICP → email score → Clearout. Each stage is cheaper than the next.

### Stage 3: Output

Validated, verified leads get flagged `Safe To Send = yes` and are ready to feed the Outbound Engine. The spreadsheet supports CSV export of any filtered view — so the operations team can slice the data, export a subset, and push it wherever the next step lives.

---

## The Spreadsheet

The centerpiece of the tool. Built on TanStack Table v8 with:

- **Grouped column headers** — Source columns and Validation columns visually separated
- **Color-coded badges** — Email Check (green/red/amber), ICP Match (Yes/No), Vertical (5 distinct colors)
- **Quick filter chips** — Valid Email, Invalid Email, ICP Match, Safe to Send, and per-vertical filters
- **Column visibility picker** — toggle any column on/off, persistence across sessions
- **Expandable row detail** — click to see company description, website, LinkedIn, location, SMTP/MX records, AI summary, and ICP reasoning
- **Bulk select** — checkbox column with select-all, bulk delete with confirmation dialog
- **Inline edit** — double-click any cell on name, company, or position columns; PUT to API on save
- **CSV export** — export the currently visible/filtered set, not the entire table
- **Client-side search** — instant filtering across all visible columns
- **Server-side pagination** — large datasets don't block the UI

---

## Dashboard & Analytics

The homepage gives a bird's-eye view across all projects:

- **4 stat cards** — Total Projects, Total Leads, Validated (email check != Unknown), ICP Match Rate (percentage of scored leads that matched at least one vertical)
- **Donut chart** — ICP match rate with colored segments (matched vs. unmatched)
- **Bar chart** — leads per vertical, 5 colored bars
- **Recent projects** — card list with lead counts and created dates
- **Amber banner** — shown when Supabase isn't configured, links directly to Integrations

Charts are pure SVG — no chart library dependency, no bundle bloat.

---

## Architecture

### Why No Supabase at Build Time

`SupabaseProvider` wraps the app but only initializes the client inside a `useEffect`. This means Vercel builds succeed even without environment variables set. The alternative — initializing in a Server Component — would fail the build if credentials were missing, making first deploy a chicken-and-egg problem. Current approach: build first, configure later.

### Graceful Degradation Everywhere

Every consumer of a Supabase client checks for `null` before making a call. If credentials are missing, the UI shows "not configured" instead of crashing. This also means credentials can be pasted in the UI (`/integrations`) without touching Vercel environment variables — useful when someone without deploy access needs to run the pipeline.

### Credential Resolution

| Client | Primary Source | Fallback |
|---|---|---|
| Browser | `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` env vars | localStorage |
| Server | Same env vars | httpOnly cookies |
| Admin | `SUPABASE_SERVICE_ROLE_KEY` env var | httpOnly cookies |
| Gemini/Clearout | — | localStorage + httpOnly cookies |

Credentials survive deploys because they're stored in the browser, not just in Vercel. A team member can paste their keys once and they persist across redeploys.

---

## Database Schema

Three tables — deliberately minimal:

### `projects`

| Column | Type |
|---|---|
| id | UUID |
| name | TEXT |
| description | TEXT |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |

### `leads`

**Source columns** (populated on import): 13 fields — `full_name`, `company_name`, `position`, `email`, `industry`, `state`, `domain`, `employee_size`, `country`, `company_description`, `company_linkedin`, `linkedin_url`, `website`

**Gemini validation columns:** `email_check` (Valid/Invalid/Unknown), `ai_summary`, `vertical_match` (boolean), `matched_vertical` (one of five), `reasoning`, `email_score` (0–100)

**Clearout validation columns:** `status`, `safe_to_send` (boolean), `smtp_provider`, `mx_record`, `account`, `clearout_domain`, `ai_response`

### `integration_settings`

| Column | Type |
|---|---|
| provider | TEXT (unique — "gemini", "clearout") |
| api_key | TEXT |

---

## API Routes

| Route | Methods | Description |
|---|---|---|
| `/api/projects` | GET, POST | List all, create new |
| `/api/projects/[projectId]` | GET, PUT, DELETE | Single project CRUD |
| `/api/projects/[projectId]/leads` | GET, POST | Paginated list (server-side), bulk create (accepts array) |
| `/api/projects/[projectId]/leads/[leadId]` | GET, PUT, DELETE | Single lead CRUD |
| `/api/integrations` | POST, DELETE | Save/clear credentials to cookies |

All routes return `503` with "Supabase is not configured" when credentials are missing — no crash, no mystery.

---

## What's Not Built Yet

This tool is operational for lead ingest, spreadsheet management, and export. The validation pipeline (Gemini ICP + email scoring + Clearout) is designed and the database columns exist, but the API calls aren't wired:

- **Gemini API integration** — ICP vertical classification pipeline
- **Clearout API integration** — email deliverability verification
- **Authentication** — RLS is currently allow-all (designed for a single trusted operations team)
- **Scheduled validation runs** — batch processing and queue management

These are the gaps between "working lead management tool" and "full automated pipeline."

---

## Stack

- **Next.js 16** — App Router, Server Components for data fetching
- **TypeScript** — full type coverage, shared types between API and UI
- **Tailwind CSS 3** — Tailwind 4 WASM crashes on Android/ARM64; v3 stays stable everywhere
- **Supabase** — PostgreSQL with generated API routes, admin client for server-side writes
- **TanStack Table v8** — headless table with server-side pagination, column visibility, row expansion
- **shadcn/ui** — accessible components (Button, Card, Badge, Dialog, Select, Input, Label, Tabs)
- **SVG charts** — hand-rolled donut and bar charts, zero dependencies

---

## Getting Started

```bash
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# Run the initial migration in Supabase SQL Editor:
# Copy supabase/migrations/00001_initial_schema.sql

npm install
npm run dev  # → http://localhost:3000
```

If you skip env vars, the tool still loads — paste credentials in `/integrations` after first boot.

---

## Reference

Built from the n8n workflow:
`systems/signal-to-pipeline/lead-sourcing-icp-validation.json`

Same logic. Same verticals. Same thresholds. Now with a UI.
