-- ─────────────────────────────────────────────────────────────
-- 학회 캘린더 (calendar_events) — 허브의 일정 캘린더
-- 실행 방법: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
--
-- 규칙 (2026-09-02 합의):
--   · 등록: 학회원 누구나 / 수정·삭제: 본인 것만, 운영진은 전체
--   · 운영진이 등록한 일정만 벨 알림(site_updates)으로 나간다
--   · detail 의 @태그는 mentions(jsonb)에 [{id,name}]으로 함께 저장
-- ─────────────────────────────────────────────────────────────

create table if not exists public.calendar_events (
  id bigint generated always as identity primary key,
  category text not null check (category in ('study', 'project', 'event', 'insight', 'reading', 'break')),
  event_type text not null default '',   -- 행사일 때만: vc-career/boost/y-startup/networking
  title text not null check (char_length(title) between 1 and 200),
  detail text not null default '',
  starts_on date not null,
  time_text text not null default '',    -- "19:00" 같은 자유 표기
  mentions jsonb not null default '[]',
  author_id uuid references auth.users on delete set null,
  author_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists calendar_events_date_idx on public.calendar_events (starts_on);

alter table public.calendar_events enable row level security;

drop policy if exists "cal_select_member" on public.calendar_events;
create policy "cal_select_member" on public.calendar_events
  for select using (public.is_member_or_admin());

drop policy if exists "cal_insert_member" on public.calendar_events;
create policy "cal_insert_member" on public.calendar_events
  for insert with check (auth.uid() = author_id and public.is_member_or_admin());

drop policy if exists "cal_update_own" on public.calendar_events;
create policy "cal_update_own" on public.calendar_events
  for update using (auth.uid() = author_id or public.is_admin());

drop policy if exists "cal_delete_own" on public.calendar_events;
create policy "cal_delete_own" on public.calendar_events
  for delete using (auth.uid() = author_id or public.is_admin());

-- @태그 자동완성용 학회원 이름 목록.
-- profiles 는 본인+운영진만 읽을 수 있어서(이메일 등 보호) 이름·기수만
-- 내주는 definer 함수를 따로 둔다. 호출자가 학회원일 때만 응답한다.
create or replace function public.list_member_names()
returns table (id uuid, display_name text, generation int)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.generation
  from public.profiles p
  where (p.is_member or p.is_admin)
    and p.display_name <> ''
    and public.is_member_or_admin()
  order by p.display_name;
$$;

-- 운영진이 등록한 일정은 벨 알림으로도 나간다 (학회원 일정은 조용히)
create or replace function public.log_calendar_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles p where p.id = new.author_id and p.is_admin) then
    insert into public.site_updates (kind, title, url, created_by)
    values ('notice',
            '[일정] ' || to_char(new.starts_on, 'MM/DD') || ' ' || new.title,
            '/members/', new.author_id);
  end if;
  return new;
end $$;

drop trigger if exists on_calendar_event_created on public.calendar_events;
create trigger on_calendar_event_created
  after insert on public.calendar_events
  for each row execute function public.log_calendar_update();
