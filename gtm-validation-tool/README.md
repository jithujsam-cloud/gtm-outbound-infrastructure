# GTM Validation Tool

Lead sourcing and ICP validation dashboard. Upload lead lists, validate emails, and score ICP fit in a spreadsheet interface.

## Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS 4** + shadcn/ui
- **Supabase** (PostgreSQL)
- **TanStack Table**

## Getting Started

### 1. Environment Variables

```bash
cp .env.local.example .env.local
```

Fill in your Supabase project URL, anon key, and service role key.

### 2. Database Setup

Run the migration in your Supabase SQL editor:

```sql
-- Copy the contents of supabase/migrations/00001_initial_schema.sql
```

Or use the Supabase CLI:

```bash
supabase db push
```

### 3. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database Schema

### `projects`

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | TEXT | Project name |
| description | TEXT | Optional description |
| created_at | TIMESTAMPTZ | Auto-generated |
| updated_at | TIMESTAMPTZ | Auto-updated |

### `leads`

**Source columns** (populated on import):

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

**Gemini validation columns** (future — ICP matching + email scoring):

| Column | Type | Values |
|---|---|---|
| email_check | TEXT | Valid, Invalid, Unknown |
| ai_summary | TEXT | |
| vertical_match | BOOLEAN | |
| matched_vertical | TEXT | D2C / E-commerce, Defense / Aviation, Fintech, Pharma, Semiconductor / Data Center |
| reasoning | TEXT | |
| email_score | INTEGER | 0-100 |

**Clearout validation columns** (future — deliverability verification):

| Column | Type |
|---|---|
| status | TEXT |
| safe_to_send | BOOLEAN |
| smtp_provider | TEXT |
| mx_record | TEXT |
| account | TEXT |
| clearout_domain | TEXT |
| ai_response | TEXT |

## API Routes

| Route | Methods |
|---|---|
| `/api/projects` | GET, POST |
| `/api/projects/[projectId]` | GET, PUT, DELETE |
| `/api/projects/[projectId]/leads` | GET, POST |
| `/api/projects/[projectId]/leads/[leadId]` | GET, PUT, DELETE |

## Deploy

```bash
npx vercel --prod
```

## Reference

Built from the n8n workflow at `gtm-outbound-infrastructure/systems/signal-to-pipeline/lead-sourcing-icp-validation.json`.
