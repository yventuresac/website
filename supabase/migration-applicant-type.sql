-- ─────────────────────────────────────────────────────────────
-- 지원서 '구분'(창업가 / 학생) 저장용 열
-- 실행 방법: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
-- 선행 조건: migration-applications.sql
--
-- 관리자 화면은 응답 내용으로 창업가/학생을 먼저 추정해 보여주고,
-- 운영진이 드롭다운으로 고르면 그 값을 여기에 저장한다.
--   founder = 창업 경험이 있거나 지금 구체적으로 준비·진행 중
--   student = 관심 단계 ("해볼까?" 수준)
--   null    = 아직 아무도 고르지 않음 (화면에는 추정값이 '추정'으로 표시)
-- 수정 권한은 기존 applications_update_admin 정책을 그대로 쓴다.
-- ─────────────────────────────────────────────────────────────

alter table public.applications add column if not exists applicant_type text;

alter table public.applications drop constraint if exists applications_applicant_type_check;
alter table public.applications add constraint applications_applicant_type_check
  check (applicant_type is null or applicant_type in ('founder', 'student'));
