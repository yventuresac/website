/* ─────────────────────────────────────────────────────────────
   10/10 알럼나이 초대 행사 — 투자 게임 공통 모듈
   index.html(투자자) · board.html(큰 화면) · admin.html(진행자) 가 같이 쓴다.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://inlxwukdloehnfnoklza.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubHh3dWtkbG9laG5mbm9rbHphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MDk2MTIsImV4cCI6MjA5NzE4NTYxMn0.mGm1P7YkMFuzouyTQaHVM_m2wir1npVVtTWMu3_hnaM';

  var TEAMS = [
    { id: 'fintech',  track: 'Fintech',     name: '빅테크플러스', en: 'BigTech+',  color: '#3B82F6', logo: 'assets/teams/fintech.png' },
    { id: 'platform', track: 'Platform',    name: '테이밍랩',     en: 'TamingLab', color: '#A855F7', logo: 'assets/teams/platform.png' },
    { id: 'contents', track: 'Contents',    name: '뤼튼',         en: 'Wrtn',      color: '#C7F23E', logo: 'assets/teams/contents.png' },
    { id: 'physical', track: 'Physical AI', name: '컨피그',       en: 'Config',    color: '#F2C56F', logo: 'assets/teams/physical.png' }
  ];
  // 로고 <img> 태그 (cls 로 크기 조절)
  function logoImg(t, cls) {
    return '<img class="tlogo ' + (cls || '') + '" src="' + t.logo + '" alt="' + t.en + '" draggable="false">';
  }
  var TEAM_BY_ID = {};
  TEAMS.forEach(function (t) { TEAM_BY_ID[t.id] = t; });

  var INVESTORS = ['송준영', '정재민', '이윤지', '백보성', '박준영', '서제후', '안병세'];
  // 명단 + 실제 들어온 사람(명단 밖 게스트 포함)
  function allInvestors(investments) {
    var names = INVESTORS.slice();
    (investments || []).forEach(function (i) { if (names.indexOf(i.investor) === -1) names.push(i.investor); });
    return names;
  }
  var BUDGET = 500;   // 억
  var STEP = 10;      // 억
  var ADMIN_PIN = '7913';

  var WEIGHT_TOTAL = 0.7;   // 총액 점수 비중
  var WEIGHT_COUNT = 0.3;   // 투자자 수 점수 비중

  var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: { params: { eventsPerSecond: 20 } }
  });

  /* ── 데이터 접근 ── */
  function fetchState() {
    return client.from('alumni_game_state').select('*').eq('id', 1).single()
      .then(function (r) { if (r.error) throw r.error; return r.data; });
  }
  function fetchInvestments() {
    return client.from('alumni_investments').select('*').order('joined_at')
      .then(function (r) { if (r.error) throw r.error; return r.data || []; });
  }
  function fetchFeed(limit) {
    return client.from('alumni_feed').select('*').order('id', { ascending: false }).limit(limit || 30)
      .then(function (r) { if (r.error) throw r.error; return r.data || []; });
  }
  function updateState(patch) {
    patch.updated_at = new Date().toISOString();
    return client.from('alumni_game_state').update(patch).eq('id', 1)
      .then(function (r) { if (r.error) throw r.error; return r.data; });
  }
  function upsertInvestment(investor, amounts) {
    return client.from('alumni_investments')
      .upsert({ investor: investor, amounts: amounts, updated_at: new Date().toISOString() }, { onConflict: 'investor' })
      .then(function (r) { if (r.error) throw r.error; return r.data; });
  }
  function joinInvestor(investor) {
    // 이미 있으면 건드리지 않는다 (금액 보존)
    return client.from('alumni_investments')
      .upsert({ investor: investor }, { onConflict: 'investor', ignoreDuplicates: true })
      .then(function (r) { if (r.error) throw r.error; return r.data; });
  }
  function insertFeed(rows) {
    if (!rows.length) return Promise.resolve();
    return client.from('alumni_feed').insert(rows)
      .then(function (r) { if (r.error) throw r.error; return r.data; });
  }
  function resetAll() {
    return client.from('alumni_feed').delete().gte('id', 0)
      .then(function () { return client.from('alumni_investments').delete().neq('investor', ''); })
      .then(function () {
        return updateState({ phase: 'lobby', team_order: [], current_team: 0, reveal_step: 0, deadline: null, drawn_at: null });
      });
  }

  /* ── 실시간 + 폴링 (둘 다 돌려서 하나가 죽어도 화면이 산다) ── */
  function subscribe(onChange, pollMs) {
    var timer = null;
    var busy = false;
    function tick() {
      if (busy) return;
      busy = true;
      Promise.resolve(onChange()).catch(function (e) { console.warn(e); })
        .then(function () { busy = false; });
    }
    var ch = client.channel('alumni-day-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alumni_game_state' }, tick)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alumni_investments' }, tick)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alumni_feed' }, tick)
      .subscribe();
    timer = setInterval(tick, pollMs || 3000);
    tick();
    return function () { clearInterval(timer); client.removeChannel(ch); };
  }

  /* ── 계산 ── */
  function sumAmounts(amounts) {
    var s = 0;
    TEAMS.forEach(function (t) { s += Number((amounts || {})[t.id] || 0); });
    return s;
  }

  // 팀별 집계 + 점수 + 순위
  function tally(investments) {
    var grand = 0;
    var active = 0;   // 1억이라도 넣은 사람 수
    var rows = TEAMS.map(function (t) {
      return { team: t, total: 0, count: 0, backers: [] };
    });
    var byId = {};
    rows.forEach(function (r) { byId[r.team.id] = r; });

    investments.forEach(function (inv) {
      var a = inv.amounts || {};
      var mine = sumAmounts(a);
      if (mine > 0) active += 1;
      grand += mine;
      TEAMS.forEach(function (t) {
        var v = Number(a[t.id] || 0);
        if (v > 0) {
          byId[t.id].total += v;
          byId[t.id].count += 1;
          byId[t.id].backers.push({ investor: inv.investor, amount: v, share: mine ? v / mine : 0 });
        }
      });
    });

    // 지지 폭 분모 = 실제로 들어온 사람 수 (불참자가 있어도 점수가 깎이지 않게)
    var joined = Math.max(1, investments.length);
    rows.forEach(function (r) {
      r.totalShare = grand ? r.total / grand : 0;
      r.countShare = r.count / joined;
      r.score = (WEIGHT_TOTAL * r.totalShare + WEIGHT_COUNT * r.countShare) * 100;
      r.backers.sort(function (x, y) { return y.amount - x.amount; });
    });

    var ranked = rows.slice().sort(function (x, y) {
      if (y.score !== x.score) return y.score - x.score;
      if (y.total !== x.total) return y.total - x.total;
      if (y.count !== x.count) return y.count - x.count;
      return 0;
    });
    ranked.forEach(function (r, i) { r.rank = i + 1; });

    // 베스트 투자자: 1등 팀에 가장 큰 "비중"을 넣은 사람, 같으면 금액 큰 사람
    var winner = ranked[0];
    var best = null;
    if (winner && winner.total > 0) {
      best = winner.backers.slice().sort(function (x, y) {
        if (y.share !== x.share) return y.share - x.share;
        return y.amount - x.amount;
      })[0];
    }

    return { rows: rows, ranked: ranked, grand: grand, active: active, joined: investments.length, winner: winner, best: best };
  }

  function orderedTeams(state) {
    var order = (state && state.team_order) || [];
    if (!order.length) return TEAMS.slice();
    return order.map(function (id) { return TEAM_BY_ID[id]; }).filter(Boolean);
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  /* ── 표시 ── */
  function fmt(n) {
    n = Number(n || 0);
    if (n >= 10000) {
      var jo = Math.floor(n / 10000);
      var rest = n % 10000;
      return rest ? jo + '조 ' + rest.toLocaleString('ko-KR') + '억' : jo + '조';
    }
    return n.toLocaleString('ko-KR') + '억';
  }
  function pct(x) { return Math.round(x * 100) + '%'; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function phaseLabel(phase) {
    return {
      lobby: '대기 중',
      drawing: '발표 순서 추첨',
      presenting: '발표 진행 중',
      investing: '투자 진행 중',
      closed: '투자 마감',
      revealed: '결과 발표'
    }[phase] || phase;
  }

  /* ── 모의 모드 (DB 없이 리허설) ──
     주소 뒤에 ?mock=1 을 붙이면 이 브라우저의 localStorage 를 DB 대신 쓴다.
     같은 브라우저의 다른 탭끼리는 동기화된다. ?mock=0 으로 끈다. */
  var MOCK_KEY = 'yv_alumni_mock';
  var q = /[?&]mock=(\d)/.exec(location.search);
  if (q) { try { if (q[1] === '1') localStorage.setItem(MOCK_KEY, '1'); else localStorage.removeItem(MOCK_KEY); } catch (e) {} }
  var MOCK = false;
  try { MOCK = localStorage.getItem(MOCK_KEY) === '1'; } catch (e) {}

  if (MOCK) {
    var mget = function (k, d) { try { return JSON.parse(localStorage.getItem('yv_mock_' + k)) || d; } catch (e) { return d; } };
    var mset = function (k, v) { localStorage.setItem('yv_mock_' + k, JSON.stringify(v)); };
    var defState = function () { return { id: 1, phase: 'lobby', team_order: [], current_team: 0, reveal_step: 0, deadline: null, drawn_at: null }; };
    fetchState = function () { return Promise.resolve(mget('state', defState())); };
    fetchInvestments = function () { return Promise.resolve(mget('inv', [])); };
    fetchFeed = function (limit) { return Promise.resolve(mget('feed', []).slice().reverse().slice(0, limit || 30)); };
    updateState = function (patch) { mset('state', Object.assign(mget('state', defState()), patch)); return Promise.resolve(); };
    upsertInvestment = function (investor, amounts) {
      var inv = mget('inv', []); var row = inv.filter(function (i) { return i.investor === investor; })[0];
      if (row) row.amounts = amounts; else inv.push({ investor: investor, amounts: amounts, joined_at: new Date().toISOString() });
      mset('inv', inv); return Promise.resolve();
    };
    joinInvestor = function (investor) {
      var inv = mget('inv', []);
      if (!inv.some(function (i) { return i.investor === investor; })) { inv.push({ investor: investor, amounts: {}, joined_at: new Date().toISOString() }); mset('inv', inv); }
      return Promise.resolve();
    };
    insertFeed = function (rows) {
      var f = mget('feed', []); var id = f.length ? f[f.length - 1].id + 1 : 1;
      rows.forEach(function (r) { r.id = id++; r.created_at = new Date().toISOString(); f.push(r); });
      mset('feed', f); return Promise.resolve();
    };
    resetAll = function () { mset('inv', []); mset('feed', []); mset('state', defState()); return Promise.resolve(); };
    subscribe = function (onChange, pollMs) {
      var tick = function () { Promise.resolve(onChange()).catch(function (e) { console.warn(e); }); };
      var t = setInterval(tick, Math.min(pollMs || 1500, 1500));
      window.addEventListener('storage', tick);
      tick();
      return function () { clearInterval(t); };
    };
    document.addEventListener('DOMContentLoaded', function () {
      var b = document.createElement('div');
      b.textContent = 'MOCK MODE · DB 미사용 (?mock=0 으로 끄기)';
      b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99;text-align:center;font:700 11px/1 Pretendard,sans-serif;letter-spacing:.1em;padding:5px;background:#F59E0B;color:#000';
      document.body.appendChild(b);
    });
  }

  window.YVGame = {
    MOCK: MOCK,
    client: client,
    TEAMS: TEAMS,
    TEAM_BY_ID: TEAM_BY_ID,
    INVESTORS: INVESTORS,
    BUDGET: BUDGET,
    STEP: STEP,
    ADMIN_PIN: ADMIN_PIN,
    WEIGHT_TOTAL: WEIGHT_TOTAL,
    WEIGHT_COUNT: WEIGHT_COUNT,
    fetchState: fetchState,
    fetchInvestments: fetchInvestments,
    fetchFeed: fetchFeed,
    updateState: updateState,
    upsertInvestment: upsertInvestment,
    joinInvestor: joinInvestor,
    insertFeed: insertFeed,
    resetAll: resetAll,
    subscribe: subscribe,
    sumAmounts: sumAmounts,
    tally: tally,
    orderedTeams: orderedTeams,
    shuffle: shuffle,
    fmt: fmt,
    logoImg: logoImg,
    allInvestors: allInvestors,
    pct: pct,
    esc: esc,
    phaseLabel: phaseLabel
  };
})();
