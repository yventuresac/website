-- ─────────────────────────────────────────────────────────────
-- Insights 글 머리 정보 — 대표 이미지 · 부제 · 태그
-- 실행 방법: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
--
--   cover_url  글 상단에 깔리는 사진(그 위에 제목). insight-images 버킷 주소
--   subtitle   제목 아래 한 줄 요약
--   tags       태그 몇 개 (text[]), 예: {'핀테크','시드'}
-- 임시저장(insight_drafts)에도 같은 칸을 둔다.
-- ─────────────────────────────────────────────────────────────

alter table public.insight_posts  add column if not exists cover_url text;
alter table public.insight_posts  add column if not exists subtitle  text not null default '';
alter table public.insight_posts  add column if not exists tags      text[] not null default '{}';

alter table public.insight_drafts add column if not exists cover_url text;
alter table public.insight_drafts add column if not exists subtitle  text not null default '';
alter table public.insight_drafts add column if not exists tags      text[] not null default '{}';

-- 확인
select table_name, column_name
from information_schema.columns
where table_schema = 'public' and column_name in ('cover_url', 'subtitle', 'tags')
order by table_name, column_name;
