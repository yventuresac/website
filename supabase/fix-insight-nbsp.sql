-- ─────────────────────────────────────────────────────────────
-- Insights 본문의 &nbsp; 정리 (한 번만 실행)
-- 실행 방법: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
--
-- 편집기(Quill)가 띄어쓰기를 전부 &nbsp; 로 저장해 왔다. 그러면 브라우저가 줄을 못 바꿔
-- 단어 한가운데서 잘린다. 글자 사이의 &nbsp; 를 보통 띄어쓰기로 되돌린다.
-- 연속 공백(&nbsp;&nbsp;)은 첫 번째만 바꿔 들여쓰기 의도는 남긴다.
-- 게시 화면은 어차피 렌더 때 같은 처리를 하므로, 이건 DB 를 깨끗이 하는 용도.
-- ─────────────────────────────────────────────────────────────

update public.insight_posts
set content_html = regexp_replace(content_html, '(\S)&nbsp;(?=\S)', '\1 ', 'g')
where content_html like '%&nbsp;%';

-- 임시저장 본문(Delta)은 텍스트 그대로라 손댈 것 없음

-- 확인 — 남은 &nbsp; 는 연속 공백뿐이어야 한다
select board_no, length(content_html) - length(replace(content_html, '&nbsp;', '')) as nbsp_chars
from public.insight_posts
where content_html like '%&nbsp;%'
order by board_no desc;
