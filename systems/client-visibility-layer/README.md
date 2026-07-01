# Client Visibility Layer 👁️

## 🚧 The problem

When I ran my outbound agency, every client wanted to "see what's happening." The default solution was handing over login credentials — Instantly logins, Smartlead logins, Gmail access — so they could check campaign status themselves.

This is a genuine liability. Tool logins give clients access to everything: other campaigns, other clients' data, API keys, sending infrastructure. One client with a curious afternoon and you have a data leak. Even the trustworthy ones — sharing credentials is bad practice and it erodes the professional boundary. You shouldn't need to hand over keys to your tools just so a client can check their lead count.

The alternative (sending static PDF reports) isn't better. It creates a constant "can you send me this week's update?" back-and-forth that burns hours across every client relationship.

## ⚙️ What this system does

A read-only client portal that replaces credential sharing. Each client gets a unique URL (`/c/[slug]`) that shows their campaign metrics in real time — no login, no tool access, no way to see anything outside their own data.

The agency side is deliberately minimal: a client dashboard to review campaign status internally, and a portal settings page to toggle visibility and copy share links.

**🔒 The security model:**
- Public reads go through Postgres SECURITY DEFINER functions scoped to a single client slug, not blanket RLS policies. The anon key ships in the browser, but `get_public_client_by_slug()` and `get_public_campaign_data()` return exactly one row per call — there is no way to walk the table.
- Agency data is protected by RLS: every table carries `agency_id`, and every policy checks `agency_id IN (SELECT id FROM agency_details WHERE user_id = auth.uid())`.
- The `status` column on clients acts as a kill switch. Set it to `paused` and the portal returns a "Dashboard Inactive" page — the client's URL stops resolving immediately. No auth, no session management, just a column flip.

**📊 What the client sees:**
- 4 stat cards: Leads Generated, Emails Sent, Open Rate, Reply Rate
- A cumulative lead chart (week-by-week Recharts area chart)
- Agency branding (name + logo) pulled from `agency_details`

**📋 What the agency sees:**
- Client grid on `/agency/dashboard`
- Per-client detail page with the same stats + chart
- Portal Settings page: toggle live/offline per client, copy share links

## 💡 Why it is built this way

**No remarks/updates feed.** The original Klaroh product had a full remarks system — categories, timelines, file attachments, email notifications. I cut it from this system. The remarks feed was the product at Klaroh; here the product is "client sees dashboard without needing a login." That's a smaller, sharper story and the architecture is cleaner without the append-only feed complexity.

**No signup flow.** The agency account is created via Supabase Auth dashboard — no signup page, no onboarding emails, no plan enforcement. This is an infrastructure component, not a SaaS. The login page exists only so the agency can access their dashboard after the account is created.

**No tool integrations (Smartlead, etc.).** The whole point of this system is that clients don't need tool access. Integrating Smartlead would connect the agency's tool to the dashboard, which is the opposite problem. Campaign data is seeded via a demo function; in production it would come from a sync layer outside this system.

**Client status as a kill switch.** No sessions, no tokens, no invite flows — just a column. Set it to `paused` and the portal stops resolving. This is the simplest possible revocation mechanism and it works because the portal is entirely read-only.

## 🛠️ Stack

Next.js 16 (App Router) + Supabase (Auth + Postgres + RLS) + Tailwind v4 + Recharts + Lucide

## Schema (3 tables)

| Table | Purpose |
|---|---|
| `agency_details` | One row per agency — the ownership pivot for RLS |
| `clients` | Clients with `status` (active/paused/ended) and `slug` (unique URL identifier) |
| `campaigns` | Campaign metrics: emails sent, open/reply rates, weekly leads |

**Leads generated** on campaigns is a GENERATED column (`week_1 + week_2 + week_3 + week_4`).

## Public RPCs (3)

| Function | Purpose |
|---|---|
| `get_public_client_by_slug(p_slug)` | Returns single client + agency branding by URL slug |
| `get_public_campaign_data(p_client_id)` | Returns latest campaign data for the portal dashboard |
| `get_public_campaigns(p_client_id)` | Returns campaign id + name list |

All are SECURITY DEFINER — they run as the owner and bypass RLS, but scope results to a single `client_id`. This is how the public portal works without exposing the full table.

## 🚀 Setup

1. Create a Supabase project at supabase.com
2. Create a user in Supabase Auth dashboard (Email/Password)
3. Run `supabase/01_schema.sql` in the SQL Editor — this creates all tables, RLS, RPCs, and the `seed_demo_data()` function
4. Seed demo data: `SELECT seed_demo_data('your-auth-user-uuid', 'My Agency');`
5. Copy `.env.example` to `.env.local` and fill in your Supabase URL + keys
6. `npm install && npm run dev`

The login page works with the user you created in step 2. The seed function creates 2 clients with 1 campaign each so you see a working dashboard immediately.

## 📁 Files

```
src/
├── app/
│   ├── layout.tsx                         # Root layout (Inter font)
│   ├── page.tsx                           # Redirect to /agency/dashboard or /auth/login
│   ├── auth/login/page.tsx                # Login page
│   ├── agency/
│   │   ├── layout.tsx                     # Agency sidebar wrapper
│   │   ├── dashboard/page.tsx             # Client grid
│   │   ├── clients/[slug]/page.tsx        # Per-client detail (stats + chart)
│   │   └── portal-settings/page.tsx       # Status toggle + share link
│   ├── c/[slug]/
│   │   ├── page.tsx                       # Public portal SSR
│   │   ├── client-view.tsx                # Public portal UI
│   │   └── not-found.tsx                  # 404 for bad slugs
│   └── api/update-client-status/route.ts  # Status toggle endpoint
├── components/
│   ├── AgencySidebar.tsx                  # Agency navigation
│   └── ClientDashboard.tsx                # Shared stats + chart component
└── lib/
    ├── types.ts                           # Client, CampaignData, FullCampaign
    ├── relative-time.ts                   # Time formatting utils
    ├── supabase/                          # client.ts, server.ts, admin.ts
    └── data/                              # clients.ts, campaigns.ts
```
