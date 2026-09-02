-- ─────────────────────────────────────────────────────────────
-- 4기 Study Session 일정 시딩 (2026-09-01 ~ 2026-10-10)
-- 실행 방법: migration-calendar.sql 실행 후 → SQL Editor 에서 Run
--
-- 다시 실행해도 안전하다: 같은 범위의 '운영진 시드' 행을 지우고 새로 넣는다.
-- 벨 알림 트리거는 잠시 꺼서 12건이 한꺼번에 알림으로 쏟아지지 않게 한다.
-- 작성자는 회장 계정으로 잡아 화면에서 수정·삭제할 수 있게 한다.
-- ─────────────────────────────────────────────────────────────

alter table public.calendar_events disable trigger on_calendar_event_created;

-- 재실행 대비: 이 시드가 넣은 행만 정리
delete from public.calendar_events
where author_name = '운영진'
  and category = 'study'
  and starts_on between '2026-09-01' and '2026-10-10';

insert into public.calendar_events
  (category, event_type, title, detail, starts_on, time_text, author_id, author_name)
select 'study', '', v.title, v.detail, v.d::date, v.t,
       (select id from auth.users where email = 'jbk092000@gmail.com'), '운영진'
from (values
  ('1회차 · OT',                          '로드맵·커리큘럼 오버뷰 + 리딩멤버 담당 기업 소개 + 뒷풀이 · 경영관 403', '2026-09-01', ''),
  ('2회차 · 더벤처스 조여준 연사님 강연',  '장소: 더벤처스',                                                        '2026-09-05', '13:00'),
  ('3회차 · 시장·산업 분석',               '경영관 403',                                                            '2026-09-08', ''),
  ('4회차 · 기업 분석',                    '경영관 403',                                                            '2026-09-12', ''),
  ('5회차 · 중간 공유',                    '팀별 시장·기업 분석 발표 + Q&A + Activity · 경영관 405',                '2026-09-15', ''),
  ('6회차 · 밸류에이션',                   '1~2시간 진행',                                                          '2026-09-19', ''),
  ('7회차 · 밸류에이션 + 투심보고서 종합', '',                                                                      '2026-09-22', ''),
  ('휴회 — 추석',                          '각 리드가 팀 작업이 진행되게 트래킹',                                   '2026-09-26', ''),
  ('8회차 · 투심보고서 작업',              '관련 액티비티 구성',                                                    '2026-09-29', ''),
  ('휴회 — 연고전',                        '각 리드가 팀 작업이 진행되게 트래킹',                                   '2026-10-03', ''),
  ('9회차 · 리허설',                       '발표 점검 + 본인 스탠스 확정 · 모든 팀 장표 밀착 확인',                '2026-10-06', ''),
  ('10회차 · 최종 발표 + 알럼 네트워킹',   '알럼 초청 · 최대한 많은 피드백과 참여',                                 '2026-10-10', '')
) as v(title, detail, d, t);

alter table public.calendar_events enable trigger on_calendar_event_created;

-- 확인
select starts_on, time_text, title from public.calendar_events
where starts_on between '2026-09-01' and '2026-10-10' order by starts_on;
