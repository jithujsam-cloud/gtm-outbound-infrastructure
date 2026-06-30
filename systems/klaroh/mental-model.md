# Klaroh — Mental Model

> Onboarding document for a senior engineer. Explains the application architecture, domain model, and technical decisions.

---

## 1. What Problem It Solves

Lead generation agencies run email outreach campaigns for their clients. Traditionally, agencies send static PDF reports. Clients have no real-time visibility into campaign performance.

Klaroh replaces manual reporting with branded, live dashboards. Each client gets a public URL (`/c/[slug]`) showing campaign metrics in real time. Agencies post structured formal updates (remarks), and the system sends email notifications. This eliminates the "what's happening?" back-and-forth.

---

## 2. Users

| Role | Description |
|---|---|
| **Agency** | The builder. Signs up, creates clients, configures data sources (Smartlead or demo), posts remarks, manages settings. Paying customer. |
| **Client** | The viewer. Receives a shareable link. No login. Sees their branded dashboard with metrics and remarks. Can post replies. |

---

## 3. User Journeys

### Agency Journey

1. Arrive at `/` → redirect to `/auth/signup` or `/auth/login`
2. Sign up (agency name, email, password, accepts terms) → Supabase auth account created, `agency_details` row upserted, onboarding email sent → redirect to `/dashboard`
3. `/dashboard` — "Command Center" with top stat bar (avg reply rate, total leads, active clients, emails sent), leaderboard of top 5 clients by conversion efficiency, and a grid of client campaign cards with per-campaign dropdown filtering
4. Create a client (modal): name, slug (auto-generated), optional email → client invite email sent
5. `/clients` — grid/list view with search, status filter (All/Live/Paused), edit, delete, toggle active/paused
6. `/clients/[slug]` — individual client dashboard: 4 stat cards (Leads Generated, Emails Sent, Open Rate, Reply Rate), cumulative lead area chart, campaign dropdown selector, editable Email Infrastructure Signals (sending capacity, active inboxes, domain health), and Project Status (latest remark with quick-post)
7. Create a campaign (modal): name → choose Smartlead or Demo Data → campaign created with metrics
8. `/remarks` → `/remarks/[slug]` — tabbed timeline (General + per-campaign tabs), composer to post remarks
9. Settings modal (General, Integrations, Account, Billing)
10. Header bar client actions: toggle live/paused, share public URL, preview as client

### Client Journey

1. Receive email with link `https://klaroh.app/c/[slug]`
2. Branded dashboard opens — agency logo/name, client name
3. Dashboard tab: 4 metric cards, cumulative lead chart, email infra signals (read-only), preview banner if agency is previewing
4. Inbox tab: placeholder ("coming soon")
5. Remarks tab: tabbed timeline per campaign, can post replies (author_type = "client")

---

## 4. Domain Entities

| Entity | Description |
|---|---|
| **Agency** | One per authenticated user. Fields: agency_name, agency_logo_url, timezone, agency_website, plan, created_at |
| **Client** | Managed by an agency. Fields: name, slug (unique), status (active/paused/ended), client_email (optional), sending_capacity, active_inboxes, domain_health_score, domain_health_status |
| **Campaign** | Belongs to a client + integration. Fields: name, emails_sent, open_rate, reply_rate, positive_reply_rate, leads_generated (computed), week_1-4_leads, last_synced, tool, source |
| **Integration** | One active at a time per agency. Tool: "smartlead" or "demo". Fields: tool, label, api_key_encrypted, enabled |
| **Remark** | Append-only. Belongs to a client, optionally scoped to a campaign. Fields: author_type (agency/client), category (7 predefined), title, body, attachment_url, attachment_name |
| **Email Log** | Audit trail for all outbound Resend emails. Fields: to_email, email_type, resend_id, status (sent/failed), error_message, body_html |

---

## 5. Database Relationships

```
auth.users 1──1 agency_details (user_id)
agency_details 1──N clients (agency_id)
agency_details 1──N integrations (agency_id)   [one enabled at a time]
clients 1──N campaigns (client_id, agency_id)
integrations 1──N campaigns (integration_id)   [nullable, set null on delete]
clients 1──N remarks (client_id, agency_id)    [agency_id set by DB trigger]
campaigns 1──N remarks (campaign_id)           [nullable — null means "General" remark]
```

