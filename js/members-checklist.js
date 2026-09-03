/* ──────────────────────────────────────────────────────────────
   학회원 허브 — 따라다니는 체크리스트

   이번 주에 학회원이 해야 할 것들을 화면 오른쪽에 붙여 두고, 스크롤해도
   따라온다. 카톡으로 공유하는 안내와 짝을 이루는 "여기서 할 일" 목록.

     · 항목은 아래 ITEMS 한 곳. 링크를 누르면 해당 기능으로 간다.
     · 체크는 계정·브라우저별로 남는다(localStorage).
       auto 가 있는 항목은 실제 데이터로 판단한다(예: 투표 제출 여부).
     · 넓은 화면(≥1280px)에서는 오른쪽에 도킹, 좁으면 오른쪽 아래 알약 →
       누르면 시트로 펼쳐진다. 접힘 상태도 기억한다.

   허브에서 yvChecklist.init({ userId, db }) 로 부른다.
   스타일은 여기서 주입한다 — 허브 CSS 를 건드리지 않기 위해.
   ────────────────────────────────────────────────────────────── */
(function () {
  var TITLE = "이번 주 체크리스트";
  var DUE = "9/4(금)까지";

  var ITEMS = [
    { id: "vote",     text: "투심 보고서 기업 투표 (1·2·3지망)", href: "/members/vote.html", auto: "vote" },
    { id: "calendar", text: "캘린더에서 이번 주 세션 일정 확인", href: "#calSlot" },
    { id: "resources", text: "자료실에서 세션 자료·노션 링크 받기", href: "/members/resources.html" },
    { id: "insight",  text: "Insights 글 1편 쓰기", href: "/insights/write.html" },
    { id: "activity", text: "내 활동 기록 채우기", href: "/members/activity.html" },
    { id: "alumni",   text: "알럼 디렉터리 둘러보기", href: "/members/alumni.html" }
  ];

  var uid = null, db = null, state = {}, autoDone = {}, box = null;

  function key(k) { return "yv_checklist_" + k + "_" + (uid || "anon"); }
  function load() {
    try { state = JSON.parse(localStorage.getItem(key("done")) || "{}") || {}; } catch (e) { state = {}; }
  }
  function save() { try { localStorage.setItem(key("done"), JSON.stringify(state)); } catch (e) {} }
  function collapsed() { try { return localStorage.getItem(key("fold")) === "1"; } catch (e) { return false; } }
  function setCollapsed(v) { try { localStorage.setItem(key("fold"), v ? "1" : "0"); } catch (e) {} }

  function isDone(it) { return !!(autoDone[it.id] || state[it.id]); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* 실제 데이터로 판단하는 항목 — 실패하면 그냥 수동 체크로 둔다 */
  async function detect() {
    if (!db || !uid) return;
    try {
      var r = await db.from("company_votes").select("user_id").eq("user_id", uid).maybeSingle();
      if (!r.error && r.data) autoDone.vote = true;
    } catch (e) {}
  }

  function render() {
    var done = ITEMS.filter(isDone).length, total = ITEMS.length;
    var all = done === total;
    box.classList.toggle("is-fold", collapsed());
    box.classList.toggle("is-all", all);
    box.innerHTML =
      '<button type="button" class="yvc-head" aria-expanded="' + !collapsed() + '">' +
        '<span class="yvc-ring" style="--p:' + Math.round(done / total * 100) + '"><i></i><b>' + done + '/' + total + '</b></span>' +
        '<span class="yvc-ttl"><strong>' + esc(TITLE) + '</strong><small>' + (all ? "모두 완료" : esc(DUE)) + '</small></span>' +
        '<svg class="yvc-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>' +
      '</button>' +
      '<ul class="yvc-list">' + ITEMS.map(function (it) {
        var d = isDone(it), auto = !!(it.auto && autoDone[it.id]);
        return '<li class="' + (d ? "done" : "") + '">' +
          '<label><input type="checkbox" data-id="' + it.id + '"' + (d ? " checked" : "") + (auto ? " disabled" : "") + ' />' +
          '<span class="yvc-box" aria-hidden="true"></span>' +
          '<span class="yvc-txt">' + esc(it.text) + (auto ? '<em>제출 확인됨</em>' : '') + '</span></label>' +
          (it.href ? '<a class="yvc-go" href="' + esc(it.href) + '" aria-label="바로가기">→</a>' : '') +
          '</li>';
      }).join("") + '</ul>';

    box.querySelector(".yvc-head").addEventListener("click", function () {
      setCollapsed(!collapsed()); render();
    });
    box.querySelectorAll("input[type=checkbox]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        if (cb.checked) state[cb.getAttribute("data-id")] = true; else delete state[cb.getAttribute("data-id")];
        save(); render();
      });
    });
    /* 페이지 안 앵커(#calSlot)는 부드럽게 */
    box.querySelectorAll('a.yvc-go[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var t = document.querySelector(a.getAttribute("href"));
        if (!t) return;
        e.preventDefault();
        window.scrollTo({ top: window.scrollY + t.getBoundingClientRect().top - 90, behavior: "smooth" });
      });
    });
  }

  async function init(opts) {
    opts = opts || {};
    uid = opts.userId || null; db = opts.db || null;
    if (box) return;
    injectStyles();
    box = document.createElement("aside");
    box.className = "yvc";
    box.setAttribute("aria-label", TITLE);
    document.body.appendChild(box);
    load();
    render();
    await detect();
    render();
  }

  function injectStyles() {
    if (document.getElementById("yv-checklist-css")) return;
    var css =
      '.yvc{position:fixed;z-index:120;right:20px;top:96px;width:272px;border:1px solid var(--edge,rgba(255,255,255,.12));border-radius:16px;' +
        'background:var(--bg-elevated,#161A23);color:var(--text-1,#fff);box-shadow:0 18px 44px rgba(0,0,0,.45);font-family:"Pretendard",sans-serif;overflow:hidden;' +
        'animation:yvcIn .45s cubic-bezier(.16,1,.3,1) .6s both}' +
      '@keyframes yvcIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +
      '.yvc-head{display:flex;align-items:center;gap:11px;width:100%;padding:13px 14px;background:none;border:none;color:inherit;cursor:pointer;text-align:left;font-family:inherit}' +
      '.yvc-head:hover{background:rgba(255,255,255,.03)}' +
      '.yvc-ring{position:relative;flex:none;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
        'background:conic-gradient(#93C5FD calc(var(--p)*1%),rgba(255,255,255,.1) 0)}' +
      '.yvc-ring i{position:absolute;inset:4px;border-radius:50%;background:var(--bg-elevated,#161A23)}' +
      '.yvc-ring b{position:relative;font-size:11px;font-weight:700;letter-spacing:0}' +
      '.is-all .yvc-ring{background:#6EE7B7}.is-all .yvc-ring b{color:#6EE7B7}' +
      '.yvc-ttl{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}' +
      '.yvc-ttl strong{font-size:14px;font-weight:700;letter-spacing:-.01em}' +
      '.yvc-ttl small{font-size:11px;color:var(--text-3,rgba(255,255,255,.5));letter-spacing:.04em}' +
      '.is-all .yvc-ttl small{color:#6EE7B7}' +
      '.yvc-chev{width:16px;height:16px;flex:none;color:var(--text-3,rgba(255,255,255,.5));transition:transform .25s}' +
      '.is-fold .yvc-chev{transform:rotate(180deg)}' +
      '.yvc-list{list-style:none;margin:0;padding:4px 8px 10px;border-top:1px solid var(--edge,rgba(255,255,255,.1))}' +
      '.is-fold .yvc-list{display:none}' +
      '.yvc-list li{display:flex;align-items:flex-start;gap:6px;padding:2px 0}' +
      '.yvc-list label{flex:1;min-width:0;display:flex;align-items:flex-start;gap:10px;padding:7px 6px;border-radius:9px;cursor:pointer}' +
      '.yvc-list label:hover{background:rgba(255,255,255,.04)}' +
      '.yvc-list input{position:absolute;opacity:0;width:0;height:0}' +
      '.yvc-box{flex:none;width:17px;height:17px;margin-top:1px;border-radius:5px;border:1.5px solid rgba(255,255,255,.28);position:relative;transition:background .15s,border-color .15s}' +
      '.yvc-box::after{content:"";position:absolute;left:5px;top:1.5px;width:4px;height:8px;border:solid #0B0D12;border-width:0 2px 2px 0;transform:rotate(45deg);opacity:0}' +
      '.yvc-list input:checked+.yvc-box{background:#93C5FD;border-color:#93C5FD}' +
      '.yvc-list input:checked+.yvc-box::after{opacity:1}' +
      '.yvc-list input:disabled+.yvc-box{background:#6EE7B7;border-color:#6EE7B7}' +
      '.yvc-list input:focus-visible+.yvc-box{outline:2px solid #93C5FD;outline-offset:2px}' +
      '.yvc-txt{font-size:13px;line-height:1.45;color:var(--text-2,rgba(255,255,255,.78))}' +
      '.yvc-txt em{display:block;font-style:normal;font-size:11px;color:#6EE7B7;margin-top:1px}' +
      '.yvc-list li.done .yvc-txt{color:var(--text-3,rgba(255,255,255,.45));text-decoration:line-through;text-decoration-color:rgba(255,255,255,.25)}' +
      '.yvc-list li.done .yvc-txt em{text-decoration:none}' +
      '.yvc-go{flex:none;margin-top:5px;width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;text-decoration:none;font-size:14px;color:var(--text-3,rgba(255,255,255,.5));transition:background .15s,color .15s}' +
      '.yvc-go:hover{background:rgba(147,197,253,.14);color:#93C5FD}' +
      /* 좁은 화면 — 오른쪽 아래 알약, 펼치면 시트 */
      '@media (max-width:1279px){' +
        '.yvc{top:auto;bottom:16px;right:16px;width:min(320px,calc(100vw - 32px))}' +
        '.yvc.is-fold{width:auto;border-radius:999px}' +
        '.yvc.is-fold .yvc-head{padding:8px 14px 8px 8px;gap:9px}' +
        '.yvc.is-fold .yvc-ring{width:32px;height:32px}.yvc.is-fold .yvc-ring b{font-size:10px}' +
        '.yvc.is-fold .yvc-ttl small{display:none}.yvc.is-fold .yvc-ttl strong{font-size:13px}' +
        '.yvc-list{max-height:min(52vh,420px);overflow:auto}' +
      '}' +
      '@media (prefers-reduced-motion:reduce){.yvc{animation:none}}';
    var st = document.createElement("style");
    st.id = "yv-checklist-css";
    st.textContent = css;
    document.head.appendChild(st);
  }

  window.yvChecklist = { init: init };
})();
