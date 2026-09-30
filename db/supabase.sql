-- ScanInbox — lead database on Supabase (Postgres).
--
-- The published page (Netlify) sends every submission straight to the
-- Supabase function submit_lead(), with no server of our own. This file is
-- db/schema.sql plus the validate()/saveLead() logic from server.js in one
-- place:
--
--   POST https://<project>.supabase.co/rest/v1/rpc/submit_lead
--   apikey: <publishable key>
--   { "email": "...", "consent": true, "segment": "small", ... }
--
-- Security: every table has RLS with no policies, and the anon/authenticated
-- roles have no privileges on tables or views. The only thing a browser may
-- do is call submit_lead(). Leads can be read only in the Supabase dashboard.
--
-- Abuse limits live in submit_lead() (see "Rate limits" below). They use no
-- IP address: the page promises to store nothing but the e-mail and the
-- answers, so limits are per e-mail and global instead.
--
-- Idempotent: safe to run again in the SQL Editor after any change.
--
-- Deliberately NOT here, as in db/schema.sql: IP addresses and user agents.

-- ---------------------------------------------------------------------------
-- Lookup tables
-- ---------------------------------------------------------------------------
create table if not exists public.segments (
  code     text primary key,
  label_lv text    not null,
  label_en text    not null,
  sort     integer not null
);

create table if not exists public.device_bands (
  code     text primary key,
  label_lv text    not null,
  label_en text    not null,
  sort     integer not null
);

create table if not exists public.price_bands (
  code         text primary key,
  label_lv     text    not null,
  label_en     text    not null,
  eur_midpoint real,
  sort         integer not null
);

create table if not exists public.brands (
  code     text primary key,
  label_lv text    not null,
  label_en text    not null,
  sort     integer not null
);

insert into public.segments (code, label_lv, label_en, sort) values
  ('private', 'Es pats, mājās',                    'Myself, at home',                     1),
  ('small',   'Mazs uzņēmums, līdz 10 cilvēkiem',  'Small business, up to 10 people',     2),
  ('medium',  'Uzņēmums, 10 līdz 100 cilvēku',     'Company, 10 to 100 people',           3),
  ('large',   'Liels uzņēmums vai valsts iestāde', 'Large company or public institution', 4)
on conflict (code) do nothing;

insert into public.device_bands (code, label_lv, label_en, sort) values
  ('1',    '1',    '1',    1),
  ('2-5',  '2–5',  '2–5',  2),
  ('6-20', '6–20', '6–20', 3),
  ('20+',  '20+',  '20+',  4)
on conflict (code) do nothing;

insert into public.price_bands (code, label_lv, label_en, eur_midpoint, sort) values
  ('lt2',    'Zem 2 €',            'Under €2',       1.0,  1),
  ('2-5',    '2–5 €',              '2–5 €',          3.5,  2),
  ('5-10',   '5–10 €',             '5–10 €',         7.5,  3),
  ('10+',    'Vairāk par 10 €',    'Over €10',       12.0, 4),
  ('unsure', 'Vēl nevaru pateikt', 'Cannot say yet', null, 5)
on conflict (code) do nothing;

insert into public.brands (code, label_lv, label_en, sort) values
  ('canon',   'Canon',          'Canon',           1),
  ('hp',      'HP',             'HP',              2),
  ('brother', 'Brother',        'Brother',         3),
  ('epson',   'Epson',          'Epson',           4),
  ('kyocera', 'Kyocera',        'Kyocera',         5),
  ('xerox',   'Xerox',          'Xerox',           6),
  ('ricoh',   'Ricoh',          'Ricoh',           7),
  ('konica',  'Konica Minolta', 'Konica Minolta',  8),
  ('lexmark', 'Lexmark',        'Lexmark',         9),
  ('sharp',   'Sharp',          'Sharp',          10),
  ('other',   'Cits',           'Other',          11),
  ('unknown', 'Nezinu',         'Do not know',    12)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Leads. One row per e-mail address.
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id           bigint generated always as identity primary key,

  email        text        not null,
  email_norm   text        not null unique,
  name         text,

  segment      text        references public.segments(code),
  device_band  text        references public.device_bands(code),
  device_model text,
  price_band   text        references public.price_bands(code),

  wants_beta   boolean     not null default false,
  consent      boolean     not null check (consent),
  lang         text        not null default 'lv'
               check (lang in ('lv', 'en', 'it', 'fr', 'de', 'bg', 'cs', 'da', 'el',
                               'es', 'fi', 'hr', 'hu', 'lt', 'nl', 'pl', 'pt', 'ro',
                               'sk', 'sl', 'sv')),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Team working fields; the form never fills them
  contacted_at timestamptz,
  notes        text
);

