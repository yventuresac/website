-- ─────────────────────────────────────────────────────────────
-- 10/10 알럼나이 초대 행사 — 투심보고서 투자 게임
-- 실행 방법: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
--
-- 알럼나이 7명이 각자 스마트폰으로 4개 팀에 가상 투자금(1인 500억)을 배분한다.
-- 큰 화면(board.html)이 실시간으로 현황을 보여주고, 진행자(admin.html)가
-- 발표 순서 추첨 → 투자 열기 → 마감 → 결과 공개를 제어한다.
--
-- 하루짜리 행사용이라 anon 키로 읽기/쓰기를 모두 연다. 행사 끝나면
-- 맨 아래 "정리" 블록을 실행해서 테이블을 지워도 된다.
-- ─────────────────────────────────────────────────────────────

-- 1. 게임 상태 (행 1개만 쓴다)
create table if not exists public.alumni_game_state (
  id            int primary key default 1 check (id = 1),
  phase         text not null default 'lobby',   -- lobby | drawing | presenting | investing | closed | revealed
  team_order    jsonb not null default '[]'::jsonb,  -- 추첨된 팀 id 배열
  current_team  int not null default 0,          -- presenting 단계에서 몇 번째 팀이 발표 중인지 (0부터)
  reveal_step   int not null default 0,          -- revealed 단계에서 몇 번째까지 공개했는지
  deadline      timestamptz,                     -- 투자 마감 타이머 (없으면 null)
  drawn_at      timestamptz,                     -- 추첨 애니메이션 동기화용
  updated_at    timestamptz not null default now()
);

insert into public.alumni_game_state (id) values (1)
on conflict (id) do nothing;

-- 2. 투자 현황 (투자자 1명당 행 1개, 금액은 억 단위)
create table if not exists public.alumni_investments (
  investor    text primary key,
  amounts     jsonb not null default '{}'::jsonb,   -- { "fintech": 100, "platform": 0, ... }
  joined_at   timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3. 피드 (누가 어디에 얼마 넣었는지 큰 화면에 흘려보내기)
create table if not exists public.alumni_feed (
  id          bigserial primary key,
  investor    text not null,
  team        text not null,
  delta       int not null,          -- +50 / -20 (억)
  total       int not null,          -- 그 팀에 대한 변경 후 금액
  created_at  timestamptz not null default now()
);

-- 4. RLS — anon 전부 허용 (행사 당일 한정)
alter table public.alumni_game_state  enable row level security;
alter table public.alumni_investments enable row level security;
alter table public.alumni_feed        enable row level security;

drop policy if exists "alumni_game_state_all" on public.alumni_game_state;
create policy "alumni_game_state_all" on public.alumni_game_state
  for all using (true) with check (true);

drop policy if exists "alumni_investments_all" on public.alumni_investments;
create policy "alumni_investments_all" on public.alumni_investments
  for all using (true) with check (true);

drop policy if exists "alumni_feed_all" on public.alumni_feed;
create policy "alumni_feed_all" on public.alumni_feed
  for all using (true) with check (true);

-- 5. Realtime — 큰 화면이 변경을 즉시 받도록 publication 에 추가
--    (이미 추가돼 있으면 에러가 나는데, 그 줄만 무시하면 된다)
do $$
begin
  begin
    alter publication supabase_realtime add table public.alumni_game_state;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.alumni_investments;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.alumni_feed;
  exception when duplicate_object then null; end;
end $$;

-- 확인
select 'state' as t, count(*) from public.alumni_game_state
union all select 'investments', count(*) from public.alumni_investments
union all select 'feed', count(*) from public.alumni_feed;

-- ─────────────────────────────────────────────────────────────
-- 정리 (행사 끝난 뒤 필요하면 실행)
-- drop table if exists public.alumni_feed;
-- drop table if exists public.alumni_investments;
-- drop table if exists public.alumni_game_state;
-- ─────────────────────────────────────────────────────────────
