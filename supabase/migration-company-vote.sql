-- ─────────────────────────────────────────────────────────────
-- 투심 보고서 분석 기업 투표 (company_votes)
-- 실행 방법: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
--
-- 스터디 세션에서 팀별로 분석할 기업을 학회원 투표로 고른다.
-- 한 사람이 1·2·3지망을 한 번에 제출하고, 마감 전까지는 고쳐 쓸 수 있다.
-- 남의 표는 못 본다 — 운영진만 전체를 읽어 결과를 낸다.
--
-- 마감(2026-09-04 금요일 자정, KST)은 정책에 박혀 있다. 다음 투표에 다시 쓰려면
-- 아래 DEADLINE 두 군데와 members/vote.html 의 DEADLINE 을 같이 바꿀 것.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.company_votes (
  user_id    uuid primary key references auth.users on delete cascade,
  first      text not null,
  second     text not null,
  third      text not null,
  updated_at timestamptz not null default now(),
  constraint company_votes_distinct check (first <> second and second <> third and first <> third)
);

alter table public.company_votes enable row level security;

-- 읽기: 본인 것, 운영진은 전체
drop policy if exists "company_votes_select" on public.company_votes;
create policy "company_votes_select" on public.company_votes
  for select using (auth.uid() = user_id or public.is_admin());

-- 쓰기: 학회원 본인, 마감 전까지만
drop policy if exists "company_votes_insert" on public.company_votes;
create policy "company_votes_insert" on public.company_votes
  for insert with check (
    auth.uid() = user_id
    and public.is_member_or_admin()
    and now() < timestamptz '2026-09-05 00:00:00+09'   -- DEADLINE
  );

drop policy if exists "company_votes_update" on public.company_votes;
create policy "company_votes_update" on public.company_votes
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and public.is_member_or_admin()
    and now() < timestamptz '2026-09-05 00:00:00+09'   -- DEADLINE
  );

-- 벨 알림 — 학회원 전원에게 투표 페이지로 가는 알림을 띄운다
insert into public.site_updates (kind, title, url)
values ('notice', '[투표] 투심 보고서 분석 기업 투표 — 9/4(금) 자정까지', '/members/vote.html');

-- 확인
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'company_votes';
