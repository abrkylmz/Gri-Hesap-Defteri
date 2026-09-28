-- ═══════════════════════════════════════════════════════════════════════
--  Gri Hesap Defteri — veritabanı şeması
--  Supabase → SQL Editor'a yapıştırıp bir kez çalıştırın.
--  Betik idempotent'tir: tekrar çalıştırmak veriyi silmez.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Tipler ────────────────────────────────────────────────────────────
do $$ begin
  create type public.entry_kind as enum ('income', 'expense');
exception when duplicate_object then null; end $$;

-- ─── Profil ────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  currency    text not null default 'TRY' check (currency in ('TRY', 'USD', 'EUR', 'GBP')),
  timezone    text not null default 'Europe/Istanbul',
  created_at  timestamptz not null default now()
);

-- ─── Kategoriler ───────────────────────────────────────────────────────
create table if not exists public.categories (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind            public.entry_kind not null,
  name            text not null check (char_length(btrim(name)) between 1 and 40),
  emoji           text not null default '•' check (char_length(emoji) between 1 and 16),
  monthly_budget  bigint check (monthly_budget is null or monthly_budget > 0),
  sort            integer not null default 0,
  created_at      timestamptz not null default now(),
  -- (id, user_id, kind) üçlüsü: işlemlerin başka kullanıcının ya da
  -- yanlış türdeki bir kategoriye bağlanmasını veritabanı seviyesinde engeller.
  unique (id, user_id, kind),
  unique (user_id, kind, name)
);

-- ─── Düzenli (tekrarlayan) kayıtlar ────────────────────────────────────
create table if not exists public.recurring (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind          public.entry_kind not null,
  amount        bigint not null check (amount > 0 and amount <= 99999999999),
  category_id   uuid,
  note          text check (note is null or char_length(note) <= 200),
  day_of_month  smallint not null check (day_of_month between 1 and 31),
  starts_on     date not null default current_date,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (id, user_id),
  foreign key (category_id, user_id, kind)
    references public.categories (id, user_id, kind) on delete set null (category_id)
);

-- ─── İşlemler ──────────────────────────────────────────────────────────
-- Tutarlar kuruş (minor unit) cinsinden tam sayıdır: kayan nokta hatası yok.
create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind          public.entry_kind not null,
  amount        bigint not null check (amount > 0 and amount <= 99999999999),
  category_id   uuid,
  note          text check (note is null or char_length(note) <= 200),
  occurred_on   date not null,
  recurring_id  uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (category_id, user_id, kind)
    references public.categories (id, user_id, kind) on delete set null (category_id),
  foreign key (recurring_id, user_id)
    references public.recurring (id, user_id) on delete set null (recurring_id)
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, occurred_on desc, created_at desc);

-- Hangi düzenli kaydın hangi ay işlendiği. Kullanıcı üretilen işlemi silse
-- bile kayıt burada kalır; böylece silinen işlem bir daha üretilmez.
create table if not exists public.recurring_runs (
  recurring_id  uuid not null references public.recurring (id) on delete cascade,
  period        date not null,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (recurring_id, period)
);

-- ─── updated_at ────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists transactions_touch on public.transactions;
create trigger transactions_touch before update on public.transactions
  for each row execute function public.touch_updated_at();

-- ─── Yeni kullanıcı: profil + varsayılan kategoriler ───────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_tz text := new.raw_user_meta_data ->> 'timezone';
begin
  if v_tz is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = v_tz) then
    v_tz := 'Europe/Istanbul';
  end if;

  insert into public.profiles (id, timezone) values (new.id, v_tz)
  on conflict (id) do nothing;

  insert into public.categories (user_id, kind, name, emoji, sort) values
    (new.id, 'expense', 'Market',      '🛒', 1),
    (new.id, 'expense', 'Kira',        '🏠', 2),
    (new.id, 'expense', 'Faturalar',   '💡', 3),
    (new.id, 'expense', 'Yeme-İçme',   '🍽️', 4),
    (new.id, 'expense', 'Ulaşım',      '🚌', 5),
    (new.id, 'expense', 'Sağlık',      '💊', 6),
    (new.id, 'expense', 'Abonelikler', '📺', 7),
    (new.id, 'expense', 'Giyim',       '👕', 8),
    (new.id, 'expense', 'Eğlence',     '🎬', 9),
    (new.id, 'expense', 'Eğitim',      '📚', 10),
    (new.id, 'expense', 'Diğer',       '📦', 99),
    (new.id, 'income',  'Maaş',        '💼', 1),
    (new.id, 'income',  'Ek Gelir',    '💸', 2),
    (new.id, 'income',  'Yatırım',     '📈', 3),
    (new.id, 'income',  'Hediye',      '🎁', 4),
    (new.id, 'income',  'Diğer',       '🪙', 99)
  on conflict do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Düzenli kayıtları deftere işle ────────────────────────────────────
