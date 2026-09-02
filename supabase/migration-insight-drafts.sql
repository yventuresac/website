-- ─────────────────────────────────────────────────────────────
-- Insights 임시저장 (insight_drafts)
-- 실행 방법: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
--
-- 쓰다 만 글을 계정에 붙여 둔다 — 노트북에서 쓰다가 학교 컴퓨터에서
-- 이어쓸 수 있게. 한 사람당 한 개(작성 중인 글은 하나라는 전제).
-- 본문은 Quill Delta 를 그대로 담는다(HTML 로 되돌리면 서식이 어긋난다).
-- 이미지는 이미 Storage 주소라 용량은 글자 수준이다.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.insight_drafts (
  user_id    uuid primary key references auth.users on delete cascade,
  title      text not null default '',
  delta      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.insight_drafts enable row level security;

-- 남의 초고는 누구도 볼 수 없다. 본인 것만 읽고 쓰고 지운다.
drop policy if exists "insight_drafts_own" on public.insight_drafts;
create policy "insight_drafts_own" on public.insight_drafts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 확인 — 로그인 상태에서 select 하면 본인 행만(없으면 0행) 나와야 한다
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'insight_drafts';
