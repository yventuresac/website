-- ─────────────────────────────────────────────────────────────
-- Y-VENTURES 학회원 시스템 2단계: 기수별 자료실 + 동문 창업가 제보
-- 실행 방법: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
-- 선행 조건: migration-members.sql (generation, is_admin() 사용)
--
-- 자료실은 링크 중심이다. 파일은 노션·드라이브에 두고 여기는 그 주소만 모은다.
-- Supabase 무료 스토리지(1GB)를 파일로 채우지 않기 위한 결정.
-- ─────────────────────────────────────────────────────────────

-- 학회원 판별 헬퍼 (운영진 포함)
create or replace function public.is_member_or_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.is_member or p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- 1. 자료실
create table if not exists public.resources (
  id          bigint generated always as identity primary key,
  generation  int,                          -- null = 전 기수 공통
  category    text not null default 'link',
  title       text not null check (char_length(title) between 1 and 200),
  url         text not null,
  note        text not null default '',     -- 무엇이 들어있는지 한 줄
  author_id   uuid references auth.users on delete set null,
  author_name text not null default '',
  created_at  timestamptz not null default now(),
  constraint resources_category_check check (category in
    ('session',   -- 세션·발표 자료
     'template',  -- 템플릿·양식
     'notion',    -- 노션
     'drive',     -- 드라이브
     'etc'))
);

create index if not exists idx_resources_gen on public.resources (generation, created_at desc);

-- 2. 동문 창업가 제보
-- 뉴스레터 코너의 재료가 된다. 크롤러보다 사람 네트워크가 강한 영역.
create table if not exists public.alumni_news (
  id          bigint generated always as identity primary key,
  company     text not null check (char_length(company) between 1 and 100),
  title       text not null check (char_length(title) between 1 and 300),
  url         text not null default '',     -- 기사·공지 링크 (없어도 제보 가능)
  note        text not null default '',
  status      text not null default 'new',  -- new → used(뉴스레터에 실림)
  author_id   uuid references auth.users on delete set null,
  author_name text not null default '',
  created_at  timestamptz not null default now(),
  constraint alumni_news_status_check check (status in ('new', 'used'))
);

create index if not exists idx_alumni_news on public.alumni_news (status, created_at desc);

-- 3. RLS — 둘 다 학회원 전용 공간이다. 외부에는 보이지 않는다.
alter table public.resources   enable row level security;
alter table public.alumni_news enable row level security;

-- 자료실: 학회원 읽기, 등록은 운영진만, 본인 또는 운영진 수정·삭제
drop policy if exists "resources_select_member" on public.resources;
create policy "resources_select_member" on public.resources
  for select using (public.is_member_or_admin());

drop policy if exists "resources_insert_member" on public.resources;
drop policy if exists "resources_insert_admin" on public.resources;
create policy "resources_insert_admin" on public.resources
  for insert with check (public.is_admin() and auth.uid() = author_id);

drop policy if exists "resources_update_own" on public.resources;
create policy "resources_update_own" on public.resources
  for update using (auth.uid() = author_id or public.is_admin());

drop policy if exists "resources_delete_own" on public.resources;
create policy "resources_delete_own" on public.resources
  for delete using (auth.uid() = author_id or public.is_admin());

-- 제보: 학회원 읽기(중복 제보 방지)·등록, 상태 변경은 운영진, 삭제는 본인 또는 운영진
drop policy if exists "alumni_news_select_member" on public.alumni_news;
create policy "alumni_news_select_member" on public.alumni_news
  for select using (public.is_member_or_admin());

drop policy if exists "alumni_news_insert_member" on public.alumni_news;
create policy "alumni_news_insert_member" on public.alumni_news
  for insert with check (public.is_member_or_admin() and auth.uid() = author_id);

drop policy if exists "alumni_news_update_admin" on public.alumni_news;
create policy "alumni_news_update_admin" on public.alumni_news
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "alumni_news_delete_own" on public.alumni_news;
create policy "alumni_news_delete_own" on public.alumni_news
  for delete using (auth.uid() = author_id or public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 실행 후 확인
--   select * from public.resources limit 1;
--   select * from public.alumni_news limit 1;
-- ─────────────────────────────────────────────────────────────
