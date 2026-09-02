-- ─────────────────────────────────────────────────────────────
-- 알림 읽음 기록 (update_reads) — 네비 벨 알림
-- 실행 방법: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
--
-- site_updates(새 소식)를 계정별로 "읽었는지" 기록한다.
-- localStorage 가 아니라 DB 에 두는 이유: 같은 계정이면 다른 기기에서도
-- 이미 본 알림이 다시 뜨지 않아야 하니까.
--
-- 읽음 처리 시점 (프론트가 기록):
--   · 벨 드롭다운을 열면 → 전체 읽음
--   · 해당 구역 페이지를 방문하면 → 그 구역 알림만 읽음
-- ─────────────────────────────────────────────────────────────

create table if not exists public.update_reads (
  user_id   uuid   not null references auth.users on delete cascade,
  update_id bigint not null references public.site_updates on delete cascade,
  read_at   timestamptz not null default now(),
  primary key (user_id, update_id)
);

alter table public.update_reads enable row level security;

-- 본인 기록만 읽고 쓴다
drop policy if exists "reads_select_own" on public.update_reads;
create policy "reads_select_own" on public.update_reads
  for select using (auth.uid() = user_id);

drop policy if exists "reads_insert_own" on public.update_reads;
create policy "reads_insert_own" on public.update_reads
  for insert with check (auth.uid() = user_id);
