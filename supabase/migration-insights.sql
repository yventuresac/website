-- ─────────────────────────────────────────────────────────────
-- Y-VENTURES Insights 게시판 스키마
-- 실행 방법: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
-- ─────────────────────────────────────────────────────────────

-- 1. 프로필 (가입자 1:1, 학회원 승인 플래그)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default '',
  is_member boolean not null default false,   -- 관리자가 true 로 바꾸면 글 작성 가능
  is_admin  boolean not null default false,
  created_at timestamptz not null default now()
);

-- 가입 시 프로필 자동 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 기존 가입자 백필
insert into public.profiles (id, display_name)
select id, coalesce(raw_user_meta_data->>'full_name', '') from auth.users
on conflict (id) do nothing;

-- 2. 게시글
create table if not exists public.insight_posts (
  id bigint generated always as identity primary key,
  board_no int unique not null,               -- 목록 번호 (기존 1~39 유지, 새 글은 max+1)
  title text not null check (char_length(title) between 1 and 300),
  author_name text not null,
  author_id uuid references auth.users on delete set null,
  content_html text not null,
  view_count int not null default 0,
  created_at timestamptz not null default now()
);

-- 3. 좋아요 (계정당 글 하나에 1개)
create table if not exists public.insight_likes (
  post_id bigint references public.insight_posts on delete cascade,
  user_id uuid references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- 4. 댓글
create table if not exists public.insight_comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.insight_posts on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  author_name text not null,
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default now()
);

-- 5. 조회수 증가 (누구나 호출 가능, 1씩만)
create or replace function public.increment_insight_view(p_post_id bigint)
returns void language sql security definer set search_path = public as $$
  update public.insight_posts set view_count = view_count + 1 where id = p_post_id;
$$;

-- 6. RLS
alter table public.profiles enable row level security;
alter table public.insight_posts enable row level security;
alter table public.insight_likes enable row level security;
alter table public.insight_comments enable row level security;

-- 프로필: 본인 것만 조회 (is_member 확인용)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

-- 게시글: 누구나 읽기 / 학회원만 쓰기 / 본인 또는 관리자만 수정·삭제
drop policy if exists "posts_select_all" on public.insight_posts;
create policy "posts_select_all" on public.insight_posts
  for select using (true);

drop policy if exists "posts_insert_member" on public.insight_posts;
create policy "posts_insert_member" on public.insight_posts
  for insert with check (
    auth.uid() = author_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_member)
  );

drop policy if exists "posts_update_own" on public.insight_posts;
create policy "posts_update_own" on public.insight_posts
  for update using (
    auth.uid() = author_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

drop policy if exists "posts_delete_own" on public.insight_posts;
create policy "posts_delete_own" on public.insight_posts
  for delete using (
    auth.uid() = author_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- 좋아요: 누구나 읽기 / 로그인 사용자 본인 명의로만 추가·취소
drop policy if exists "likes_select_all" on public.insight_likes;
create policy "likes_select_all" on public.insight_likes
  for select using (true);

drop policy if exists "likes_insert_own" on public.insight_likes;
create policy "likes_insert_own" on public.insight_likes
  for insert with check (auth.uid() = user_id);

drop policy if exists "likes_delete_own" on public.insight_likes;
create policy "likes_delete_own" on public.insight_likes
  for delete using (auth.uid() = user_id);

-- 댓글: 누구나 읽기 / 로그인 사용자 작성 / 본인 또는 관리자 삭제
drop policy if exists "comments_select_all" on public.insight_comments;
create policy "comments_select_all" on public.insight_comments
  for select using (true);

drop policy if exists "comments_insert_authed" on public.insight_comments;
create policy "comments_insert_authed" on public.insight_comments
  for insert with check (auth.uid() = user_id);

drop policy if exists "comments_delete_own" on public.insight_comments;
create policy "comments_delete_own" on public.insight_comments
  for delete using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- 7. 에디터 이미지 업로드용 스토리지 버킷 (공개 읽기 / 학회원만 업로드)
insert into storage.buckets (id, name, public)
values ('insight-images', 'insight-images', true)
on conflict (id) do nothing;

drop policy if exists "insight_images_read" on storage.objects;
create policy "insight_images_read" on storage.objects
  for select using (bucket_id = 'insight-images');

drop policy if exists "insight_images_upload_member" on storage.objects;
create policy "insight_images_upload_member" on storage.objects
  for insert with check (
    bucket_id = 'insight-images'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_member)
  );

-- ─────────────────────────────────────────────────────────────
-- 실행 후 할 일: 본인 계정을 학회원+관리자로 지정
--   (이메일을 본인 가입 이메일로 바꿔서 실행)
--
-- update public.profiles set is_member = true, is_admin = true
-- where id = (select id from auth.users where email = 'jbk092000@gmail.com');
--
-- 이후 학회원 승인도 같은 방식:
-- update public.profiles set is_member = true
-- where id = (select id from auth.users where email = '승인할이메일');
-- ─────────────────────────────────────────────────────────────
