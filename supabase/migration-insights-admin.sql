-- ─────────────────────────────────────────────────────────────
-- Insights 작성 권한 확장 — 학회원뿐 아니라 운영진도 글을 쓸 수 있게
-- 실행 방법: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
--
-- 기존 정책은 is_member 만 봤다. 운영진인데 학회원 체크가 없는 계정은
-- 글 등록과 에디터 이미지 업로드가 막혔다. 둘 다
-- is_member_or_admin() (migration-resources.sql 에서 생성)으로 바꾼다.
-- ─────────────────────────────────────────────────────────────

-- 글 등록
drop policy if exists "posts_insert_member" on public.insight_posts;
create policy "posts_insert_member" on public.insight_posts
  for insert with check (
    auth.uid() = author_id
    and public.is_member_or_admin()
  );

-- 에디터 이미지 업로드
drop policy if exists "insight_images_upload_member" on storage.objects;
create policy "insight_images_upload_member" on storage.objects
  for insert with check (
    bucket_id = 'insight-images'
    and public.is_member_or_admin()
  );
