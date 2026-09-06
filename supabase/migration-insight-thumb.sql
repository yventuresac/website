-- ─────────────────────────────────────────────────────────────
-- Insights 목록 썸네일 (thumb_url) — 본문 첫 이미지
-- 실행 방법: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
--
-- cover_url 은 작성자가 고른 대표 이미지(제목이 얹히는 히어로).
-- thumb_url 은 본문의 첫 이미지 — 목록 카드와 링크 공유 카드에만 쓴다.
-- 옛 imweb 글 37편은 본문 안에 이미지가 있어서 이걸로 목록이 채워진다.
-- 새 글은 등록·수정 때 편집기가 첫 이미지를 넣어 준다.
-- ─────────────────────────────────────────────────────────────

alter table public.insight_posts add column if not exists thumb_url text;

-- 본문 첫 <img src="..."> 를 뽑아 채운다 (이미 있으면 건너뜀)
update public.insight_posts
set thumb_url = substring(content_html from '<img[^>]*src="([^"]+)"')
where thumb_url is null
  and content_html ~ '<img[^>]*src="';

-- 확인 — 채워진 수 / 전체
select count(thumb_url) as with_thumb, count(*) as total from public.insight_posts;
