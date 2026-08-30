/* ──────────────────────────────────────────────────────────────
   Tally 지원서 → Supabase 적재

   접수는 Tally 가 받고, 이 함수는 제출 직후 응답 사본을 DB 로 복사만 한다.
   폼 구조가 바뀌어도 payload(응답 전체)에는 항상 다 남고, 화면에 쓰는
   이메일·이름·팀명만 라벨/타입 휴리스틱으로 뽑는다.

   주소 형식 (Tally → Integrations → Webhooks):
     /api/tally-webhook?program=boost-4&token=<TALLY_WEBHOOK_TOKEN>

   보안:
   - token 이 환경변수와 다르면 401. 주소를 아는 사람만 넣을 수 있다.
   - 적재는 service_role 키로 한다(RLS 우회). 이 키는 서버에만 있다.

   필요한 환경변수:
     SUPABASE_SERVICE_ROLE_KEY, TALLY_WEBHOOK_TOKEN
   ────────────────────────────────────────────────────────────── */

const SUPABASE_URL = 'https://inlxwukdloehnfnoklza.supabase.co';

function fieldText(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(fieldText).filter(Boolean).join(', ');
  if (typeof v === 'object') return fieldText(v.text ?? v.value ?? v.label ?? '');
  return String(v);
}

/* Tally 필드 배열에서 화면용 핵심값을 뽑는다. 못 찾아도 실패시키지 않는다 —
   payload 에 원본이 있으니 나중에 사람이 보면 된다. */
function extract(fields) {
  let email = '', name = '', team = '', optIn = false;
  for (const f of fields || []) {
    const label = String(f.label || '');
    const val = fieldText(f.value);
    if (!email && (f.type === 'INPUT_EMAIL' || /이메일|e-?mail/i.test(label)) && /@/.test(val)) email = val.trim();
    if (!team && /팀명|팀 이름/.test(label)) team = val.trim();
    if (!name && /이름|성명|대표자/.test(label) && f.type !== 'INPUT_EMAIL' && val && !/@/.test(val)) name = val.trim();
    // '추후 안내' 선택 동의 — 폼에 추가되면 자동으로 잡힌다
    if (/추후|안내 수신|재연락/.test(label)) {
      optIn = f.value === true || /동의|예|yes/i.test(val);
    }
  }
  return { email, name, team, optIn };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const token = process.env.TALLY_WEBHOOK_TOKEN;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !key) return res.status(503).json({ error: 'env not configured' });
  if ((req.query.token || '') !== token) return res.status(401).json({ error: 'bad token' });

  const program = String(req.query.program || '').trim();
  if (!program || !/^[a-z0-9-]{1,50}$/i.test(program)) {
    return res.status(400).json({ error: 'program query missing' });
  }

  try {
    const body = req.body || {};
    const data = body.data || {};
    const fields = data.fields || [];
    const { email, name, team, optIn } = extract(fields);

    const row = {
      program,
      submission_id: String(data.submissionId || data.responseId || body.eventId || ''),
      applicant_email: email,
      applicant_name: name,
      team_name: team,
      marketing_opt_in: optIn,
      payload: data,
      submitted_at: data.createdAt || body.createdAt || new Date().toISOString(),
    };
    if (!row.submission_id) return res.status(400).json({ error: 'no submission id' });

    // on_conflict 지정이 없으면 PostgREST 는 기본키 충돌만 무시한다.
    // submission_id 는 별도 unique 제약이라 명시해야 재전송이 409 로 터지지 않는다.
    const r = await fetch(`${SUPABASE_URL}/rest/v1/applications?on_conflict=submission_id`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        // Tally 는 실패 시 재전송한다. 같은 submission_id 가 다시 와도 조용히 무시.
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify(row),
    });
    if (!r.ok) throw new Error(`supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);

    return res.status(200).json({ ok: true });
  } catch (e) {
    // 500 을 돌려주면 Tally 가 재시도한다. 일시 장애는 그 재시도로 살아난다.
    return res.status(500).json({ error: String(e.message || e) });
  }
};