-- İdempotent: aynı anda iki cihazdan çağrılsa bile her ay yalnızca bir kez işlenir.
create or replace function public.materialize_recurring()
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_uid    uuid := auth.uid();
  v_today  date;
  v_rows   integer;
  v_count  integer := 0;
  r        record;
  m        date;
  d        date;
begin
  if v_uid is null then
    return 0;
  end if;

  select (now() at time zone coalesce(p.timezone, 'Europe/Istanbul'))::date
    into v_today
    from public.profiles p where p.id = v_uid;
  v_today := coalesce(v_today, (now() at time zone 'Europe/Istanbul')::date);

  for r in
    select rc.*,
           (select max(rr.period) from public.recurring_runs rr where rr.recurring_id = rc.id) as last_period
      from public.recurring rc
     where rc.user_id = v_uid and rc.active and rc.starts_on <= v_today
  loop
    m := greatest(
      date_trunc('month', r.starts_on)::date,
      coalesce((r.last_period + interval '1 month')::date, '-infinity'::date)
    );

    while m <= v_today loop
      -- 31'i olmayan aylarda son güne kaydır.
      d := m + (least(r.day_of_month,
                      extract(day from (m + interval '1 month - 1 day'))::int) - 1);
      exit when d > v_today;

      if d >= r.starts_on then
        insert into public.recurring_runs (recurring_id, period, user_id)
        values (r.id, m, v_uid)
        on conflict do nothing;
        get diagnostics v_rows = row_count;

        if v_rows > 0 then
          insert into public.transactions (user_id, kind, amount, category_id, note, occurred_on, recurring_id)
          values (v_uid, r.kind, r.amount, r.category_id, r.note, d, r.id);
          v_count := v_count + 1;
        end if;
      end if;

      m := (m + interval '1 month')::date;
    end loop;
  end loop;

  return v_count;
end $$;

-- ─── Aylık toplamlar (trend grafiği) ───────────────────────────────────
create or replace function public.monthly_totals(p_from date, p_to date)
returns table (month date, income bigint, expense bigint)
language sql stable security invoker set search_path = '' as $$
  select date_trunc('month', t.occurred_on)::date,
         coalesce(sum(t.amount) filter (where t.kind = 'income'), 0)::bigint,
         coalesce(sum(t.amount) filter (where t.kind = 'expense'), 0)::bigint
    from public.transactions t
   where t.user_id = auth.uid()
     and t.occurred_on >= p_from
     and t.occurred_on < p_to
   group by 1
   order by 1;
$$;

-- ─── Row Level Security ────────────────────────────────────────────────
alter table public.profiles       enable row level security;
alter table public.categories     enable row level security;
alter table public.recurring      enable row level security;
alter table public.transactions   enable row level security;
alter table public.recurring_runs enable row level security;

drop policy if exists "own profile read"   on public.profiles;
drop policy if exists "own profile update" on public.profiles;
create policy "own profile read"   on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "own profile update" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

do $$
declare t text;
begin
  foreach t in array array['categories', 'recurring', 'transactions', 'recurring_runs'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- ─── Yetkiler ──────────────────────────────────────────────────────────
revoke all on public.profiles, public.categories, public.recurring,
              public.transactions, public.recurring_runs from anon;
grant select, update                 on public.profiles       to authenticated;
grant select, insert, update, delete on public.categories     to authenticated;
grant select, insert, update, delete on public.recurring      to authenticated;
grant select, insert, update, delete on public.transactions   to authenticated;
grant select, insert, update, delete on public.recurring_runs to authenticated;

revoke execute on function public.materialize_recurring()         from public, anon;
revoke execute on function public.monthly_totals(date, date)      from public, anon;
revoke execute on function public.handle_new_user()               from public, anon, authenticated;
grant  execute on function public.materialize_recurring()         to authenticated;
grant  execute on function public.monthly_totals(date, date)      to authenticated;

-- Şema değişikliğini PostgREST'e bildir.
notify pgrst, 'reload schema';
