/* ──────────────────────────────────────────────────────────────
   회원 탈퇴 (관리자 전용)

   왜 서버 함수인가:
   계정 삭제는 Supabase Auth 관리자 API 로만 가능하고, 그 API 는
   service_role 키가 필요하다. 이 키는 브라우저에 두면 안 되므로
   서버에서만 쥐고, 호출자가 진짜 운영진인지 확인한 뒤 대신 지운다.

   무엇이 지워지나:
   auth.users 의 계정. profiles·활동 기록·과제 제출·좋아요 등은
   외래키 on delete cascade 로 함께 지워진다. 작성한 Insights 글과
   자료실 링크는 author_id 만 비워지고 글 자체는 남는다(set null).

   안전장치:
   - 본인 계정은 여기서 못 지운다 (실수로 자기 계정 삭제 방지)
   - 운영진 계정은 못 지운다 — 먼저 회원 관리에서 운영진을 해제해야 한다

   필요한 환경변수: SUPABASE_SERVICE_ROLE_KEY (Tally 웹훅과 공용)
   ────────────────────────────────────────────────────────────── */

const SUPABASE_URL = 'https://inlxwukdloehnfnoklza.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubHh3dWtkbG9laG5mbm9rbHphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MDk2MTIsImV4cCI6MjA5NzE4NTYxMn0.mGm1P7YkMFuzouyTQaHVM_m2wir1npVVtTWMu3_hnaM';

async function requireAdmin(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { ok: false, status: 401, message: '로그인이 필요합니다.' };

  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };

  const me = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers });
  if (!me.ok) return { ok: false, status: 401, message: '세션이 유효하지 않습니다.' };
  const user = await me.json();

  // 본인 프로필은 RLS 가 허용하므로 anon 키 + 세션 토큰으로 읽는다
  const pr = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=is_admin`,
    { headers }
  );
  const rows = pr.ok ? await pr.json() : [];
  if (!rows[0] || !rows[0].is_admin) {
    return { ok: false, status: 403, message: '관리자만 사용할 수 있습니다.' };
  }
  return { ok: true, userId: user.id };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.message });

    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다.' });

    const targetId = String((req.body || {}).user_id || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
      return res.status(400).json({ error: 'user_id 가 올바르지 않습니다.' });
    }
    if (targetId === gate.userId) {
      return res.status(400).json({ error: '본인 계정은 여기서 삭제할 수 없습니다.' });
    }

    const svc = { apikey: key, Authorization: `Bearer ${key}` };

    const pr = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(targetId)}&select=is_admin`,
      { headers: svc }
    );
    const rows = pr.ok ? await pr.json() : [];
    if (rows[0] && rows[0].is_admin) {
      return res.status(403).json({ error: '운영진 계정입니다. 먼저 운영진을 해제한 뒤 탈퇴시키세요.' });
    }

    const del = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(targetId)}`, {
      method: 'DELETE',
      headers: svc,
    });
    if (!del.ok) {
      throw new Error(`supabase ${del.status}: ${(await del.text()).slice(0, 200)}`);
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
