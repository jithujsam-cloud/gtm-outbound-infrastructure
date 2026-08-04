# GTM Validation Tool — Project Summary

## What It Is

A Next.js 16 lead validation dashboard. Users import CSV lead lists, the tool scores ICP fit (5 verticals) and validates emails via Gemini + Clearout, with results displayed in a spreadsheet UI.

## Stack

Next.js 16 (App Router), TypeScript, Tailwind CSS 3, Supabase (PostgreSQL), TanStack Table v8, shadcn/ui

---

## Project Structure (52 files)

```
gtm-validation-tool/
├── next.config.ts, tsconfig.json, tailwind.config.ts, postcss.config.mjs
├── vercel.json, .gitignore, .env.local.example, README.md
├── supabase/migrations/00001_initial_schema.sql
└── src/
    ├── app/
    │   ├── layout.tsx, globals.css, page.tsx          # Dashboard
    │   ├── projects/page.tsx                          # Projects grid
    │   ├── projects/[projectId]/page.tsx              # Spreadsheet view
    │   ├── integrations/page.tsx                      # API key management
    │   └── api/
    │       ├── integrations/route.ts                  # Save/clear cookies
    │       ├── projects/route.ts                      # GET (list), POST (create)
    │       ├── projects/[projectId]/route.ts          # GET, PUT, DELETE
    │       ├── projects/[projectId]/leads/route.ts    # GET (paginated), POST (bulk)
    │       └── projects/[projectId]/leads/[leadId]/route.ts  # GET, PUT, DELETE
    ├── components/
    │   ├── ui/          # button, card, badge, dialog, input, label, select, separator, skeleton, tabs
    │   ├── layout/      # header (nav with active state)
    │   ├── providers/   # SupabaseProvider (lazy useEffect init)
    │   ├── dashboard/   # StatsCards, RecentProjects
    │   ├── projects/    # ProjectCard, CreateProjectDialog
    │   ├── spreadsheet/ # LeadsTable (main table with all features)
    │   ├── import/      # CsvUploadStep, ColumnMappingStep, ImportLeadsDialog, ProjectLeads
    │   └── charts/      # DonutChart, BarChart, DashboardCharts (SVG-based, zero deps)
    ├── lib/
    │   ├── supabase/    # client.ts (browser), server.ts (RSC), admin.ts (service role)
    │   ├── supabase/config.ts  # Unified config (localStorage + cookies)
    │   └── utils.ts     # cn() helper
    └── types/
        ├── database.ts  # Full Database type (projects, leads, integration_settings)
        └── index.ts     # App types, ICP_VERTICALS, EMAIL_CHECK_STATUSES
```

---

## Database Schema (3 tables)

| Table | Purpose |
|---|---|
| `projects` | id, name, description, timestamps |
| `leads` | 13 source columns + 6 Gemini columns + 7 Clearout columns + FK to projects |
| `integration_settings` | provider (unique), api_key — seeds gemini + clearout |

---

## Pages & Features

### Dashboard (`/`)

- 4 stat cards: Total Projects, Total Leads, Validated, ICP Match Rate
- Donut chart: ICP match rate with colored segments
- Bar chart: leads by vertical (5 colors)
- Recent projects list with lead counts
- Amber "not configured" banner when Supabase is missing, linking to Integrations

### Projects (`/projects`)

- Card grid with lead counts
- "New Project" dialog creates project and navigates to it
- Empty state with prompt to create first project

### Spreadsheet (`/projects/[projectId]`)

- TanStack Table with grouped column headers (Source / Validation)
- Color-coded badges: Email Check (green/red/amber), ICP Match (Yes/No), Vertical (5 distinct colors)
- Quick filter chips: Valid Email, Invalid Email, ICP Match, Safe to Send
- Column visibility picker
- Expandable row detail: company description, website, LinkedIn, location, SMTP/MX, AI summary, reasoning
- Bulk select with checkboxes and delete button with confirmation
- Inline edit on double-click (name, company, position) with PUT to API
- Export visible/filtered data as CSV
- Client-side search across all columns
- Server-side pagination with auto-refresh after import
- Import CSV button → 3-step dialog:

#### CSV Import Flow

1. **Upload**: drag-and-drop or browse a `.csv` file. Shows 5-row preview with detected headers.
2. **Column Mapping**: auto-matches CSV headers to lead fields (fuzzy matching). Dropdown per column with sample values. Flags missing required fields.
3. **Import**: chunked upload (100 leads per request) with animated progress bar. Cancel button. Shows "Importing 247 of 1,200 leads — 21% complete".

CSV parser handles: quoted fields, commas inside quotes, escaped quotes, multi-line fields inside quotes, `\r\n` and `\n` line endings.

### Integrations (`/integrations`)

