-- ─────────────────────────────────────────────────────────────
-- 캘린더 분류 추가 — Insight Posting / 독서 / 휴회
-- 실행 방법: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
--
-- calendar_events.category 의 체크 제약이 study/project/event 만
-- 허용하고 있어서, 새 분류로 저장하면 DB가 거부한다. 제약을 다시 건다.
-- ─────────────────────────────────────────────────────────────

alter table public.calendar_events
  drop constraint if exists calendar_events_category_check;

alter table public.calendar_events
  add constraint calendar_events_category_check
  check (category in ('study', 'project', 'event', 'insight', 'reading', 'break'));

-- 확인
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.calendar_events'::regclass
  and conname = 'calendar_events_category_check';
