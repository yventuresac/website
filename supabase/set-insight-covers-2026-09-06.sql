-- ─────────────────────────────────────────────────────────────
-- Insights 대표 이미지 지정 (2026-09-06) — 김수안·유하재·정보권
-- 실행 방법: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
--
-- 파일은 assets/insights/covers/<글번호>.jpg 로 사이트에 들어 있다.
-- 절대 주소로 넣는 이유: 카톡·슬랙 공유 카드 봇은 상대 경로를 못 읽는다.
-- ─────────────────────────────────────────────────────────────

update public.insight_posts set cover_url = 'https://www.yventures.ac/assets/insights/covers/39.jpg' where board_no = 39;  -- 김수안 · 항공사는 화폐를 발행한다
update public.insight_posts set cover_url = 'https://www.yventures.ac/assets/insights/covers/35.jpg' where board_no = 35;  -- 유하재 · AI 시대 진정한 문제
update public.insight_posts set cover_url = 'https://www.yventures.ac/assets/insights/covers/36.jpg' where board_no = 36;  -- 정보권 · Think Big, Buy Small
update public.insight_posts set cover_url = 'https://www.yventures.ac/assets/insights/covers/33.jpg' where board_no = 33;  -- 조민서 · 2026 커머스 미디어 전망

-- 확인
select board_no, title, cover_url from public.insight_posts where board_no in (33, 35, 36, 39) order by board_no;
