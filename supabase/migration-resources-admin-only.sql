-- ─────────────────────────────────────────────────────────────
-- 자료실 등록 권한을 운영진으로 좁힌다
-- 실행 방법: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
--
-- 읽기는 그대로 학회원 전원, 수정·삭제도 그대로(본인 또는 운영진).
-- 등록만 운영진으로 제한한다. 페이지에서도 학회원에게는 등록 폼을
-- 그리지 않지만, 실제 차단은 이 정책이 한다.
-- ─────────────────────────────────────────────────────────────

drop policy if exists "resources_insert_member" on public.resources;
drop policy if exists "resources_insert_admin"  on public.resources;

create policy "resources_insert_admin" on public.resources
  for insert with check (public.is_admin() and auth.uid() = author_id);

-- 확인 — resources 의 insert 정책이 하나만, is_admin() 기준으로 남아야 한다
select policyname, cmd, with_check
from pg_policies
where schemaname = 'public' and tablename = 'resources' and cmd = 'INSERT';