create index if not exists idx_leads_created on public.leads (created_at);
create index if not exists idx_leads_segment on public.leads (segment);
create index if not exists idx_leads_price   on public.leads (price_band);
create index if not exists idx_leads_beta    on public.leads (wants_beta) where wants_beta;

create table if not exists public.lead_brands (
  lead_id bigint not null references public.leads(id) on delete cascade,
  brand   text   not null references public.brands(code),
  primary key (lead_id, brand)
);

create index if not exists idx_lead_brands_brand on public.lead_brands (brand);

create table if not exists public.lead_events (
  id         bigint generated always as identity primary key,
  lead_id    bigint      not null references public.leads(id) on delete cascade,
  kind       text        not null check (kind in ('created', 'updated')),
  payload    jsonb       not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_lead    on public.lead_events (lead_id, created_at);
create index if not exists idx_events_created on public.lead_events (created_at);

-- ---------------------------------------------------------------------------
-- Views. security_invoker so they never bypass RLS if someone is ever
-- granted access to them.
-- ---------------------------------------------------------------------------
create or replace view public.v_leads with (security_invoker = true) as
select
  l.id,
  l.email,
  l.name,
  l.segment,     s.label_lv as segment_lv,
  l.device_band, d.label_lv as device_band_lv,
  l.device_model,
  l.price_band,  p.label_lv as price_band_lv, p.eur_midpoint,
  (select string_agg(b.label_lv, ' / ' order by b.sort)
     from public.lead_brands lb join public.brands b on b.code = lb.brand
    where lb.lead_id = l.id) as brands,
  l.wants_beta,
  l.lang,
  l.created_at,
  l.updated_at,
  l.contacted_at
from public.leads l
left join public.segments     s on s.code = l.segment
left join public.device_bands d on d.code = l.device_band
left join public.price_bands  p on p.code = l.price_band;

-- How many people are in each price band — is there any willingness to pay
create or replace view public.v_price_demand with (security_invoker = true) as
select
  p.code,
  p.label_lv,
  p.eur_midpoint,
  count(l.id) as leads,
  round(count(l.id) * 100.0 /
        nullif((select count(*) from public.leads where price_band is not null), 0), 1) as pct
from public.price_bands p
left join public.leads l on l.price_band = p.code
group by p.code
order by p.sort;

-- Segments and how many devices they would sign up — where the volume is
create or replace view public.v_segment_demand with (security_invoker = true) as
select
  s.code,
  s.label_lv,
  count(l.id)                                    as leads,
  count(*) filter (where l.wants_beta)           as beta_volunteers,
  -- Lower bound of each device band, for a conservative estimate
  coalesce(sum(case l.device_band when '1' then 1 when '2-5' then 2
                    when '6-20' then 6 when '20+' then 20 end), 0) as min_devices
from public.segments s
left join public.leads l on l.segment = s.code
group by s.code
order by s.sort;

-- Which manufacturers' menus to document first. Percentages are of the
-- people who answered the brand question at all.
create or replace view public.v_brand_demand with (security_invoker = true) as
select
  b.code,
  b.label_lv,
  count(lb.lead_id) as leads,
  round(count(lb.lead_id) * 100.0 /
        nullif((select count(distinct lead_id) from public.lead_brands), 0), 1) as pct
from public.brands b
left join public.lead_brands lb on lb.brand = b.code
group by b.code
order by leads desc, b.sort;

-- Which device models to support first
create or replace view public.v_device_models with (security_invoker = true) as
select
  min(trim(device_model)) as model,
  count(*)                as mentions
from public.leads
where device_model is not null and trim(device_model) <> ''
group by lower(trim(device_model))
order by mentions desc, model;

-- ---------------------------------------------------------------------------
-- submit_lead — the only entry point from the browser.
--
-- One unnamed jsonb parameter: PostgREST then passes the whole request body
-- as is, so the page sends exactly the JSON it used to send to server.js.
--
-- Errors are raised with SQLSTATE 'PGRST' so PostgREST answers with the same
-- HTTP status as server.js (422, 413, 429) and a body of {"code": "..."}.
--
-- Rate limits. Without an IP address there is no per-visitor limit, so:
--   * per e-mail: at most 20 submissions in 10 minutes. One real sign-up is
--     the e-mail plus one request per follow-up answer — 4–5 requests.
--   * new e-mails, all visitors together: at most 30 a minute and 1000 a day.
--     A validation page with ad traffic gets nowhere near this; a script
--     inventing addresses hits it within seconds and then gets 429.
--   * all submissions together: at most 300 a minute.
-- A 429 makes the page show its "busy, try again" message. The limits cap
-- how fast the table can grow; they do not tell a bot from a person. If fake
-- sign-ups do show up, the next step is a CAPTCHA (e.g. Cloudflare Turnstile)
-- checked in a Supabase Edge Function.
-- ---------------------------------------------------------------------------
create or replace function public.submit_lead(jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  body        jsonb := $1;
  raw_email   text;
  v_name      text;
  v_segment   text;
  v_devices   text;
  v_model     text;
  v_price     text;
  v_brands    text[];
  v_beta      boolean;
  v_lang      text;
  v_existing  bigint;
  v_id        bigint;
  v_inserted  boolean;
begin
  if body is null or jsonb_typeof(body) <> 'object' then
    raise sqlstate 'PGRST' using
      message = '{"code":"invalid_body","message":"invalid_body"}',
      detail  = '{"status":400,"headers":{}}';
  end if;

  -- server.js LIMITS.body
  if octet_length(body::text) > 8192 then
    raise sqlstate 'PGRST' using
      message = '{"code":"too_large","message":"too_large"}',
      detail  = '{"status":413,"headers":{}}';
  end if;

  -- The address is never truncated: a shortened e-mail is a different
  -- address, not a shorter version of the same one.
  raw_email := case when jsonb_typeof(body->'email') = 'string'
                    then trim(body->>'email') end;
  if raw_email is null or raw_email = '' or char_length(raw_email) > 254
     or raw_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' then
    raise sqlstate 'PGRST' using
      message = '{"code":"invalid_email","message":"invalid_email","details":"email"}',
      detail  = '{"status":422,"headers":{}}';
  end if;

  if body->'consent' is distinct from 'true'::jsonb then
    raise sqlstate 'PGRST' using
      message = '{"code":"consent_required","message":"consent_required","details":"consent"}',
      detail  = '{"status":422,"headers":{}}';
  end if;

  -- Rate limits (see above). Checked after validation so that malformed
  -- requests, which write nothing, do not use up anybody's allowance.
  select id into v_existing from leads where email_norm = lower(raw_email);

  if (select count(*) from lead_events
       where created_at > now() - interval '1 minute') >= 300
     or (v_existing is not null and
         (select count(*) from lead_events
           where lead_id = v_existing
             and created_at > now() - interval '10 minutes') >= 20)
     or (v_existing is null and
         ((select count(*) from leads
            where created_at > now() - interval '1 minute') >= 30
          or (select count(*) from leads
               where created_at > now() - interval '1 day') >= 1000)) then
    raise sqlstate 'PGRST' using
      message = '{"code":"rate_limited","message":"rate_limited"}',
      detail  = '{"status":429,"headers":{"Retry-After":"60"}}';
  end if;

  -- clean(): strings only, trimmed, empty becomes null, length capped
  v_name  := left(nullif(trim(case when jsonb_typeof(body->'name')  = 'string' then body->>'name'  end), ''), 120);
  v_model := left(nullif(trim(case when jsonb_typeof(body->'model') = 'string' then body->>'model' end), ''), 120);

  -- pickCode(): an unknown code is silently dropped as null
  select code into v_segment from segments
   where jsonb_typeof(body->'segment') = 'string' and code = left(trim(body->>'segment'), 40);
  select code into v_devices from device_bands
   where jsonb_typeof(body->'devices') = 'string' and code = left(trim(body->>'devices'), 40);
  select code into v_price from price_bands
   where jsonb_typeof(body->'priceBand') = 'string' and code = left(trim(body->>'priceBand'), 40);

  -- pickCodes(): null means "field absent", an empty array means "nothing ticked"
  if jsonb_typeof(body->'brands') = 'array' then
    select coalesce(array_agg(code), '{}') into v_brands
      from (select b.code
              from brands b
             where b.code in (select left(trim(e), 40)
                                from jsonb_array_elements_text(body->'brands') as e)
             order by b.sort
             limit 12) picked;
  end if;

  v_beta := body->'wantsBeta' = 'true'::jsonb;
  v_lang := case when body->>'lang' in ('lv', 'en', 'it', 'fr', 'de', 'bg', 'cs', 'da', 'el',
                                         'es', 'fi', 'hr', 'hu', 'lt', 'nl', 'pl', 'pt', 'ro',
                                         'sk', 'sl', 'sv')
                 then body->>'lang' else 'lv' end;

  /* COALESCE, not plain assignment: one sign-up arrives as several requests
     (the e-mail, then one per answer), so a later submission carrying fewer
     answers must not erase the ones already given. wants_beta is sticky —
     silence never withdraws an opt-in. */
  insert into leads as l (email, email_norm, name, segment, device_band, device_model,
                          price_band, wants_beta, consent, lang)
  values (raw_email, lower(raw_email), v_name, v_segment, v_devices, v_model,
          v_price, coalesce(v_beta, false), true, v_lang)
  on conflict (email_norm) do update set
    email        = excluded.email,
    name         = coalesce(excluded.name,         l.name),
    segment      = coalesce(excluded.segment,      l.segment),
    device_band  = coalesce(excluded.device_band,  l.device_band),
    device_model = coalesce(excluded.device_model, l.device_model),
    price_band   = coalesce(excluded.price_band,   l.price_band),
    wants_beta   = l.wants_beta or excluded.wants_beta,
    lang         = excluded.lang,
    updated_at   = now()
  returning id, (xmax = 0) into v_id, v_inserted;

  -- Brands: an array, even an empty one, replaces the set; null leaves it.
  if v_brands is not null then
    delete from lead_brands where lead_id = v_id;
    insert into lead_brands (lead_id, brand)
      select v_id, unnest(v_brands)
      on conflict do nothing;
  end if;

  insert into lead_events (lead_id, kind, payload)
  values (v_id, case when v_inserted then 'created' else 'updated' end, body);

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'status', case when v_inserted then 'created' else 'updated' end);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges. The browser (anon) may submit, never read.
-- ---------------------------------------------------------------------------
alter table public.segments     enable row level security;
alter table public.device_bands enable row level security;
alter table public.price_bands  enable row level security;
alter table public.brands       enable row level security;
alter table public.leads        enable row level security;
alter table public.lead_brands  enable row level security;
alter table public.lead_events  enable row level security;

revoke all on public.segments, public.device_bands, public.price_bands, public.brands,
              public.leads, public.lead_brands, public.lead_events,
              public.v_leads, public.v_price_demand, public.v_segment_demand,
              public.v_brand_demand, public.v_device_models
  from anon, authenticated;

revoke all on function public.submit_lead(jsonb) from public;
grant execute on function public.submit_lead(jsonb) to anon, authenticated;
