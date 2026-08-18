-- ─────────────────────────────────────────────────────────────
-- Y-VENTURES 다운로드 클릭 집계
-- 실행 방법: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
-- 선행 조건: migration-insights.sql (profiles 테이블 사용)
--
-- Vercel Web Analytics 의 커스텀 이벤트는 Pro 전용이라 무료로는 쓸 수 없다.
-- 이미 쓰고 있는 Supabase 로 같은 일을 한다. Insights 조회수(increment_insight_view)와
-- 동일한 방식이다.
--
-- 세는 것은 '클릭'이지 '다운로드 완료'가 아니다. 눌렀다가 취소해도 1 이 오른다.
-- ─────────────────────────────────────────────────────────────

-- (slug, label) 이 함께 키다. slug 만 키로 두면 상단/하단을 눌러도 같은 행에
-- 합산돼 버튼 위치별 비교가 불가능해진다.
create table if not exists public.download_counts (
  slug       text not null,             -- 무엇을 받았는지. 예: application-form-2026fall
  label      text not null default '',  -- 어디서 눌렀는지. 예: 상단 / 하단
  count      bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (slug, label)
);

comment on table  public.download_counts is '파일 다운로드 버튼 클릭 수. 개인을 식별하는 정보는 담지 않는다.';
comment on column public.download_counts.label is '같은 파일이라도 버튼 위치별로 나눠 세기 위한 구분값';

-- 로그인하지 않은 방문자도 눌러야 하므로 definer 함수로만 열어둔다.
-- 테이블에 insert/update 정책을 직접 열면 아무나 숫자를 조작할 수 있다.
create or replace function public.increment_download(p_slug text, p_label text default '')
returns void language sql security definer set search_path = public as $$
  insert into public.download_counts (slug, label, count)
  values (p_slug, coalesce(p_label, ''), 1)
  on conflict (slug, label) do update
    set count = download_counts.count + 1,
        updated_at = now();
$$;

alter table public.download_counts enable row level security;

-- 집계 수치는 관리자만 본다. 경쟁 학회에 지원 현황을 보여줄 이유가 없다.
drop policy if exists "downloads_select_admin" on public.download_counts;
create policy "downloads_select_admin" on public.download_counts
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- ─────────────────────────────────────────────────────────────
-- 확인 방법 (SQL Editor 에서)
--   select slug, label, count, updated_at from public.download_counts order by count desc;
-- ─────────────────────────────────────────────────────────────