- 3 cards: Supabase (emerald), Gemini (blue), Clearout (purple)
- Password fields for API keys
- Green "Connected" badge when saved
- "Save All" stores everything at once
- Links to Supabase, Google AI Studio, Clearout dashboards
- "Clear All" removes all stored credentials

---

## Credential Resolution

| Client | Primary | Fallback |
|---|---|---|
| Browser | `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` env vars | localStorage |
| Server | Same env vars | httpOnly cookies |
| Admin | `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | httpOnly cookies |
| Gemini/Clearout | — | localStorage + httpOnly cookies |

All clients return `null` instead of throwing when credentials are missing.

---

## Key Architectural Decisions

- **No Supabase at build time**: `SupabaseProvider` uses `useEffect` (never runs during SSR/static generation). Vercel builds succeed even without env vars.
- **Graceful degradation**: every consumer checks for null client → shows "not configured" UI.
- **Credentials survive deploys**: stored in localStorage + cookies, not just Vercel env vars. Users can paste keys in the UI without touching Vercel settings.
- **CSV parser is hand-rolled**: quote-aware character scanner. No PapaParse dependency.
- **Charts are SVG-based**: no chart library. Pure SVG donut + horizontal bar charts.
- **Tailwind 3** (not 4): Tailwind 4 WASM parser crashes on Android/ARM64. Vercel uses native x86 bindings. Upgradable later.

---

## ICS Vertical Definitions

| Vertical | Examples |
|---|---|
| **D2C / E-commerce** | D2C brands, e-com platforms, logistics tech, retail POS, loyalty platforms |
| **Defense / Aviation** | Defense contractors, aerospace, MRO, drones, defense software, ATC tech |
| **Fintech** | Payments, neo-banks, BNPL, InsurTech, RegTech, crypto infra, fraud detection |
| **Pharma** | Drug development, biotech, CROs/CDMOs, medical devices, pharma AI |
| **Semiconductor / Data Center** | GCCs, fabless design, foundries, EDA, hyperscalers, OSAT |

Recruitment/staffing firms are **always excluded** regardless of industry served.

## Lead Columns

### Source (imported from CSV)

| Column | Type |
|---|---|
| full_name | TEXT |
| company_name | TEXT |
| position | TEXT |
| email | TEXT |
| industry | TEXT |
| state | TEXT |
| domain | TEXT |
| employee_size | INTEGER |
| country | TEXT |
| company_description | TEXT |
| company_linkedin | TEXT |
| linkedin_url | TEXT |
| website | TEXT |

### Gemini Validation

| Column | Type | Values |
|---|---|---|
| email_check | TEXT | Valid, Invalid, Unknown |
| ai_summary | TEXT | — |
| vertical_match | BOOLEAN | — |
| matched_vertical | TEXT | D2C / E-commerce, Defense / Aviation, Fintech, Pharma, Semiconductor / Data Center |
| reasoning | TEXT | — |
| email_score | INTEGER | 0–100 |

### Clearout Validation

| Column | Type |
|---|---|
| status | TEXT |
| safe_to_send | BOOLEAN |
| smtp_provider | TEXT |
| mx_record | TEXT |
| account | TEXT |
| clearout_domain | TEXT |
| ai_response | TEXT |

---

## API Routes

| Route | Methods | Description |
|---|---|---|
| `/api/projects` | GET, POST | List all, create new |
| `/api/projects/[projectId]` | GET, PUT, DELETE | Single project CRUD |
| `/api/projects/[projectId]/leads` | GET, POST | Paginated list, bulk create (accepts array) |
| `/api/projects/[projectId]/leads/[leadId]` | GET, PUT, DELETE | Single lead CRUD |
| `/api/integrations` | POST, DELETE | Save/clear credentials to cookies |

All API routes return `503` with "Supabase is not configured" when credentials are missing.

---

## What's NOT Implemented Yet

- **Gemini API call**: ICP vertical classification + email scoring pipeline
- **Clearout API call**: email deliverability verification
- **Authentication**: no login (RLS set to allow-all)
- **Pipeline workflow**: scheduled validation runs, queue processing, batch result writing

---

## Vercel Deployment

Deploys from the `gtm-validation-tool/` subdirectory of this repo. Root directory must be set to `gtm-validation-tool` in Vercel project settings.

### Required Environment Variables (optional — can use UI instead)

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

If env vars are not set, users can paste credentials directly in the `/integrations` page.

---

## Local Development

```bash
cd gtm-validation-tool
npm install
cp .env.local.example .env.local   # fill in Supabase credentials
npm run dev                         # starts on localhost:3000
```

On Android/ARM64, add `-- --webpack` to the build command and the `typescript.ignoreBuildErrors` config is needed (SWC WASM can't type-check on ARM64).

---

## Reference

Built from the n8n workflow:
`systems/signal-to-pipeline/lead-sourcing-icp-validation.json`
