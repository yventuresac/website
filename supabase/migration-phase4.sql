-- ─────────────────────────────────────────────────────────────
-- Y-VENTURES 학회원 시스템 4단계: 활동 기록 · 과제 제출 · 알럼 디렉터리
-- 실행 방법: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
-- 선행 조건: migration-members.sql, migration-resources.sql
-- ─────────────────────────────────────────────────────────────

-- 0. 프로필에 소속·직무 (알럼 디렉터리 표시용)
alter table public.profiles
  add column if not exists company   text not null default '',
  add column if not exists job_title text not null default '';

-- 본인이 직접 고친다. profiles 의 update 정책은 운영진 전용이므로(자기 is_admin
-- 을 켜는 것을 막기 위해) 이 두 컬럼만 여는 definer 함수로 우회한다.
create or replace function public.update_my_career(p_company text, p_job_title text)
returns void language sql security definer set search_path = public as $$
  update public.profiles
     set company   = coalesce(p_company, company),
         job_title = coalesce(p_job_title, job_title)
   where id = auth.uid();
$$;

-- 알럼 목록. 학회원에게 profiles 행을 직접 열면 이메일까지 노출되므로
-- (RLS 는 행 단위라 컬럼을 못 가린다) 안전한 컬럼만 돌려주는 함수로 연다.
create or replace function public.list_alumni()
returns table (id uuid, display_name text, generation int, company text, job_title text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.generation, p.company, p.job_title
    from public.profiles p
   where p.is_alumni
     and public.is_member_or_admin()   -- 학회원이 아니면 빈 결과
   order by p.generation nulls last, p.display_name;
$$;

-- 1. 활동 기록 — 본인 이력 관리용
create table if not exists public.activity_records (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users on delete cascade,
  title      text not null check (char_length(title) between 1 and 200),  -- 예: Y-Startup 3기
  role       text not null default '',                                    -- 예: 운영팀 리드
  period     text not null default '',                                    -- 예: 2026.01 ~ 2026.02
  note       text not null default '',
  created_at timestamptz not null default now()
);

alter table public.activity_records enable row level security;

drop policy if exists "activity_own" on public.activity_records;
create policy "activity_own" on public.activity_records
  for all using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id);

-- 2. 과제 — 운영진이 내고 학회원이 링크로 제출한다 (자료실과 같은 링크 중심)
create table if not exists public.assignments (
  id          bigint generated always as identity primary key,
  title       text not null check (char_length(title) between 1 and 200),
  detail_url  text not null default '',   -- 과제 설명 노션 등
  generation  int,                        -- null = 전 기수
  due_date    date,
  created_by  uuid references auth.users on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.assignment_submissions (
  id            bigint generated always as identity primary key,
  assignment_id bigint not null references public.assignments on delete cascade,
  user_id       uuid not null references auth.users on delete cascade,
  author_name   text not null default '',
  url           text not null,
  note          text not null default '',
  submitted_at  timestamptz not null default now(),
  unique (assignment_id, user_id)         -- 재제출은 갱신으로 처리
);

alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;

drop policy if exists "assignments_select_member" on public.assignments;
create policy "assignments_select_member" on public.assignments
  for select using (public.is_member_or_admin());

drop policy if exists "assignments_write_admin" on public.assignments;
create policy "assignments_write_admin" on public.assignments
  for all using (public.is_admin()) with check (public.is_admin());

-- 제출물: 본인 것 등록·갱신·조회, 운영진은 전체 조회
drop policy if exists "submissions_select" on public.assignment_submissions;
create policy "submissions_select" on public.assignment_submissions
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "submissions_upsert_own" on public.assignment_submissions;
create policy "submissions_upsert_own" on public.assignment_submissions
  for insert with check (auth.uid() = user_id and public.is_member_or_admin());

drop policy if exists "submissions_update_own" on public.assignment_submissions;
create policy "submissions_update_own" on public.assignment_submissions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. 알럼 연결 요청 — 연락처는 공개하지 않고 학회가 중간에서 전달한다
create table if not exists public.contact_requests (
  id            bigint generated always as identity primary key,
  requester_id  uuid not null references auth.users on delete cascade,
  requester_name text not null default '',
  target_id     uuid not null references auth.users on delete cascade,
  message       text not null check (char_length(message) between 1 and 500),
  status        text not null default 'pending',  -- pending → relayed(전달됨) / declined
  created_at    timestamptz not null default now(),
  constraint contact_status_check check (status in ('pending', 'relayed', 'declined'))
);

alter table public.contact_requests enable row level security;

drop policy if exists "contact_insert_member" on public.contact_requests;
create policy "contact_insert_member" on public.contact_requests
  for insert with check (auth.uid() = requester_id and public.is_member_or_admin());

drop policy if exists "contact_select" on public.contact_requests;
create policy "contact_select" on public.contact_requests
  for select using (auth.uid() = requester_id or public.is_admin());

drop policy if exists "contact_update_admin" on public.contact_requests;
create policy "contact_update_admin" on public.contact_requests
  for update using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 실행 후 확인
--   select public.list_alumni();
-- ─────────────────────────────────────────────────────────────
