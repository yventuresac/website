/* ──────────────────────────────────────────────────────────────
   Vercel Web Analytics 조회 프록시

   왜 함수가 필요한가:
   Vercel API 토큰은 비밀값이다. 정적 페이지에 넣으면 누구나 읽어서
   프로젝트 전체를 조작할 수 있다. 그래서 서버에서만 토큰을 쥐고,
   브라우저에는 결과 숫자만 내려준다.

   누가 부를 수 있나:
   관리자만. 호출자의 Supabase 세션 토큰을 검증하고 profiles.is_admin 을 본다.
   막지 않으면 주소만 알면 누구나 사이트 트래픽을 들여다볼 수 있다.

   필요한 환경변수 (Vercel → Settings → Environment Variables):
     VERCEL_API_TOKEN   Vercel 액세스 토큰 (Account Settings → Tokens)
     VERCEL_PROJECT_ID  프로젝트 ID (Project Settings → General)
     VERCEL_TEAM_ID     팀 소유일 때만. 개인 계정이면 넣지 않는다.
   ────────────────────────────────────────────────────────────── */

const SUPABASE_URL = 'https://inlxwukdloehnfnoklza.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubHh3dWtkbG9laG5mbm9rbHphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MDk2MTIsImV4cCI6MjA5NzE4NTYxMn0.mGm1P7YkMFuzouyTQaHVM_m2wir1npVVtTWMu3_hnaM';

const VERCEL_API = 'https://api.vercel.com/v1/query/web-analytics';

async function requireAdmin(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { ok: false, status: 401, message: '로그인이 필요합니다.' };

  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };

  const me = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers });
  if (!me.ok) return { ok: false, status: 401, message: '세션이 유효하지 않습니다.' };
  const user = await me.json();

  // 본인 프로필은 RLS 가 허용한다. service_role 키를 서버에 둘 필요가 없다.
  const pr = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=is_admin`,
    { headers }
  );
  const rows = pr.ok ? await pr.json() : [];
  if (!rows[0] || !rows[0].is_admin) {
    return { ok: false, status: 403, message: '관리자만 볼 수 있습니다.' };
  }
  return { ok: true };
}

function vercelParams(extra) {
  const p = new URLSearchParams({ projectId: process.env.VERCEL_PROJECT_ID || '', ...extra });
  if (process.env.VERCEL_TEAM_ID) p.set('teamId', process.env.VERCEL_TEAM_ID);
  return p;
}

async function vercelQuery(path, extra) {
  const res = await fetch(`${VERCEL_API}/${path}?${vercelParams(extra)}`, {
    headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Vercel API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

module.exports = async (req, res) => {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.message });

    if (!process.env.VERCEL_API_TOKEN || !process.env.VERCEL_PROJECT_ID) {
      return res.status(503).json({
        error: '환경변수가 설정되지 않았습니다. VERCEL_API_TOKEN 과 VERCEL_PROJECT_ID 를 등록하세요.',
      });
    }

    // Hobby 는 조회 기간이 1개월이라 그보다 길게 요청하면 빈 값이 온다.
    //
    // until 을 '오늘'로 주면 오늘치가 통째로 빠진다(경계 미포함). 방문 기록이
    // 대부분 오늘인 초기에는 결과가 0 으로만 나온다. 그래서 하루 뒤로 잡는다.
    const now = new Date();
    const until = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const since = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    const day = (d) => d.toISOString().slice(0, 10);

    const range = { since: day(since), until: day(until) };
    const agg = (by, limit) => vercelQuery('visits/aggregate', { ...range, by, limit: String(limit) });

    // 한 항목이 실패해도 나머지는 보여준다. 전부 막히는 것보다 낫다.
    const settle = (p) => p.then((r) => (Array.isArray(r.data) ? r.data : []), () => null);

    const [total, pages, daily, referrers, countries, devices, browsers] = await Promise.all([
      vercelQuery('visits/count', {}).then((r) => r.data || null, () => null),
      settle(agg('requestPath', 10)),
      settle(agg('day', 31)),
      settle(agg('referrerHostname', 8)),
      settle(agg('country', 8)),
      settle(agg('deviceType', 5)),
      settle(agg('browserName', 5)),
    ]);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      total,
      since: day(since),
      until: day(now),
      pages: pages || [],
      daily: daily || [],
      referrers: referrers || [],
      countries: countries || [],
      devices: devices || [],
      browsers: browsers || [],
    });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
};
