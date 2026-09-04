/* ──────────────────────────────────────────────────────────────
   Insights 글 페이지 — 링크 공유 카드용 서버 렌더

   왜 서버 함수인가:
   post.html 은 정적 파일이라 <head>의 og:title / og:image 가 모든 글에서 같다.
   카톡·슬랙 미리보기 봇은 JS 를 실행하지 않으니, 글마다 다른 카드를 보여주려면
   서버가 HTML 을 내주면서 그 글의 제목·부제·대표 이미지를 head 에 박아야 한다.

   동작:
   vercel.json 이 /insights/post.html?no=N 을 이 함수로 돌린다.
   같은 post.html 파일을 읽어 og 메타만 바꿔 치기 → 사람은 여전히 같은 페이지를 본다.
   글을 못 찾거나 Supabase 가 응답이 없으면 원본 그대로 내준다(절대 깨지지 않게).
   ────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://inlxwukdloehnfnoklza.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubHh3dWtkbG9laG5mbm9rbHphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MDk2MTIsImV4cCI6MjA5NzE4NTYxMn0.mGm1P7YkMFuzouyTQaHVM_m2wir1npVVtTWMu3_hnaM';

const SITE = 'https://www.yventures.ac';
const DEFAULT_IMAGE = SITE + '/assets/og-cover-logo.jpg';
const DEFAULT_DESC = 'Y-VENTURES 학회원이 작성한 산업·시장 인사이트입니다.';

let cachedHtml = null;
function loadTemplate() {
  if (cachedHtml) return cachedHtml;
  cachedHtml = fs.readFileSync(path.join(process.cwd(), 'insights', 'post.html'), 'utf8');
  return cachedHtml;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* <meta property="og:title" content="..."> 같은 줄의 content 만 바꾼다 */
function setMeta(html, attr, key, value) {
  const re = new RegExp('(<meta\\s+' + attr + '="' + key.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&') + '"\\s+content=")[^"]*(")', 'i');
  return html.replace(re, '$1' + esc(value) + '$2');
}

function inject(html, p, no) {
  const url = SITE + '/insights/post.html?no=' + no;
  const title = (p.title || '').trim() || 'Insights';
  const desc = (p.subtitle || '').trim() || DEFAULT_DESC;
  const image = /^https?:\/\//i.test(p.cover_url || '') ? p.cover_url : DEFAULT_IMAGE;

  html = html.replace(/<title>[^<]*<\/title>/i, '<title>' + esc(title) + ' — Y-VENTURES Insights</title>');
  html = setMeta(html, 'name', 'description', desc);
  html = setMeta(html, 'property', 'og:type', 'article');
  html = setMeta(html, 'property', 'og:title', title);
  html = setMeta(html, 'property', 'og:description', desc);
  html = setMeta(html, 'property', 'og:url', url);
  html = setMeta(html, 'property', 'og:image', image);
  html = setMeta(html, 'property', 'og:image:alt', title);
  html = setMeta(html, 'name', 'twitter:title', title);
  html = setMeta(html, 'name', 'twitter:description', desc);
  html = setMeta(html, 'name', 'twitter:image', image);
  html = html.replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/i, '$1' + esc(url) + '$2');
  /* 대표 이미지 크기는 글마다 달라 고정값이 틀릴 수 있다 — 지운다 (없으면 봇이 알아서 잰다) */
  if (image !== DEFAULT_IMAGE) {
    html = html.replace(/\s*<meta property="og:image:width" content="[^"]*" \/>/i, '')
               .replace(/\s*<meta property="og:image:height" content="[^"]*" \/>/i, '');
  }
  return html;
}

module.exports = async (req, res) => {
  let html;
  try { html = loadTemplate(); }
  catch (e) { return res.status(500).send('post.html 을 읽지 못했습니다.'); }

  const no = parseInt((req.query || {}).no, 10);
  if (no > 0) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const headers = { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY };
      const base = SUPABASE_URL + '/rest/v1/insight_posts?board_no=eq.' + no + '&limit=1&select=';
      let r = await fetch(base + 'title,subtitle,cover_url', { headers, signal: ctrl.signal });
      /* 부제·대표 이미지 칸이 아직 없는 DB(마이그레이션 전)면 제목만이라도 */
      if (!r.ok) r = await fetch(base + 'title', { headers, signal: ctrl.signal });
      clearTimeout(t);
      const rows = r.ok ? await r.json() : [];
      if (rows[0]) html = inject(html, rows[0], no);
    } catch (e) { /* 봇이든 사람이든 원본 페이지는 받게 둔다 */ }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
  res.status(200).send(html);
};
