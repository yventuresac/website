/* ──────────────────────────────────────────────────────────────
   상단 네비게이션 — 로그인 링크 + 알림 벨

   1) 로그인 안돼 있으면 "LOGIN", 돼 있으면 "MY PAGE".
   2) 로그인 상태면 MY PAGE 옆에 벨을 놓고 site_updates 를 알림으로 보여준다.
      - 안 읽은 알림 수가 벨에 빨간 배지로 뜨고,
        알림이 가리키는 메뉴(예: Insights)와 그 부모(SCOUTS)에도 숫자가 붙는다.
      - 읽음 기록은 update_reads 테이블(계정 기준) — 다른 기기에서도 유지된다.
      - 읽음 처리: 벨을 열면 전체, 해당 구역 페이지를 방문하면 그 구역 알림만.

   navMenu(#navMenu)가 있는 페이지에서만 동작하며, 없으면 조용히 무시.
   스타일은 여기서 주입한다 — 23개 페이지의 CSS 버전을 건드리지 않기 위해.
   ────────────────────────────────────────────────────────────── */
(function () {
  var menu = document.getElementById("navMenu");
  if (!menu) return;

  var authLi = document.createElement("li");
  authLi.className = "nav-item nav-auth";
  var a = document.createElement("a");
  a.href = window.YV_LOGIN_PATH || "/auth/login.html";
  a.textContent = "Login";
  authLi.appendChild(a);
  menu.appendChild(authLi);

  if (!window.yvAuth) return; // 설정 전이면 기본 Login 링크 유지

  yvAuth.getUser().then(function (user) {
    if (!user) return;
    /* 로그인 상태면 학회원 허브로 안내한다. 로그아웃은 허브 안에 있다 */
    a.textContent = "MY PAGE";
    a.href = "/members/";
    initNotify(user);
  });

  /* ── 알림 ── */

  var KIND = { program: "프로그램", insight: "인사이트", newsletter: "뉴스레터", notice: "공지" };
  var FALLBACK = { insight: "/insights/", newsletter: "/newsletter/", program: "/programs/" };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* 알림이 속한 구역 — "/insights/post.html?no=3" → "/insights/".
     url 이 없으면 종류별 기본 구역, 공지는 구역 없음(벨에만 뜬다). */
  function sectionOf(u) {
    var url = String(u.url || "");
    if (!/^\//.test(url)) url = FALLBACK[u.kind] || "";
    var seg = url.split("?")[0].split("/")[1];
    return seg ? "/" + seg + "/" : null;
  }

  function markRead(db, user, items) {
    if (!items.length) return;
    var rows = items.map(function (u) { return { user_id: user.id, update_id: u.id }; });
    db.from("update_reads")
      .upsert(rows, { onConflict: "user_id,update_id", ignoreDuplicates: true })
      .then(function () {});
  }

  async function initNotify(user) {
    var db = yvAuth.client;
    var ur, rr;
    try {
      ur = await db.from("site_updates")
        .select("id, kind, title, url, created_at")
        .order("created_at", { ascending: false }).limit(20);
      if (ur.error) return; // 테이블이 없으면(마이그레이션 전) 조용히 생략
      rr = await db.from("update_reads").select("update_id");
      if (rr.error) return;
    } catch (e) { return; }

    var read = {};
    (rr.data || []).forEach(function (r) { read[r.update_id] = true; });
    var updates = ur.data || [];
    var unseen = updates.filter(function (u) { return !read[u.id]; });

    /* 지금 있는 페이지가 알림의 구역이면 그 알림은 본 것으로 친다 */
    var here = location.pathname;
    var visited = unseen.filter(function (u) {
      var s = sectionOf(u);
      return s && here.indexOf(s) === 0;
    });
    if (visited.length) {
      markRead(db, user, visited);
      visited.forEach(function (u) { read[u.id] = true; });
      unseen = unseen.filter(function (u) { return !read[u.id]; });
    }

    injectStyles();
    buildBell(db, user, updates, unseen, read);
    if (unseen.length) {
      badgeNav(unseen);
      var hb = document.getElementById("hamburger");
      if (hb) hb.classList.add("has-note");
    }
  }

  /* 안 읽은 알림 수를 해당 메뉴와 부모 메뉴에 붙인다 */
  function badgeNav(unseen) {
    var counts = {};
    unseen.forEach(function (u) {
      var s = sectionOf(u);
      if (s) counts[s] = (counts[s] || 0) + 1;
    });

    var anchors = menu.querySelectorAll("a[href]");
    var parentTotals = []; // [anchor, n] — 부모 메뉴 합산
    Object.keys(counts).forEach(function (s) {
      for (var i = 0; i < anchors.length; i++) {
        var el = anchors[i];
        var path;
        try { path = new URL(el.href, location.href).pathname; } catch (e) { continue; }
        if (path !== s) continue;
        addDot(el, counts[s]);
        var dd = el.closest(".dropdown");
        if (dd) {
          var top = dd.parentElement.querySelector(":scope > a");
          if (top) {
            var found = null;
            for (var j = 0; j < parentTotals.length; j++) if (parentTotals[j][0] === top) found = parentTotals[j];
            if (found) found[1] += counts[s]; else parentTotals.push([top, counts[s]]);
          }
        }
        break; // 구역당 첫 매칭 하나면 충분
      }
    });
    parentTotals.forEach(function (p) { addDot(p[0], p[1]); });
  }

  function addDot(el, n) {
    var dot = document.createElement("span");
    dot.className = "nav-dot";
    dot.textContent = n;
    el.appendChild(dot);
  }

  function buildBell(db, user, updates, unseen, read) {
    var li = document.createElement("li");
    li.className = "nav-item nav-bell";

    var items = updates.slice(0, 8).map(function (u) {
      var url = /^(\/|https?:\/\/)/.test(u.url || "") ? u.url : (FALLBACK[u.kind] || "");
      var date = String(u.created_at).slice(0, 10).replace(/-/g, ".");
      var isNew = !read[u.id];
      var inner = '<span class="nb-kind nb-' + esc(u.kind) + '">' + esc(KIND[u.kind] || u.kind) + '</span>' +
        '<span class="nb-title">' + esc(u.title) + '</span>' +
        '<span class="nb-date">' + esc(date) + (isNew ? ' <span class="nb-new">●</span>' : '') + '</span>';
      return url
        ? '<a class="nb-item" href="' + esc(url) + '">' + inner + '</a>'
        : '<div class="nb-item">' + inner + '</div>';
    }).join("");

    li.innerHTML =
      '<button type="button" class="nav-bell-btn" aria-label="알림" aria-expanded="false">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>' +
      (unseen.length ? '<span class="nav-bell-count">' + unseen.length + '</span>' : '') +
      '</button>' +
      '<div class="nav-bell-panel">' +
      (items || '<div class="nb-empty">알림이 없습니다.</div>') +
      '</div>';

    menu.insertBefore(li, authLi);

    var btn = li.querySelector(".nav-bell-btn");
    var panel = li.querySelector(".nav-bell-panel");

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = panel.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open && unseen.length) {
        /* 벨을 열었다 = 다 봤다. 배지를 걷고 기록한다 */
        markRead(db, user, unseen);
        unseen = [];
        var c = li.querySelector(".nav-bell-count");
        if (c) c.remove();
        document.querySelectorAll(".nav-dot").forEach(function (d) { d.remove(); });
        var hb = document.getElementById("hamburger");
        if (hb) hb.classList.remove("has-note");
      }
    });
    document.addEventListener("click", function (e) {
      if (!li.contains(e.target)) {
        panel.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
      }
    });
  }

  function injectStyles() {
    if (document.getElementById("nav-notify-css")) return;
    var css =
      '.nav-dot{display:inline-flex;align-items:center;justify-content:center;min-width:15px;height:15px;padding:0 4px;margin-left:6px;border-radius:999px;background:#EF4444;color:#fff;font-size:9px;font-weight:700;letter-spacing:0;line-height:1}' +
      '.nav-bell-btn{position:relative;display:flex;align-items:center;background:none;border:none;cursor:pointer;padding:4px;color:rgba(255,255,255,0.78);transition:color .2s}' +
      '.nav-bell-btn:hover{color:var(--blue-400,#60A5FA)}' +
      '.nav-bell-btn svg{width:17px;height:17px}' +
      '.nav-bell-count{position:absolute;top:-3px;right:-5px;display:flex;align-items:center;justify-content:center;min-width:15px;height:15px;padding:0 4px;border-radius:999px;background:#EF4444;color:#fff;font-size:9px;font-weight:700;line-height:1}' +
      '.nav-bell-panel{display:none;position:absolute;top:100%;right:-8px;width:320px;max-width:88vw;background:#2D333E;border:1px solid var(--edge,rgba(255,255,255,.1));border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.4);padding:6px 0;margin-top:2px;z-index:300}' +
      '.nav-bell-panel.open{display:block}' +
      '.nb-item{display:flex;align-items:baseline;gap:8px;padding:11px 16px;text-decoration:none;font-size:12px;color:rgba(255,255,255,.75)}' +
      'a.nb-item:hover{background:rgba(255,255,255,.06);color:#fff}' +
      '.nb-kind{flex:none;font-size:10px;letter-spacing:.06em;padding:1px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.18);color:rgba(255,255,255,.55)}' +
      '.nb-program{border-color:rgba(96,165,250,.4);color:#93C5FD}' +
      '.nb-insight{border-color:rgba(167,139,250,.4);color:#C4B5FD}' +
      '.nb-newsletter{border-color:rgba(52,211,153,.4);color:#6EE7B7}' +
      '.nb-notice{border-color:rgba(251,191,36,.4);color:#FCD34D}' +
      '.nb-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.5}' +
      '.nb-date{flex:none;font-size:10px;color:rgba(255,255,255,.4)}' +
      '.nb-new{color:#EF4444;font-size:8px;vertical-align:2px}' +
      '.nb-empty{padding:18px 16px;font-size:12px;color:rgba(255,255,255,.45);text-align:center}' +
      '.hamburger{position:relative}' +
      '.hamburger.has-note::after{content:"";position:absolute;top:-1px;right:-1px;width:7px;height:7px;border-radius:50%;background:#EF4444}' +
      '@media (max-width:640px){' +
      '.nav-bell{flex-direction:row !important;align-items:center !important;padding:0 20px}' +
      '.nav-bell-btn{padding:14px 0}' +
      '.nav-bell-panel{position:static;width:auto;box-shadow:none;border:none;background:transparent;margin:0;padding:0 0 8px}' +
      '.nb-item{padding:8px 16px}' +
      '}';
    var st = document.createElement("style");
    st.id = "nav-notify-css";
    st.textContent = css;
    document.head.appendChild(st);
  }
})();
