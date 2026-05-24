-- =============================================
-- 零食採購票選系統 - Supabase SQL Schema
-- 在 Supabase > SQL Editor 執行此檔案
-- =============================================

-- 投票週期表（由管理員控制開/關）
create table if not exists vote_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null default '本週零食票選',
  is_open boolean not null default false,
  created_at timestamptz default now(),
  closed_at timestamptz
);

-- 零食品項表
create table if not exists snack_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references vote_sessions(id) on delete cascade,
  name text not null,
  price integer,
  store text,
  url text,
  image_url text,
  type text check (type in ('snack', 'drink')) default 'snack',
  added_by text default '匿名',
  created_at timestamptz default now()
);

-- 投票記錄表（用瀏覽器指紋防重複）
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references vote_sessions(id) on delete cascade,
  snack_id uuid references snack_items(id) on delete cascade,
  voter_fingerprint text not null,
  created_at timestamptz default now(),
  unique(snack_id, voter_fingerprint)
);

-- 得票數 view（方便查詢）
create or replace view snack_vote_counts as
select
  s.id,
  s.session_id,
  s.name,
  s.price,
  s.store,
  s.url,
  s.image_url,
  s.type,
  s.created_at,
  count(v.id) as vote_count
from snack_items s
left join votes v on v.snack_id = s.id
group by s.id;

-- 啟用即時訂閱
alter table snack_items replica identity full;
alter table votes replica identity full;
alter table vote_sessions replica identity full;

-- RLS 設定（允許所有人讀，所有人可新增品項與投票）
alter table vote_sessions enable row level security;
alter table snack_items enable row level security;
alter table votes enable row level security;

create policy "anyone can read sessions" on vote_sessions for select using (true);
create policy "anyone can read items" on snack_items for select using (true);
create policy "anyone can insert items" on snack_items for insert with check (true);
create policy "anyone can read votes" on votes for select using (true);
create policy "anyone can vote" on votes for insert with check (true);
create policy "anyone can unvote" on votes for delete using (true);

-- 管理員可更新 session（建議加上管理密碼保護，見 README）
create policy "anyone can update sessions" on vote_sessions for update using (true);
create policy "anyone can insert sessions" on vote_sessions for insert with check (true);
create policy "anyone can delete items" on snack_items for delete using (true);
