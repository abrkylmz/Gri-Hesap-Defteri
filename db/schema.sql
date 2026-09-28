-- ═══════════════════════════════════════════════════════════════════════
--  Gri Hesap Defteri — Neon (Postgres) şeması
--  Neon Console → SQL Editor'a yapıştırıp bir kez çalıştırın.
--  Betik idempotent'tir: tekrar çalıştırmak veriyi silmez.
--
--  Veri tablolarındaki `user_id`, users.id değeridir. Tüm sorgular sunucu
--  tarafında oturumdaki kullanıcıya göre filtrelenir (src/lib/data.ts, src/lib/actions).
-- ═══════════════════════════════════════════════════════════════════════

do $$ begin
  create type entry_kind as enum ('income', 'expense');
exception when duplicate_object then null; end $$;

-- ─── Kullanıcılar ve oturumlar ─────────────────────────────────────────
create table if not exists users (
  id             uuid primary key default gen_random_uuid(),
  username       text not null unique check (username ~ '^[a-z0-9._-]{3,32}$'),
  password_hash  text not null,
  created_at     timestamptz not null default now()
);

-- Çerezdeki rastgele belirtecin yalnızca SHA-256 özeti saklanır.
create table if not exists sessions (
  token_hash  text primary key,
  user_id     uuid not null references users (id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists sessions_user_idx on sessions (user_id);

-- Kaba kuvvet denemelerine karşı: kısa sürede çok sayıda hatalı giriş kilitlenir.
create table if not exists login_failures (
  username  text not null,
  at        timestamptz not null default now()
);
create index if not exists login_failures_idx on login_failures (username, at);

-- Uygulamanın kendi ayarları (kayıt açık mı, bildirim anahtarları, zamanlayıcı son çalışma…).
create table if not exists app_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

-- Roller ve hesap durumu
alter table users add column if not exists role text not null default 'user'
  check (role in ('admin', 'user'));
alter table users add column if not exists disabled_at  timestamptz;
alter table users add column if not exists last_seen_at timestamptz;

-- Hiç yönetici yoksa ilk açılan hesap yönetici olur.
update users set role = 'admin'
 where id = (select id from users order by created_at limit 1)
   and not exists (select 1 from users where role = 'admin');

-- Kayıt: ilk kullanıcı her zaman kayıt olabilir ve yönetici olur. Sonrakiler yalnızca
-- yönetim panelinden kayıtlar açıksa (app_settings.signup_open, varsayılan açık).
-- Kilit, iki kişinin aynı anda "ilk kullanıcı" olmasını engeller. Kayıt kapalıysa null döner.
drop function if exists register_user(text, text, boolean);
create or replace function register_user(p_username text, p_hash text)
returns uuid language plpgsql as $$
declare
  v_id    uuid;
  v_first boolean;
begin
  perform pg_advisory_xact_lock(hashtext('gri:register'));
  v_first := not exists (select 1 from users);
  if not v_first
     and coalesce((select value from app_settings where key = 'signup_open'), 'true') <> 'true' then
    return null;
  end if;
  insert into users (username, password_hash, role)
  values (p_username, p_hash, case when v_first then 'admin' else 'user' end)
  returning users.id into v_id;
  return v_id;
end $$;

-- Hesabı ve ona ait tüm verileri siler (yönetim paneli).
create or replace function delete_user(p_id uuid)
returns void language plpgsql as $$
declare
  v_uid  text := p_id::text;
  v_name text;
begin
  select username into v_name from users where id = p_id;
  delete from transactions       where user_id = v_uid;
  delete from recurring          where user_id = v_uid;  -- recurring_runs zincirleme silinir
  delete from categories         where user_id = v_uid;
  delete from profiles           where user_id = v_uid;
  delete from push_subscriptions where user_id = v_uid;
  delete from ipo_accounts       where user_id = v_uid;  -- katılım ve satışlar zincirleme silinir
  delete from ipos               where user_id = v_uid;
  delete from reminders_sent     where user_id = v_uid;
  delete from login_failures     where username = v_name;
  delete from users              where id = p_id;       -- oturumlar zincirleme silinir
end $$;

-- ─── Profil ────────────────────────────────────────────────────────────
create table if not exists profiles (
  user_id     text primary key,
  currency    text not null default 'TRY' check (currency in ('TRY', 'USD', 'EUR', 'GBP')),
  timezone    text not null default 'Europe/Istanbul',
  created_at  timestamptz not null default now()
);

-- ─── Kategoriler ───────────────────────────────────────────────────────
create table if not exists categories (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null,
  kind            entry_kind not null,
  name            text not null check (char_length(btrim(name)) between 1 and 40),
  emoji           text not null default '•' check (char_length(emoji) between 1 and 16),
  monthly_budget  bigint check (monthly_budget is null or monthly_budget > 0),
  sort            integer not null default 0,
  created_at      timestamptz not null default now(),
  -- (id, user_id, kind): işlemlerin başka kullanıcının ya da yanlış türdeki
  -- bir kategoriye bağlanmasını veritabanı seviyesinde engeller.
  unique (id, user_id, kind),
  unique (user_id, kind, name)
);

-- ─── Düzenli (tekrarlayan) kayıtlar ────────────────────────────────────
create table if not exists recurring (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  kind          entry_kind not null,
  amount        bigint not null check (amount > 0 and amount <= 99999999999),
  category_id   uuid,
  note          text check (note is null or char_length(note) <= 200),
  day_of_month  smallint not null check (day_of_month between 1 and 31),
  starts_on     date not null default current_date,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (id, user_id),
  foreign key (category_id, user_id, kind)
    references categories (id, user_id, kind) on delete set null (category_id)
);
create index if not exists recurring_user_idx on recurring (user_id);

-- ─── İşlemler ──────────────────────────────────────────────────────────
-- Tutarlar kuruş (minor unit) cinsinden tam sayıdır: kayan nokta hatası yok.
create table if not exists transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  kind          entry_kind not null,
  amount        bigint not null check (amount > 0 and amount <= 99999999999),
  category_id   uuid,
  note          text check (note is null or char_length(note) <= 200),
  occurred_on   date not null,
  recurring_id  uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (category_id, user_id, kind)
    references categories (id, user_id, kind) on delete set null (category_id),
  foreign key (recurring_id, user_id)
    references recurring (id, user_id) on delete set null (recurring_id)
);
create index if not exists transactions_user_date_idx
  on transactions (user_id, occurred_on desc, created_at desc);

-- Hangi düzenli kaydın hangi ay işlendiği. Kullanıcı üretilen işlemi silse
-- bile kayıt burada kalır; böylece silinen işlem bir daha üretilmez.
create table if not exists recurring_runs (
  recurring_id  uuid not null references recurring (id) on delete cascade,
  period        date not null,
  primary key (recurring_id, period)
);

-- ─── updated_at ────────────────────────────────────────────────────────
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists transactions_touch on transactions;
create trigger transactions_touch before update on transactions
  for each row execute function touch_updated_at();

-- ─── İlk girişte profil + varsayılan kategoriler ───────────────────────
-- İdempotent: profil zaten varsa hiçbir şey yapmaz, false döner.
create or replace function ensure_user(p_user text, p_tz text)
returns boolean language plpgsql as $$
declare
  v_tz text := p_tz;
  v_rows integer;
begin
  if v_tz is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = v_tz) then
    v_tz := 'Europe/Istanbul';
  end if;

  insert into profiles (user_id, timezone) values (p_user, v_tz)
  on conflict (user_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return false;
  end if;

  insert into categories (user_id, kind, name, emoji, sort) values
    (p_user, 'expense', 'Market',      '🛒', 1),
    (p_user, 'expense', 'Kira',        '🏠', 2),
    (p_user, 'expense', 'Faturalar',   '💡', 3),
    (p_user, 'expense', 'Yeme-İçme',   '🍽️', 4),
    (p_user, 'expense', 'Ulaşım',      '🚌', 5),
    (p_user, 'expense', 'Sağlık',      '💊', 6),
    (p_user, 'expense', 'Abonelikler', '📺', 7),
    (p_user, 'expense', 'Giyim',       '👕', 8),
    (p_user, 'expense', 'Eğlence',     '🎬', 9),
    (p_user, 'expense', 'Eğitim',      '📚', 10),
    (p_user, 'expense', 'Diğer',       '📦', 99),
    (p_user, 'income',  'Maaş',        '💼', 1),
    (p_user, 'income',  'Ek Gelir',    '💸', 2),
    (p_user, 'income',  'Yatırım',     '📈', 3),
    (p_user, 'income',  'Hediye',      '🎁', 4),
    (p_user, 'income',  'Diğer',       '🪙', 99)
  on conflict do nothing;

  return true;
end $$;

-- ─── Düzenli kayıtları deftere işle ────────────────────────────────────
-- İdempotent: aynı anda iki cihazdan çağrılsa bile her ay yalnızca bir kez işlenir.
create or replace function materialize_recurring(p_user text)
returns integer language plpgsql as $$
declare
  v_today  date;
  v_rows   integer;
  v_count  integer := 0;
  r        record;
  m        date;
  d        date;
begin
  select (now() at time zone coalesce(p.timezone, 'Europe/Istanbul'))::date
    into v_today
    from profiles p where p.user_id = p_user;
  v_today := coalesce(v_today, (now() at time zone 'Europe/Istanbul')::date);

  for r in
    select rc.*,
           (select max(rr.period) from recurring_runs rr where rr.recurring_id = rc.id) as last_period
      from recurring rc
     where rc.user_id = p_user and rc.active and rc.starts_on <= v_today
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
        insert into recurring_runs (recurring_id, period) values (r.id, m)
        on conflict do nothing;
        get diagnostics v_rows = row_count;

        if v_rows > 0 then
          insert into transactions (user_id, kind, amount, category_id, note, occurred_on, recurring_id)
          values (p_user, r.kind, r.amount, r.category_id, r.note, d, r.id);
          v_count := v_count + 1;
        end if;
      end if;

      m := (m + interval '1 month')::date;
    end loop;
  end loop;

  return v_count;
end $$;

-- ─── Hatırlatmalar ─────────────────────────────────────────────────────
-- remind_days: vadeden kaç gün önce hatırlatılacağı (null = hatırlatma yok).
-- Mevcut düzenli kayıtlara varsayılan olarak 3 gün uygulanır.
alter table recurring    add column if not exists remind_days smallint default 3
  check (remind_days is null or remind_days between 0 and 30);
alter table transactions add column if not exists remind_days smallint
  check (remind_days is null or remind_days between 0 and 30);

-- Tarayıcı bildirim abonelikleri (her cihaz/tarayıcı için bir satır).
create table if not exists push_subscriptions (
  endpoint    text primary key,
  user_id     text not null,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

-- Gönderilmiş hatırlatmalar: aynı ödeme için aynı vade tarihinde tek bildirim.
create table if not exists reminders_sent (
  source_id  uuid not null,
  due_on     date not null,
  user_id    text not null,
  sent_at    timestamptz not null default now(),
  primary key (source_id, due_on)
);

-- ─── Halka arz takibi ──────────────────────────────────────────────────
-- Fiyatlar kuruş (bigint), adetler lot (integer). (id, user_id) çiftleri üzerinden
-- bileşik yabancı anahtarlar, başka kullanıcının kaydına bağlanmayı engeller.
create table if not exists ipo_accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  sort        integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name)
);

