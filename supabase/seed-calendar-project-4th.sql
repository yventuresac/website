-- ─────────────────────────────────────────────────────────────
-- 4기 Project Session 일정 시딩 (2026-10-27 ~ 2026-12-01)
-- 실행 방법: migration-calendar.sql 실행 후 → SQL Editor 에서 Run
--
-- 원안의 미정·(?) 표기는 TBD 로 통일.
-- 11/14 VC&Startup Networking Party 는 프로젝트 세션이 아니라 행사로 분류.
-- 다시 실행해도 안전: 같은 범위의 '운영진 시드' 행을 지우고 새로 넣는다.
-- ─────────────────────────────────────────────────────────────

alter table public.calendar_events disable trigger on_calendar_event_created;

delete from public.calendar_events
where author_name = '운영진'
  and category in ('project', 'event')
  and starts_on between '2026-10-27' and '2026-12-01';

insert into public.calendar_events
  (category, event_type, title, detail, starts_on, time_text, author_id, author_name)
select v.cat, v.etype, v.title, v.detail, v.d::date, '',
       (select id from auth.users where email = 'jbk092000@gmail.com'), '운영진'
from (values
  ('project', '',           'W1 D1 · 투심 보고서 킥오프 세션',            '2H',            '2026-10-27'),
  ('project', '',           'W1 D2 · 딜소싱 킥오프 세션 (TBD)',           '3H',            '2026-10-31'),
  ('project', '',           'W2 D1 · 연사 세션',                          '2H',            '2026-11-03'),
  ('project', '',           'W2 D2 · TBD',                                '3H',            '2026-11-07'),
  ('project', '',           'W3 D1 · 딜소싱 중간점검 세션',               '2H',            '2026-11-10'),
  ('event',   'networking', 'VC&Startup Networking Party',                'W3 D2 · 3H',    '2026-11-14'),
  ('project', '',           'W4 D1 · 연사 세션 — 박상우 심사역님 (계획)', '2H',            '2026-11-17'),
  ('project', '',           'W4 D2 · 투심보고서 중간 점검 (TBD)',         '3H',            '2026-11-21'),
  ('project', '',           'W5 D1 · 투심 최종 세션',                     '2H',            '2026-11-24'),
  ('project', '',           'W5 D2 · 딜소싱 최종 발표 (알럼 초대 TBD)',   '3H',            '2026-11-28'),
  ('project', '',           'W6 D1 · 사진 / 회장 선거',                   '2H',            '2026-12-01')
) as v(cat, etype, title, detail, d);

alter table public.calendar_events enable trigger on_calendar_event_created;

-- 확인
select starts_on, category, title from public.calendar_events
where starts_on between '2026-10-27' and '2026-12-01' order by starts_on;
