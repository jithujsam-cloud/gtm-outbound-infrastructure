-- ═══════════════════════════════════════════════════════════════════
-- 01_schema.sql
-- Client Visibility Layer — full schema in one migration.
--
-- 3 tables: agency_details (auth pivot), clients, campaigns
-- 3 public RPCs for the client portal (SECURITY DEFINER)
-- 1 seed function for demo data
-- ═══════════════════════════════════════════════════════════════════


-- ── 0. Updated-at trigger (shared) ──────────────────────────────────────────

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ── 1. agency_details ───────────────────────────────────────────────────────

create table agency_details (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null unique references auth.users(id) on delete cascade,
  agency_name      text,
  agency_logo_url  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table agency_details enable row level security;

create policy "owner_all_agency_details" on agency_details
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger update_agency_details_updated_at
  before update on agency_details
  for each row execute function update_updated_at();


-- ── 2. clients ──────────────────────────────────────────────────────────────

create table clients (
  id          uuid        primary key default gen_random_uuid(),
  agency_id   uuid        not null references agency_details(id) on delete cascade,
  name        text        not null,
  slug        text        not null unique,
  status      text        not null default 'active'
                check (status in ('active', 'paused', 'ended')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_clients_agency_id on clients(agency_id);
create index idx_clients_slug      on clients(slug);

alter table clients enable row level security;

create policy "owner_all_clients" on clients
  for all
  using     (agency_id in (select id from agency_details where user_id = auth.uid()))
  with check(agency_id in (select id from agency_details where user_id = auth.uid()));

create trigger update_clients_updated_at
  before update on clients
  for each row execute function update_updated_at();


-- ── 3. campaigns ────────────────────────────────────────────────────────────

create table campaigns (
  id                 uuid        primary key default gen_random_uuid(),
  client_id          uuid        not null references clients(id) on delete cascade,
  agency_id          uuid        not null references agency_details(id) on delete cascade,
  name               text        not null,
  emails_sent        integer     default 0,
  open_rate          numeric(5,2) default 0,
  reply_rate         numeric(5,2) default 0,
  positive_reply_rate numeric(5,2) default 0,
  leads_generated    integer     generated always as (week_1_leads + week_2_leads + week_3_leads + week_4_leads) stored,
  week_1_leads       integer     default 0,
  week_2_leads       integer     default 0,
  week_3_leads       integer     default 0,
  week_4_leads       integer     default 0,
  tool               text        check (tool in ('smartlead', 'demo')),
  last_synced        timestamptz default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_campaigns_client_id  on campaigns(client_id);
create index idx_campaigns_agency_id  on campaigns(agency_id);

alter table campaigns enable row level security;

create policy "owner_all_campaigns" on campaigns
  for all
  using     (agency_id in (select id from agency_details where user_id = auth.uid()))
  with check(agency_id in (select id from agency_details where user_id = auth.uid()));

create trigger update_campaigns_updated_at
  before update on campaigns
  for each row execute function update_updated_at();


-- ── 4. Public RPCs (SECURITY DEFINER — no blanket public RLS) ───────────────

-- Returns a single client by slug for the portal. Scoped to one row.
create or replace function get_public_client_by_slug(p_slug text)
returns table (
  id uuid, name text, slug text, status text, created_at timestamptz,
  agency_name text, agency_logo_url text
)
security definer set search_path = public
language sql stable as $$
  select c.id, c.name, c.slug, c.status, c.created_at,
         ad.agency_name, ad.agency_logo_url
  from clients c
  join agency_details ad on ad.id = c.agency_id
  where c.slug = p_slug
  limit 1;
$$;

grant execute on function get_public_client_by_slug(text) to anon, authenticated;


-- Returns the latest campaign + agency branding for the public dashboard.
create or replace function get_public_campaign_data(p_client_id uuid)
returns table (
  campaign_name        text,
  emails_sent          integer,
  open_rate            numeric,
  reply_rate           numeric,
  positive_reply_rate  numeric,
  leads_generated      integer,
  week_1_leads         integer,
  week_2_leads         integer,
  week_3_leads         integer,
  week_4_leads         integer,
  last_synced          timestamptz,
  agency_name          text,
  agency_logo_url      text
)
security definer set search_path = public
language plpgsql as $$
declare
  v_agency_id       uuid;
  v_agency_name     text;
  v_agency_logo_url text;
begin
  select c.agency_id, ad.agency_name, ad.agency_logo_url
  into v_agency_id, v_agency_name, v_agency_logo_url
  from clients c
  join agency_details ad on ad.id = c.agency_id
  where c.id = p_client_id;

  if v_agency_id is null then return; end if;

  return query
    select c.name, c.emails_sent, c.open_rate, c.reply_rate,
           c.positive_reply_rate, c.leads_generated,
           c.week_1_leads, c.week_2_leads, c.week_3_leads, c.week_4_leads,
           c.last_synced, v_agency_name, v_agency_logo_url
    from campaigns c
    where c.client_id = p_client_id
    order by c.created_at desc
    limit 1;

  if not found then
    return query select null::text, null::integer, null::numeric, null::numeric,
                        null::numeric, null::integer, null::integer, null::integer,
                        null::integer, null::integer, null::timestamptz,
                        v_agency_name, v_agency_logo_url;
  end if;
end;
$$;

grant execute on function get_public_campaign_data(uuid) to anon, authenticated;


-- Returns campaign id + name list for the public client portal.
create or replace function get_public_campaigns(p_client_id uuid)
returns table (id uuid, name text)
security definer set search_path = public
language sql stable as $$
  select id, name
  from campaigns
  where client_id = p_client_id
  order by created_at desc;
$$;

grant execute on function get_public_campaigns(uuid) to anon, authenticated;


-- ── 5. Seed demo data ───────────────────────────────────────────────────────
-- Call after creating the agency user in Supabase Auth:
--   SELECT seed_demo_data('the-user-uuid', 'My Agency');

create or replace function seed_demo_data(p_user_id uuid, p_agency_name text default 'Demo Agency')
returns void
language plpgsql as $$
declare
  v_agency_id uuid;
  v_client1_id uuid;
  v_client2_id uuid;
begin
  -- Create agency_details row
  insert into agency_details (user_id, agency_name)
  values (p_user_id, p_agency_name)
  returning id into v_agency_id;

  -- Create Client 1
  insert into clients (agency_id, name, slug, status)
  values (v_agency_id, 'Acme Corp', 'acme-corp', 'active')
  returning id into v_client1_id;

  insert into campaigns (client_id, agency_id, name, tool,
    emails_sent, open_rate, reply_rate, positive_reply_rate,
    week_1_leads, week_2_leads, week_3_leads, week_4_leads)
  values (v_client1_id, v_agency_id, 'Q2 Enterprise Outreach', 'demo',
    3240, 52.00, 8.40, 3.10, 8, 11, 14, 14);

  -- Create Client 2
  insert into clients (agency_id, name, slug, status)
  values (v_agency_id, 'NexGen Solutions', 'nexgen-solutions', 'active')
  returning id into v_client2_id;

  insert into campaigns (client_id, agency_id, name, tool,
    emails_sent, open_rate, reply_rate, positive_reply_rate,
    week_1_leads, week_2_leads, week_3_leads, week_4_leads)
  values (v_client2_id, v_agency_id, 'SMB Growth Campaign', 'demo',
    2150, 47.30, 6.80, 2.50, 4, 6, 8, 9);
end;
$$;