create table if not exists ipos (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null,
  code              text not null check (code ~ '^[A-Z0-9]{2,10}$'),
  name              text check (name is null or char_length(name) <= 80),
  offer_price       bigint not null check (offer_price > 0 and offer_price <= 99999999999),
  listed_on         date,
  current_price     bigint check (current_price is null or (current_price > 0 and current_price <= 99999999999)),
  price_updated_at  timestamptz,
  created_at        timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, code)
);

create table if not exists ipo_allocations (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  ipo_id      uuid not null,
  account_id  uuid not null,
  lots        integer not null check (lots > 0 and lots <= 100000000),
  created_at  timestamptz not null default now(),
  unique (id, user_id),
  unique (ipo_id, account_id),
  foreign key (ipo_id, user_id)     references ipos (id, user_id)         on delete cascade,
  foreign key (account_id, user_id) references ipo_accounts (id, user_id) on delete cascade
);

create table if not exists ipo_sales (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null,
  allocation_id  uuid not null,
  lots           integer not null check (lots > 0 and lots <= 100000000),
  price          bigint not null check (price > 0 and price <= 99999999999),
  commission     bigint not null default 0 check (commission >= 0 and commission <= 99999999999),
  sold_on        date not null,
  created_at     timestamptz not null default now(),
  foreign key (allocation_id, user_id) references ipo_allocations (id, user_id) on delete cascade
);
create index if not exists ipo_sales_allocation_idx on ipo_sales (allocation_id);
create index if not exists ipos_user_idx on ipos (user_id);

-- Satılan toplam lot, o hesaba gelen lotu asla aşamaz.
create or replace function ipo_check_lots()
returns trigger language plpgsql as $$
declare
  v_alloc uuid;
  v_sold  bigint;
  v_lots  integer;
begin
  -- NEW'in alanları tabloya göre değişir; her dal yalnızca kendi tablosunda çalışır.
  if tg_table_name = 'ipo_sales' then
    v_alloc := new.allocation_id;
  else
    v_alloc := new.id;
  end if;
  select coalesce(sum(lots), 0) into v_sold from ipo_sales where allocation_id = v_alloc;
  select lots into v_lots from ipo_allocations where id = v_alloc;
  if v_sold > v_lots then
    raise exception 'Satılan lot (%), gelen lotu (%) aşamaz', v_sold, v_lots using errcode = '23514';
  end if;
  return null;
end $$;

drop trigger if exists ipo_sales_lots on ipo_sales;
create trigger ipo_sales_lots after insert or update on ipo_sales
  for each row execute function ipo_check_lots();
drop trigger if exists ipo_allocations_lots on ipo_allocations;
create trigger ipo_allocations_lots after update of lots on ipo_allocations
  for each row execute function ipo_check_lots();
