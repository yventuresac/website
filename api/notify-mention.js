/* ──────────────────────────────────────────────────────────────
   캘린더 @태그 이메일 알림

   일정에 @태그된 학회원에게 이메일을 보낸다. 이메일 주소는 브라우저에
   내려주지 않으므로(개인정보) 서버가 service_role 키로 조회해서 보낸다.

   보낼 수 있는 사람: 그 일정의 작성자 본인뿐. 남의 일정을 핑계로
   임의 회원에게 메일을 쏘는 것을 막는다. 수신자도 그 일정의 mentions 에
   실제로 들어 있는 사람으로 제한한다.

   발송은 Resend(https://resend.com) HTTP API — 의존성 없이 fetch 만 쓴다.

   필요한 환경변수:
     SUPABASE_SERVICE_ROLE_KEY  (기존과 공용)
     RESEND_API_KEY             Resend 대시보드 → API Keys
     MAIL_FROM                  (선택) 예: "Y-VENTURES <notify@yventures.ac>"
                                도메인 인증 전에는 onboarding@resend.dev 만 가능
   ────────────────────────────────────────────────────────────── */

const SUPABASE_URL = 'https://inlxwukdloehnfnoklza.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubHh3dWtkbG9laG5mbm9rbHphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MDk2MTIsImV4cCI6MjA5NzE4NTYxMn0.mGm1P7YkMFuzouyTQaHVM_m2wir1npVVtTWMu3_hnaM';

const ETYPES = {
  'vc-career': 'VC Career Session',
  'boost': 'Boosting Program',
  'y-startup': 'Y-Startup',
  'networking': 'VC&Startup Networking Party',
};
const CATS = { study: 'Study Session', project: 'Project Session', event: '행사' };

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function requireMember(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { ok: false, status: 401, message: '로그인이 필요합니다.' };

  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
  const me = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers });
  if (!me.ok) return { ok: false, status: 401, message: '세션이 유효하지 않습니다.' };
  const user = await me.json();

  const pr = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=is_member,is_admin,display_name`,
    { headers }
  );
  const rows = pr.ok ? await pr.json() : [];
  if (!rows[0] || (!rows[0].is_member && !rows[0].is_admin)) {
    return { ok: false, status: 403, message: '학회원만 사용할 수 있습니다.' };
  }
  return { ok: true, userId: user.id, name: rows[0].display_name || '' };
}

module.exports = async (req, res) => {
  // GET = 설정 상태 확인 (키 값은 노출하지 않고 유무만)
  if (req.method === 'GET') {
    return res.status(200).json({
      resend_key: !!process.env.RESEND_API_KEY,
      mail_from: process.env.MAIL_FROM || '(기본: onboarding@resend.dev — 가입자 본인에게만 발송 가능)',
      service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const gate = await requireMember(req);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.message });

    const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const mailKey = process.env.RESEND_API_KEY;
    if (!svcKey) return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY 가 없습니다.' });
    if (!mailKey) return res.status(503).json({ error: '메일 발송이 아직 설정되지 않았습니다 (RESEND_API_KEY).' });

    const body = req.body || {};
    const eventId = Number(body.event_id);
    let userIds = Array.isArray(body.user_ids) ? body.user_ids.map(String) : [];
    if (!eventId || !userIds.length) return res.status(400).json({ error: 'event_id/user_ids 필요' });
    userIds = userIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 20);

    const svc = { apikey: svcKey, Authorization: `Bearer ${svcKey}` };

    const er = await fetch(
      `${SUPABASE_URL}/rest/v1/calendar_events?id=eq.${eventId}&select=*`,
      { headers: svc }
    );
    const ev = er.ok ? (await er.json())[0] : null;
    if (!ev) return res.status(404).json({ error: '일정을 찾을 수 없습니다.' });
    if (ev.author_id !== gate.userId) {
      return res.status(403).json({ error: '본인이 등록한 일정의 태그만 알릴 수 있습니다.' });
    }

    // 수신자는 일정에 실제로 태그된 사람으로 제한 (본인 태그 포함)
    const mentioned = new Set((ev.mentions || []).map((m) => String(m && m.id)));
    const targets = userIds.filter((id) => mentioned.has(id));
    if (!targets.length) return res.status(200).json({ ok: true, sent: 0 });

    const idList = targets.map((id) => encodeURIComponent(id)).join(',');
    const pr = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=in.(${idList})&select=id,email,display_name`,
      { headers: svc }
    );
    const people = pr.ok ? await pr.json() : [];

    const from = process.env.MAIL_FROM || 'Y-VENTURES <onboarding@resend.dev>';
    const kind = ev.category === 'event' ? (ETYPES[ev.event_type] || ev.event_type || '행사') : CATS[ev.category];
    const when = String(ev.starts_on).replace(/-/g, '.') + (ev.time_text ? ' ' + ev.time_text : '');
    const author = gate.name || ev.author_name || '학회원';

    let sent = 0;
    const errors = [];
    for (const p of people) {
      if (!p.email) continue;
      const html =
        `<div style="font-family:sans-serif;line-height:1.7;color:#222">` +
        `<p><strong>${escHtml(author)}</strong>님이 Y-VENTURES 일정에서 회원님을 태그했습니다.</p>` +
        `<p style="margin:16px 0;padding:14px 18px;background:#f5f6f8;border-radius:10px">` +
        `<span style="font-size:12px;color:#777">${escHtml(kind)} · ${escHtml(when)}</span><br/>` +
        `<strong style="font-size:16px">${escHtml(ev.title)}</strong>` +
        (ev.detail ? `<br/><span style="font-size:14px;color:#444">${escHtml(ev.detail)}</span>` : '') +
        `</p>` +
        `<p><a href="https://www.yventures.ac/members/">학회원 페이지에서 캘린더 보기 →</a></p>` +
        `<p style="font-size:12px;color:#999">이 메일은 학회원 캘린더의 @태그 알림입니다.</p></div>`;

      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${mailKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [p.email],
          subject: `[Y-VENTURES] ${author}님이 일정에서 회원님을 태그했습니다 — ${ev.title}`,
          html,
        }),
      });
      if (r.ok) sent += 1;
      else errors.push(`${r.status}: ${(await r.text()).slice(0, 120)}`);
    }

    return res.status(200).json({ ok: true, sent, errors: errors.length ? errors : undefined });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
