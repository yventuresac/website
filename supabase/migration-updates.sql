-- ─────────────────────────────────────────────────────────────
-- 새 소식 (site_updates) — 학회원 허브 상단 "새 소식" 섹션
-- 실행 방법: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
--
-- 무엇이 쌓이나:
--   · Insights 새 글        → 트리거가 자동으로 등록
--   · 프로그램·뉴스레터·공지 → 운영진이 허브에서 직접 등록
--
-- 허브는 이 테이블의 최신 항목을 보여주고, 마지막 방문 이후
-- 생긴 항목에 NEW 표시를 붙인다 (마지막 방문 시각은 브라우저에 저장).
-- ─────────────────────────────────────────────────────────────

create table if not exists public.site_updates (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('program', 'insight', 'newsletter', 'notice')),
  title text not null check (char_length(title) between 1 and 200),
  url text not null default '',
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

alter table public.site_updates enable row level security;

-- 로그인한 사람은 누구나 읽는다 (승인 대기 중이어도 소식은 보게)
drop policy if exists "updates_select_authed" on public.site_updates;
create policy "updates_select_authed" on public.site_updates
  for select to authenticated using (true);

-- 등록·삭제는 운영진만 (is_admin() 은 migration-members.sql 에서 생성됨)
drop policy if exists "updates_insert_admin" on public.site_updates;
create policy "updates_insert_admin" on public.site_updates
  for insert to authenticated with check (public.is_admin());

drop policy if exists "updates_delete_admin" on public.site_updates;
create policy "updates_delete_admin" on public.site_updates
  for delete to authenticated using (public.is_admin());

-- Insights 새 글이 올라오면 자동으로 소식에 추가
create or replace function public.log_insight_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.site_updates (kind, title, url, created_by)
  values ('insight', new.title, '/insights/post.html?no=' || new.board_no, new.author_id);
  return new;
end $$;

drop trigger if exists on_insight_post_created on public.insight_posts;
create trigger on_insight_post_created
  after insert on public.insight_posts
  for each row execute function public.log_insight_update();
