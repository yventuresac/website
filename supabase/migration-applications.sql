-- ─────────────────────────────────────────────────────────────
-- Y-VENTURES 학회원 시스템 3단계: Tally 지원서 통합
-- 실행 방법: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
-- 선행 조건: migration-members.sql (is_admin() 사용)
--
-- 접수는 Tally 가 그대로 받는다. 지원자 앞에 회원가입을 세우면 지원이 줄기
-- 때문. Tally webhook 이 응답을 이 테이블로 복사하고, 사이트는
--   운영진  → 전체 열람·상태 변경
--   지원자  → 로그인 이메일과 지원서 이메일이 같은 건만 조회
-- 만 담당한다.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.applications (
  id               bigint generated always as identity primary key,
  program          text not null,               -- webhook 주소의 ?program= 값. 예: boost-4
  submission_id    text not null unique,        -- Tally 응답 ID. 재전송이 와도 중복 저장을 막는다
  applicant_email  text not null default '',
  applicant_name   text not null default '',
  team_name        text not null default '',
  status           text not null default 'received',
  marketing_opt_in boolean not null default false, -- '추후 프로그램 안내' 선택 동의 (폼에 추가 예정)
  payload          jsonb not null default '{}'::jsonb, -- Tally 응답 전체. 폼이 바뀌어도 여기엔 다 남는다
  submitted_at     timestamptz,
  created_at       timestamptz not null default now(),
  constraint applications_status_check check (status in
    ('received',   -- 접수됨
     'docs_pass',  -- 서류 통과
     'interview',  -- 면접 대상
     'accepted',   -- 최종 선정
     'rejected'))  -- 미선정
);

create index if not exists idx_applications_program on public.applications (program, created_at desc);
create index if not exists idx_applications_email on public.applications (lower(applicant_email));

alter table public.applications enable row level security;

-- 운영진: 전체 열람·상태 변경
drop policy if exists "applications_select_admin" on public.applications;
create policy "applications_select_admin" on public.applications
  for select using (public.is_admin());

drop policy if exists "applications_update_admin" on public.applications;
create policy "applications_update_admin" on public.applications
  for update using (public.is_admin()) with check (public.is_admin());

-- 지원자: 로그인 이메일이 지원서 이메일과 같은 행만.
-- 이메일은 Supabase 가 확인(인증 메일)한 값이라 사칭으로 남의 지원서를 볼 수 없다.
drop policy if exists "applications_select_own" on public.applications;
create policy "applications_select_own" on public.applications
  for select using (
    lower(applicant_email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

-- insert 정책은 없다. 적재는 webhook(service_role)만 하며 service_role 은 RLS 를 우회한다.

-- ─────────────────────────────────────────────────────────────
-- 실행 후 할 일
-- 1) Vercel 환경변수 (Settings → Environments → Production)
--      SUPABASE_SERVICE_ROLE_KEY  ← Supabase → Project Settings → API 의 service_role
--      TALLY_WEBHOOK_TOKEN        ← 아무 긴 무작위 문자열 (webhook 주소 검증용)
-- 2) Tally 폼 → Integrations → Webhooks 에 주소 등록:
--      https://www.yventures.ac/api/tally-webhook?program=boost-4&token=<위 토큰>
--    폼마다 program 값만 바꿔 단다. 예: y-startup-3, recruit-5
-- ─────────────────────────────────────────────────────────────