`leads_generated` on campaigns is a **GENERATED column** (`week_1 + week_2 + week_3 + week_4`).

---

## 6. Authentication Flow

**Stack:** Supabase Auth (email + password), `@supabase/ssr` for cookie-based sessions.

Three Supabase client factories:

| Client | Context | Auth |
|---|---|---|
| `createServerClient()` | Server Components | Cookie-based session |
| `createBrowserClient()` | Client Components | Browser-based session |
| `createAdminClient()` | API Routes (server-only) | `service_role` key (bypasses RLS) |

**Signup:** Create auth user → upsert `agency_details` → fire-and-forget onboarding email via `/api/send-onboarding-email` → redirect to `/dashboard`.

**Login:** `signInWithPassword` → redirect to `/dashboard`.

**Password reset:** `resetPasswordForEmail` → redirect to `/auth/reset-password-confirm`.

**Logout:** `signOut()` → redirect to `/auth/login`.

**Middleware:** `proxy.ts` contains auth redirect logic but is dead code — no `middleware.ts` activates it. Each page has its own server-side auth check instead.

---

## 7. Authorization Model

**Row-Level Security (RLS)** on all tables in Supabase:
- Policies scope access to the caller's own agency's data
- `owner_all_*` policies use `auth.uid()` matched through `agency_details.user_id`

**Public client dashboard (`/c/[slug]`):** Uses **SECURITY DEFINER RPCs** instead of blanket public-read RLS policies. The anon key ships in the browser — broad RLS policies would expose all agency data. All public reads go through scoped functions:
- `get_public_campaign_data()`
- `get_public_client_by_slug()`
- `get_public_remarks()`
- `get_public_campaigns()`

**API route authorization:** Uses `resolveAgencyId()` + validates ownership before mutations. Plan enforcement uses the admin client (service_role) to count clients, preventing client-side bypass.

---

## 8. External Services

| Service | Purpose | Status |
|---|---|---|
| **Supabase** | Auth, PostgreSQL, Storage, RPC | Core |
| **Resend** | Email delivery (onboarding, invite, remark notifications) | Active |
| **Smartlead** | External API for cold email campaign data | Placeholder stub |
| **OpenAI** | `gpt-4o-mini` for AI summaries | **Broken** — `summaries` table missing |
| **Recharts** | Area charts for lead metrics | Active |
| **Framer Motion** | Animation (transitions, spring, count-up) | Active |

---

## 9. State Management

No global state library. Strategy:

- **Server state:** Next.js Server Components fetch → pass as props to client components
- **Client state:** `useState`/`useEffect` per component
- **Sidebar state:** React Context (`SidebarContext`) + `localStorage` + cookie for collapse persistence
- **Header actions:** Context passes client status toggle + share callbacks from pages to the DashboardLayout header bar
- **Campaign data:** Fetched client-side via RPC calls, cached in local state, re-fetched on integration change
- **Remarks cache:** In-memory object keyed by campaign tab ID inside `RemarksView`
- **URL state:** `useSearchParams` + `useRouter` for public client portal tab navigation

---

## 10. Deployment Architecture

| Layer | Detail |
|---|---|
| **Hosting** | Vercel (Next.js App Router) |
| **Database** | Supabase (managed PostgreSQL) |
| **Auth** | Supabase Auth |
| **Storage** | Supabase Storage (remark-attachments, agency-logos) |
| **Email** | Resend |
| **Build** | `next build` → Vercel auto-deploys from `main` |
| **CI/CD** | None configured beyond Vercel auto-deploy |

**Required environment variables (6):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `OPENAI_API_KEY`
- `ENCRYPTION_KEY`

---

## 11. Security

| Measure | Detail |
|---|---|
| **API key encryption** | AES-256-GCM with random IV per record (node:crypto). Legacy crypto-js values supported on read |
| **RLS** | All tables scoped to agency |
| **SECURITY DEFINER RPCs** | Public client reads use scoped functions, not blanket RLS |
| **CSP headers** | `script-src 'self' 'unsafe-inline'`, `frame-ancestors 'none'` |
| **Security headers** | HSTS (2 years), X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy |
| **Rate limiting** | Atomic counters via Supabase RPC (`check_rate_limit`). Applied to client creation (30/hr), remark posting (120/hr agency, 10/hr public), file uploads, onboarding emails |
| **Plan enforcement** | Server-side in `/api/create-client` using admin client — not client-gated |
| **Append-only remarks** | No UPDATE/DELETE RLS policies on remarks table |
| **Input validation** | Slug format, remark length (200/10000 chars), file type/size, email format |

