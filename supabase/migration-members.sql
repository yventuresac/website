-- ─────────────────────────────────────────────────────────────
-- Y-VENTURES 학회원 시스템 1단계: 기수·등급 기반
-- 실행 방법: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
-- 선행 조건: migration-insights.sql (profiles 테이블·가입 트리거 사용)
--
-- 이 단계가 만드는 것
--   1) profiles 확장: email / generation(기수) / is_alumni
--   2) 운영진이 전체 회원을 조회·승인할 수 있는 정책
--   3) 가입 폼의 기수 선택값을 프로필에 옮기는 트리거 갱신
-- ─────────────────────────────────────────────────────────────

-- 0. 관리자 판별 함수
-- profiles 의 정책이 profiles 자신을 조회하면 무한 재귀가 난다(Postgres RLS 특성).
-- security definer 함수는 소유자 권한으로 돌아 RLS 를 타지 않으므로 재귀가 끊긴다.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- 1. profiles 확장
-- email: auth.users 는 브라우저에서 못 읽는다. 권한 관리 화면에서 누가 누군지
--        알아야 하므로 프로필에 복사해 둔다.
-- generation: 기수. 자료실·알럼 정리의 축이라 이것 없이는 다음 단계가 성립하지 않는다.
-- is_alumni: 현역/알럼 구분. 알럼도 is_member 는 유지한다(자료실·글쓰기 접근).
alter table public.profiles
  add column if not exists email      text not null default '',
  add column if not exists generation int,
  add column if not exists is_alumni  boolean not null default false;

comment on column public.profiles.generation is '기수. 가입 시 본인 선택 → 운영진 승인 화면에서 확정';

-- 기존 가입자 email 백필
update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id and (p.email = '' or p.email is null);

-- 2. 가입 트리거 갱신: email 과 기수 선택값을 함께 저장
-- 기수는 본인 신고값일 뿐이다. is_member 승인은 운영진이 화면에서 한다.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, email, generation)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.email, ''),
    case when coalesce(new.raw_user_meta_data->>'generation', '') ~ '^[0-9]+$'
         then (new.raw_user_meta_data->>'generation')::int
         else null
    end
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- 3. 운영진 정책
-- select 정책은 OR 로 합쳐지므로 기존 profiles_select_own 은 그대로 두고 추가만 한다.
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select using (public.is_admin());

-- 승인·기수 지정·등급 변경은 운영진만. 일반 사용자용 update 정책은 열지 않는다 —
-- 열면 자기 is_admin 을 스스로 켤 수 있다.
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 실행 후 확인 (SQL Editor 에서)
--   select email, display_name, generation, is_member, is_alumni, is_admin
--   from public.profiles order by created_at desc;
-- ─────────────────────────────────────────────────────────────
