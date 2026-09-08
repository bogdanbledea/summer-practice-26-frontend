-- Everything the backend needs, in one file: accounts, rotating refresh
-- tokens, and one table (or two) per team's feature. Paste this whole file
-- into the SQL Editor and run it once. Safe to run again — every statement
-- is idempotent.

-- Accounts -------------------------------------------------------------

create table if not exists users (
  id            serial primary key,
  -- The username as it was typed, for display.
  name          text not null,
  -- Stored lowercase, so one spelling is one account.
  username      text not null,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

create unique index if not exists users_username_key on users (username);

-- One row per issued refresh token. Storing them is what makes a refresh token
-- revocable, which is the whole reason it exists next to the access token.
create table if not exists refresh_tokens (
  id          bigserial primary key,
  user_id     integer not null references users(id) on delete cascade,
  token_hash  text not null unique,
  -- Every token minted from the same login shares a family. Replaying an
  -- already-used token kills the family: see rotateRefreshToken.
  family_id   uuid not null,
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists refresh_tokens_family_idx on refresh_tokens (family_id);
create index if not exists refresh_tokens_user_idx   on refresh_tokens (user_id);

-- Team 1 — tasks ---------------------------------------------------------
-- A task belongs to whoever created it and may be assigned to someone else,
-- so it is the one table here that two accounts can see.
create table if not exists tasks (
  id          bigserial primary key,
  owner_id    integer not null references users(id) on delete cascade,
  -- on delete set null, not cascade: closing an account must not delete the
  -- tasks other people wrote and handed to it.
  assignee_id integer references users(id) on delete set null,
  title       text not null,
  done        boolean not null default false,
  due_date    date,
  created_at  timestamptz not null default now()
);

create index if not exists tasks_owner_idx    on tasks (owner_id, created_at desc);
create index if not exists tasks_assignee_idx on tasks (assignee_id);

-- Team 2 — expenses --------------------------------------------------------
create table if not exists expenses (
  id         bigserial primary key,
  user_id    integer not null references users(id) on delete cascade,
  title      text not null,
  -- numeric, never a float: 0.1 + 0.2 is not 0.3 in binary floating point,
  -- and money is the one place that shows up in the total.
  amount     numeric(10, 2) not null,
  category   text not null,
  spent_on   date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists expenses_user_idx on expenses (user_id, spent_on desc);

-- Team 3 — message board -----------------------------------------------
-- No user_id scoping on reads: everyone sees the whole board. Writes are
-- still restricted to the author, in the route.
create table if not exists messages (
  id         bigserial primary key,
  author_id  integer not null references users(id) on delete cascade,
  text       text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_created_idx on messages (created_at desc);

-- Team 4 — reading list ---------------------------------------------------
-- No sharing here at all: unlike the message board, a reading list is
-- nobody's business but the person who saved it.
create table if not exists links (
  id         bigserial primary key,
  owner_id   integer not null references users(id) on delete cascade,
  title      text not null,
  url        text not null,
  tag        text,
  created_at timestamptz not null default now()
);

create index if not exists links_owner_idx on links (owner_id, created_at desc);

-- Team 5 — leaderboard ------------------------------------------------
-- Shared like the message board: every score is visible to everyone, so a
-- leaderboard is possible at all. Deleting is still restricted to your own.
create table if not exists scores (
  id         bigserial primary key,
  player_id  integer not null references users(id) on delete cascade,
  game       text not null,
  score      integer not null,
  created_at timestamptz not null default now()
);

create index if not exists scores_created_idx on scores (created_at desc);

-- Team 6 — event sign-up ------------------------------------------------
-- Two tables: a slot someone opened, and one row per person who took a seat
-- in it. The capacity check happens in the route, not here — see events.ts
-- for why that is a race on purpose.
create table if not exists event_slots (
  id         bigserial primary key,
  owner_id   integer not null references users(id) on delete cascade,
  title      text not null,
  capacity   integer not null,
  created_at timestamptz not null default now()
);

create table if not exists signups (
  id         bigserial primary key,
  slot_id    integer not null references event_slots(id) on delete cascade,
  user_id    integer not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- One seat per person per event: joining twice is a no-op, not two seats.
  unique (slot_id, user_id)
);

create index if not exists signups_slot_idx on signups (slot_id);

-- Row-level security -------------------------------------------------------
-- The Data API exposes public tables to the anon key. RLS on with no policies
-- denies everyone; only the service_role key this server holds bypasses it.
alter table users          enable row level security;
alter table refresh_tokens enable row level security;
alter table tasks          enable row level security;
alter table expenses       enable row level security;
alter table messages       enable row level security;
alter table links          enable row level security;
alter table scores         enable row level security;
alter table event_slots    enable row level security;
alter table signups        enable row level security;
