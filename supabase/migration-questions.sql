-- ─────────────────────────────────────────────────────────────
-- Y-VENTURES 질문하기 (로그인 사용자 → accelerator@yventures.ac)
--
-- 실행 방법: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
--
-- 준비물: Resend API 키 (https://resend.com 가입, 무료)
--   · accelerator@yventures.ac 로 가입하면 도메인 인증 없이도
--     그 주소로는 바로 메일을 받을 수 있습니다.
--   · 아래 ⑥ 에서 키를 넣어 주세요.
-- ─────────────────────────────────────────────────────────────

-- ① 메일 발송에 쓰는 HTTP 확장
create extension if not exists pg_net with schema extensions;

-- ② 질문 테이블
create table if not exists public.questions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  author_name text not null,
  author_email text not null,
  body text not null check (char_length(body) between 5 and 3000),
  page_url text,
  answered boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists questions_created_idx on public.questions (created_at desc);

-- ③ RLS: 로그인한 사람이 본인 명의로만 남길 수 있고,
--        읽는 것은 관리자만 (질문 내용에 개인적인 내용이 담길 수 있다)
alter table public.questions enable row level security;

drop policy if exists "questions_insert_own" on public.questions;
create policy "questions_insert_own" on public.questions
  for insert with check (auth.uid() = user_id);

drop policy if exists "questions_select_admin" on public.questions;
create policy "questions_select_admin" on public.questions
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

drop policy if exists "questions_update_admin" on public.questions;
create policy "questions_update_admin" on public.questions
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- ④ 도배 방지: 한 사람이 1분에 3건까지
create or replace function public.questions_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  select count(*) into recent
    from public.questions
   where user_id = new.user_id
     and created_at > now() - interval '1 minute';
  if recent >= 3 then
    raise exception '잠시 후 다시 시도해 주세요.';
  end if;
  return new;
end $$;

drop trigger if exists questions_rate_limit_trg on public.questions;
create trigger questions_rate_limit_trg
  before insert on public.questions
  for each row execute function public.questions_rate_limit();

-- ⑤ 발송 설정 보관용 (RLS 켜고 정책을 두지 않아 아무도 직접 읽지 못한다.
--    아래 트리거 함수만 security definer 로 읽는다)
create table if not exists public.app_secrets (
  key text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;

-- ⑥ ★ 여기에 Resend API 키를 넣으세요 (re_ 로 시작) ★
insert into public.app_secrets (key, value) values
  ('resend_api_key', 'RESEND_API_KEY_여기에'),
  ('notify_to',      'accelerator@yventures.ac'),
  -- 도메인 인증을 마치기 전까지는 onboarding@resend.dev 를 그대로 두세요.
  -- 인증 후에는 'Y-VENTURES <noreply@yventures.ac>' 같은 주소로 바꾸면 됩니다.
  ('notify_from',    'Y-VENTURES <onboarding@resend.dev>')
on conflict (key) do update set value = excluded.value;

-- ⑦ 질문이 들어오면 메일로 알린다.
--    메일 발송이 실패해도 질문 자체는 이미 저장되어 있으므로 유실되지 않는다.
create or replace function public.questions_notify()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  api_key text;
  to_addr text;
  from_addr text;
  subject  text;
  html     text;
begin
  select value into api_key   from public.app_secrets where key = 'resend_api_key';
  select value into to_addr   from public.app_secrets where key = 'notify_to';
  select value into from_addr from public.app_secrets where key = 'notify_from';

  if api_key is null or api_key = '' or api_key = 'RESEND_API_KEY_여기에' then
    return new;   -- 키가 없으면 조용히 건너뛴다 (질문은 이미 저장됨)
  end if;

  subject := '[홈페이지 질문] ' || new.author_name || ' — ' ||
             left(regexp_replace(new.body, '\s+', ' ', 'g'), 40);

  html :=
    '<div style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',sans-serif;line-height:1.7;color:#111">' ||
    '<p style="margin:0 0 4px;font-size:13px;color:#666">Y-VENTURES 홈페이지 질문</p>' ||
    '<h2 style="margin:0 0 16px;font-size:18px">' || new.author_name || ' 님의 질문</h2>' ||
    '<div style="white-space:pre-wrap;padding:16px;background:#F6F7F9;border-radius:10px;font-size:15px">' ||
      replace(replace(replace(new.body, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') ||
    '</div>' ||
    '<table style="margin-top:18px;font-size:13px;color:#555;border-collapse:collapse">' ||
    '<tr><td style="padding:3px 14px 3px 0">보낸 사람</td><td>' || new.author_name ||
      ' &lt;' || new.author_email || '&gt;</td></tr>' ||
    '<tr><td style="padding:3px 14px 3px 0">작성 위치</td><td>' || coalesce(new.page_url, '-') || '</td></tr>' ||
    '<tr><td style="padding:3px 14px 3px 0">접수 시각</td><td>' ||
      to_char(new.created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') || '</td></tr>' ||
    '</table>' ||
    '<p style="margin-top:18px;font-size:13px;color:#666">회신은 이 메일에 그대로 답장하면 질문자에게 갑니다.</p>' ||
    '</div>';

  perform net.http_post(
    url     := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
                 'Authorization', 'Bearer ' || api_key,
                 'Content-Type',  'application/json'),
    body    := jsonb_build_object(
                 'from',     from_addr,
                 'to',       jsonb_build_array(to_addr),
                 'reply_to', new.author_email,
                 'subject',  subject,
                 'html',     html),
    timeout_milliseconds := 8000
  );

  return new;
end $$;

drop trigger if exists questions_notify_trg on public.questions;
create trigger questions_notify_trg
  after insert on public.questions
  for each row execute function public.questions_notify();

-- ─────────────────────────────────────────────────────────────
-- 확인용
--   select id, author_name, left(body, 40), created_at from public.questions
--   order by created_at desc limit 20;
--
-- 메일 발송 결과 (pg_net 응답 로그)
--   select status_code, content from net._http_response order by id desc limit 5;
-- ─────────────────────────────────────────────────────────────
