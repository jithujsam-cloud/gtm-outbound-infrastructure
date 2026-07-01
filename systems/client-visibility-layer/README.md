# Client Visibility Layer 👁️

## 🚧 The problem

When I ran my outbound agency, every client wanted to "see what's happening." The default solution was handing over login credentials — Instantly logins, Smartlead logins, Gmail access — so they could check campaign status themselves.

This is a genuine liability. Tool logins give clients access to everything: other campaigns, other clients' data, API keys, sending infrastructure. One client with a curious afternoon and you have a data leak. Even the trustworthy ones — sharing credentials is bad practice and it erodes the professional boundary. You shouldn't need to hand over keys to your tools just so a client can check their lead count.

The alternative (sending static PDF reports) isn't better. It creates a constant "can you send me this week's update?" back-and-forth that burns hours across every client relationship.

## ⚙️ What this system does

A read-only client portal that replaces credential sharing. Each client gets a unique URL (`/c/[slug]`) that shows their campaign metrics in real time — no login, no tool access, no way to see anything outside their own data.

The agency side is deliberately minimal: a client dashboard to review campaign status internally, and a portal settings page to toggle visibility and copy share links.

**🔒 The security model:**
- All database reads go through the service-role admin client server-side. There is no browser-accessible Supabase client.
- The public portal (`/c/[slug]`) reads through Postgres SECURITY DEFINER functions scoped to a single client slug — `get_public_client_by_slug()` and `get_public_campaign_data()` return exactly one row per call.
- There is no Supabase Auth, no RLS, no anon key in the browser. No login page. No session management.
- The `status` column on clients acts as a kill switch. Set it to `paused` and the portal returns a "Dashboard Inactive" page.

**📊 What the client sees:**
- 4 stat cards: Leads Generated, Emails Sent, Open Rate, Reply Rate
- A cumulative lead chart (week-by-week Recharts area chart)
- Agency branding (name + logo)

**📋 What the agency sees:**
- Client grid on `/agency/dashboard`
- Per-client detail page with the same stats + chart
- Portal Settings page: toggle live/offline per client, copy share links

## 💡 Why it is built this way

**No auth.** This system has exactly one agency user (you). There's no multi-tenant SaaS, no client accounts, no permissions model. Adding a login page would be theatre — nothing to authenticate against. The admin client hits the database directly with the service-role key, which is only usable from the Next.js server. The public portal doesn't need auth because it's read-only and scoped by slug.

**No remarks/updates feed.** The original Klaroh product had a full remarks system — categories, timelines, file attachments, email notifications. I cut it from this system. The remarks feed was the product at Klaroh; here the product is "client sees dashboard without needing a login." That's a smaller, sharper story.

**No tool integrations (Smartlead, etc.).** The whole point of this system is that clients don't need tool access. Integrating Smartlead would connect the agency's tool to the dashboard, which is the opposite problem. Campaign data is seeded via a demo function; in production it comes from a sync layer outside this system.

**Client status as a kill switch.** No sessions, no tokens, no invite flows — just a column. Set it to `paused` and the portal stops resolving.

## 🛠️ Stack

Next.js 16 (App Router) + Supabase (Postgres) + Tailwind v4 + Recharts + Lucide

## Schema (3 tables)

| Table | Purpose |
|---|---|
| `agency_details` | One row — agency branding |
| `clients` | Clients with `status` (active/paused/ended) and `slug` (unique URL) |
| `campaigns` | Campaign metrics: emails sent, open/reply rates, weekly leads |

## Public RPCs (3)

| Function | Purpose |
|---|---|
| `get_public_client_by_slug(p_slug)` | Returns single client + agency branding by URL slug |
| `get_public_campaign_data(p_client_id)` | Returns latest campaign data for the portal dashboard |
| `get_public_campaigns(p_client_id)` | Returns campaign id + name list |

All are SECURITY DEFINER — scope results to a single `client_id`.

## 🚀 Setup

1. Create a Supabase project at supabase.com
2. Run `supabase/01_schema.sql` in the SQL Editor
3. Seed demo data: `SELECT seed_demo_data();`
4. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
5. `npm install && npm run dev`

No auth user to create, no login page. Open `http://localhost:3000/agency/dashboard` directly.

## 📁 Files

```
src/
├── app/
│   ├── layout.tsx                         # Root layout (Inter font)
│   ├── page.tsx                           # Redirects to /agency/dashboard
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
    ├── supabase/admin.ts                  # Service-role client (only client)
    └── data/                              # clients.ts, campaigns.ts
```
