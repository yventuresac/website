-- ─────────────────────────────────────────────────────────────
-- Insights 대표 이미지 지정 (2026-09-06) — 조민서·이윤민
-- 실행 방법: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
--
-- 파일은 assets/insights/covers/<글번호>.jpg 로 사이트에 들어 있다.
-- 절대 주소로 넣는 이유: 카톡·슬랙 공유 카드 봇은 상대 경로를 못 읽는다.
-- (김수안 39 · 유하재 35 · 정보권 36 은 이미 지정돼 있어 뺐다)
-- ─────────────────────────────────────────────────────────────

update public.insight_posts set cover_url = 'https://www.yventures.ac/assets/insights/covers/33.jpg' where board_no = 33;  -- 조민서 · 2026 커머스 미디어 전망
update public.insight_posts set cover_url = 'https://www.yventures.ac/assets/insights/covers/34.jpg' where board_no = 34;  -- 이윤민 · 차세대 의료 현장을 이끌 AI 헬스케어

-- 확인
select board_no, title, cover_url from public.insight_posts where board_no in (33, 34) order by board_no;