---

## 12. Where the Business Logic Lives

| Logic | File |
|---|---|
| Plan limits & trial expiry | `src/lib/plan-limits.ts` |
| Client creation + plan enforcement | `src/app/api/create-client/route.ts` |
| API key encrypt/decrypt | `src/lib/encryption.ts` |
| Integration CRUD | `src/lib/data/integrations.ts` |
| Campaign data routing (demo vs Smartlead) | `supabase/04_functions.sql` — `get_campaign_data()` RPC |
| Agency overview aggregation | `src/lib/data/overview.ts` |
| Remark posting + email notification | `src/app/api/remarks/route.ts` |
| Email template generation | `src/lib/email/templates/*.ts` |
| Email sending + audit logging | `src/lib/email/send-email.ts` |
| Rate limiting | `src/lib/rate-limit.ts` + `supabase/19_rate_limits.sql` |
| Slug generation/validation | `src/lib/slug-utils.ts` |

---

## 13. File Ranking by Importance

| # | File | Why |
|---|---|---|
| 1 | `supabase/02_schema.sql` | Database foundation |
| 2 | `src/lib/types.ts` | Domain model |
| 3 | `src/app/layout.tsx` | Root layout — fonts, metadata, SidebarProvider |
| 4 | `src/components/DashboardLayout.tsx` | Main app shell — sidebar, header, breadcrumbs, client actions |
| 5 | `src/components/Sidebar.tsx` | Navigation, user identity, trial banner, logout |
| 6 | `src/app/(dashboard)/dashboard/overview-layout.tsx` | Agency-wide overview |
| 7 | `src/app/(dashboard)/clients/[slug]/page.tsx` + `dashboard-layout.tsx` + `campaign-section.tsx` | Individual client dashboard |
| 8 | `src/app/c/[slug]/page.tsx` + `public-client-view.tsx` | Public client portal |
| 9 | `src/lib/data/overview.ts` | Aggregation logic |
| 10 | `src/app/api/create-client/route.ts` | Client creation with plan enforcement |
| 11 | `src/app/api/remarks/route.ts` | Remark CRUD |
| 12 | `src/components/SettingsModal.tsx` | Full settings UI |
| 13 | `src/lib/email/send-email.ts` | Email delivery with audit |
| 14 | `src/app/page.tsx` | Root redirect |

---

## 14. Architecture Diagram

```
                    ┌─────────────┐
                    │   Vercel    │
                    │  (Next.js)  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────▼───┐  ┌────▼───┐  ┌────▼───┐
         │  RSC   │  │  API   │  │ Client │
         │ Pages  │  │ Routes │  │ Comps  │
         └────┬───┘  └────┬───┘  └────┬───┘
              │            │            │
         ┌────▼────────────▼────────────▼───┐
         │        Supabase Client           │
         │  (server / browser / admin)      │
         └────────────────┬─────────────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
         ┌────▼─────┐          ┌─────▼──────┐
         │ Supabase │          │   Resend   │
         │ (PG+RLS) │          │  (Emails)  │
         └──────────┘          └────────────┘

Server Components (RSC) ──► createServerClient() ──► Supabase (RLS-scoped)
API Routes              ──► createAdminClient() ──► Supabase (service_role)
Client Components       ──► createBrowserClient() ─► Supabase (anon key)
Public /c/[slug]        ──► SECURITY DEFINER RPCs  (no blanket RLS)
```

---

## 15. Known Issues

- `proxy.ts` is dead code — no `middleware.ts` activates it
- `/api/generate-summary` is broken — missing `summaries` table
- Resend domain not yet verified — emails use `onboarding@resend.dev`
- Login page links to `/auth/forgot-password` which doesn't exist (actual route is `/auth/reset-password`)
- `isValidSlug()` is duplicated in `slug-utils.ts` and `create-client/route.ts`
- Font mismatch: `layout.tsx` loads Merriweather but design system specifies Instrument Serif
- Two migration files share number `20`
- No Stripe integration — billing upgrades are email-only
