/* ──────────────────────────────────────────────────────────────
   학회원 허브 첫 방문 가이드

   처음 들어온 학회원에게 이 페이지가 뭘 할 수 있는 곳인지 1분 안에 알려준다.
   실제 요소(캘린더·카드·벨)를 하나씩 비추며 짧게 설명하는 코치마크 방식 —
   모달로 기능을 나열하는 것보다 "어디에 뭐가 있는지"가 몸에 남는다.

     · 6단계, 단계당 두어 문장. 언제든 건너뛸 수 있다(Esc, 건너뛰기).
     · 다 봤거나 건너뛰면 다시 안 뜬다(브라우저·계정별 localStorage).
     · 인사 카드의 "이 페이지 사용법"으로 언제든 다시 볼 수 있다.
     · 비추는 요소가 아직 없으면(벨은 알림을 받아온 뒤 생긴다) 대체 요소로,
       그것도 없으면 그 단계는 건너뛴다.

   허브에서 yvGuide.start({ userId, force }) 로 부른다.
   스타일은 여기서 주입한다 — 허브 CSS 를 건드리지 않기 위해.
   ────────────────────────────────────────────────────────────── */
(function () {
  var NAV_H = 84;        // 고정 상단바 아래로 대상을 데려올 때 남길 여백
  var PAD = 10;          // 비추는 구멍의 여유
  var GAP = 14;          // 대상과 말풍선 사이

  var STEPS = [
    {
      target: [".mb-hello"],
      title: "학회원 공간입니다",
      body: "학회 일정, 글쓰기, 자료, 사람 — 학회 활동에 필요한 것이 이 한 페이지에 모여 있습니다. 1분이면 다 둘러봅니다."
    },
    {
      target: ["#calSlot"],
      title: "캘린더 — 학회 일정은 여기에",
      body: "스터디·프로젝트 세션부터 행사·휴회까지 한눈에. 날짜 칸을 누르거나 <b>+ 일정 등록</b>으로 누구나 일정을 올릴 수 있고, 세부 내용에 <b>@이름</b>을 쓰면 그 사람에게 메일이 갑니다."
    },
    {
      target: [".mb-wrap > .mb-grid", ".mb-grid"],
      title: "Workspace — 매주 쓰는 것",
      body: "<b>Insights 글쓰기</b>는 쓰다 만 글이 자동 임시저장되고 다른 기기에서 이어 쓸 수 있습니다. <b>게시판</b>에서 학회원 글을 읽고, <b>자료실</b>에서 세션 자료와 노션 링크를 찾습니다."
    },
    {
      target: [".mb-net .mb-grid", ".mb-net"],
      title: "Network &amp; Records — 가끔 들르는 것",
      body: "<b>알럼 디렉터리</b>에서 선배에게 연결을 요청하고, <b>동문 창업가 소식</b>을 제보하고, <b>내 활동</b>을 기록해 나중에 이력으로 씁니다. 행사 사진도 여기서 찾습니다."
    },
    {
      target: [".nav-bell", "#navMenu .nav-auth", "#hamburger"],
      title: "새 소식은 벨에 모입니다",
      body: "새 글·공지·일정이 올라오면 상단 벨에 숫자가 붙고, 해당 메뉴에도 빨간 배지가 붙습니다(모바일에서는 ☰ 메뉴 안). 벨을 열면 읽음 처리됩니다."
    },
    {
      target: ["#guideBtn", ".mb-hello"],
      title: "다시 보고 싶을 때는 여기",
      body: "인사 카드의 <b>이 페이지 사용법</b>을 누르면 이 안내를 언제든 다시 볼 수 있습니다. 이제 시작해 보세요."
    }
  ];

  var ui = null, idx = -1, steps = [], onDone = null, raf = 0, lastFocus = null, scrollSeq = 0;

  function key(uid) { return "yv_guide_seen_" + (uid || "anon"); }

  function seen(uid) {
    try { return !!localStorage.getItem(key(uid)); } catch (e) { return true; }
  }
  function markSeen(uid) {
    try { localStorage.setItem(key(uid), String(Date.now())); } catch (e) {}
  }

  /* 화면에 실제로 그려진 요소만 대상으로 친다 — 접힌 모바일 메뉴 안의 벨은 제외 */
  function visible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function resolve(step) {
    for (var i = 0; i < step.target.length; i++) {
      var el = document.querySelector(step.target[i]);
      if (visible(el)) return el;
    }
    return null;
  }

  function build() {
    injectStyles();
    ui = {};
    ui.veil = el("div", "yvg-veil");
    ui.hole = el("div", "yvg-hole");
    ui.tip = el("div", "yvg-tip");
    ui.tip.setAttribute("role", "dialog");
    ui.tip.setAttribute("aria-modal", "true");
    ui.tip.innerHTML =
      '<div class="yvg-count"></div>' +
      '<h3 class="yvg-title"></h3>' +
      '<p class="yvg-body"></p>' +
      '<div class="yvg-dots"></div>' +
      '<div class="yvg-btns">' +
        '<button type="button" class="yvg-skip">건너뛰기</button>' +
        '<span class="yvg-sp"></span>' +
        '<button type="button" class="yvg-prev">이전</button>' +
        '<button type="button" class="yvg-next">다음</button>' +
      '</div>';
    document.body.appendChild(ui.veil);
    document.body.appendChild(ui.hole);
    document.body.appendChild(ui.tip);

    ui.tip.querySelector(".yvg-skip").addEventListener("click", function () { finish(true); });
    ui.tip.querySelector(".yvg-prev").addEventListener("click", function () { go(idx - 1); });
    ui.tip.querySelector(".yvg-next").addEventListener("click", function () { go(idx + 1); });
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", queuePlace);
    window.addEventListener("scroll", queuePlace, true);
    document.body.classList.add("yvg-open");
  }

  function el(tag, cls) { var d = document.createElement(tag); d.className = cls; return d; }

  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); finish(true); }
    else if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); go(idx + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(idx - 1); }
  }

  function go(n) {
    if (n < 0) return;
    if (n >= steps.length) { finish(false); return; }
    idx = n;
    var step = steps[idx];
    var target = resolve(step);
    if (!target) {
      /* 비출 것이 없으면 이 단계는 조용히 넘어간다 */
      steps.splice(idx, 1);
      if (!steps.length) { finish(false); return; }
      go(Math.min(idx, steps.length - 1));
      return;
    }
    step.el = target;

    ui.tip.querySelector(".yvg-count").textContent = (idx + 1) + " / " + steps.length;
    ui.tip.querySelector(".yvg-title").innerHTML = step.title;
    ui.tip.querySelector(".yvg-body").innerHTML = step.body;
    ui.tip.querySelector(".yvg-dots").innerHTML = steps.map(function (_, i) {
      return '<i class="' + (i === idx ? "on" : "") + '"></i>';
    }).join("");
    ui.tip.querySelector(".yvg-prev").hidden = idx === 0;
    ui.tip.querySelector(".yvg-next").textContent = idx === steps.length - 1 ? "시작하기" : "다음";

    scrollTo(target);
    /* 스크롤이 자리를 잡은 뒤 배치한다. 그 뒤로는 스크롤·리사이즈마다 따라간다 */
    place();
    setTimeout(place, 220);
    setTimeout(function () { place(); ui.tip.querySelector(".yvg-next").focus({ preventScroll: true }); }, 420);
  }

  /* 대상이 상단바 아래에 오도록. 화면보다 크면 윗부분이 보이게 */
  function scrollTo(target) {
    var r = target.getBoundingClientRect();
    var vh = window.innerHeight;
    var top;
    if (r.height + NAV_H + 40 > vh) top = window.scrollY + r.top - NAV_H;
    else top = window.scrollY + r.top - (vh - r.height) / 2;
    if (top < 0) top = 0;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: top, behavior: reduce ? "auto" : "smooth" });
    /* 부드러운 스크롤이 중간에 끊기는 환경(백그라운드 탭 등)이 있어,
       도착하지 못했으면 그냥 옮겨 놓는다. 그 사이 다음 단계로 넘어갔으면 무시. */
    var token = ++scrollSeq;
    setTimeout(function () {
      if (ui && token === scrollSeq && Math.abs(window.scrollY - top) > 40) {
        window.scrollTo({ top: top, behavior: "auto" });
      }
    }, 500);
  }

  function queuePlace() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; place(); });
  }

  function place() {
    if (!ui || idx < 0) return;
    var step = steps[idx];
    var target = step.el;
    if (!visible(target)) { target = resolve(step); if (!target) return; step.el = target; }
    var r = target.getBoundingClientRect();
    var vw = window.innerWidth, vh = window.innerHeight;

    ui.hole.style.top = (r.top - PAD) + "px";
    ui.hole.style.left = (r.left - PAD) + "px";
    ui.hole.style.width = (r.width + PAD * 2) + "px";
    ui.hole.style.height = (r.height + PAD * 2) + "px";

    var tip = ui.tip;
    tip.classList.remove("at-bottom");
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var below = r.bottom + PAD + GAP;
    var above = r.top - PAD - GAP - th;
    var left = Math.max(12, Math.min(r.left, vw - tw - 12));
    var top;
    if (below + th <= vh - 12) top = below;
    else if (above >= NAV_H) top = above;
    else {
      /* 위아래 다 자리가 없다(대상이 화면보다 크다) — 화면 아래에 붙인다 */
      tip.classList.add("at-bottom");
      top = vh - th - 12;
      left = Math.max(12, Math.min(left, vw - tw - 12));
    }
    tip.style.top = top + "px";
    tip.style.left = left + "px";
  }

  function finish(skipped) {
    if (!ui) return;
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", queuePlace);
    window.removeEventListener("scroll", queuePlace, true);
    document.body.classList.remove("yvg-open");
    ui.veil.remove(); ui.hole.remove(); ui.tip.remove();
    ui = null; idx = -1;
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
    if (onDone) onDone(skipped);
  }

  /* opts.userId — 본 적 있는지 기록할 키. opts.force — 봤어도 다시 연다. */
  function start(opts) {
    opts = opts || {};
    if (ui) return false;
    if (!opts.force && seen(opts.userId)) return false;
    steps = STEPS.map(function (s) { return { target: s.target, title: s.title, body: s.body }; });
    lastFocus = document.activeElement;
    onDone = function () { markSeen(opts.userId); if (opts.onDone) opts.onDone(); };
    build();
    go(0);
    return true;
  }

  function injectStyles() {
    if (document.getElementById("yv-guide-css")) return;
    var css =
      '.yvg-veil{position:fixed;inset:0;z-index:900}' +
      '.yvg-hole{position:fixed;z-index:901;border-radius:16px;pointer-events:none;' +
        'box-shadow:0 0 0 9999px rgba(3,5,10,.68),0 0 0 1px rgba(147,197,253,.55),0 0 28px rgba(96,165,250,.25);' +
        'transition:top .32s cubic-bezier(.16,1,.3,1),left .32s cubic-bezier(.16,1,.3,1),width .32s cubic-bezier(.16,1,.3,1),height .32s cubic-bezier(.16,1,.3,1)}' +
      '.yvg-tip{position:fixed;z-index:902;width:min(380px,calc(100vw - 24px));padding:18px 20px 16px;' +
        'background:var(--bg-elevated,#161A23);color:var(--text-1,#fff);border:1px solid rgba(147,197,253,.28);border-radius:16px;' +
        'box-shadow:0 24px 60px rgba(0,0,0,.55);font-family:"Pretendard",sans-serif;' +
        'transition:top .32s cubic-bezier(.16,1,.3,1),left .32s cubic-bezier(.16,1,.3,1);animation:yvgIn .35s cubic-bezier(.16,1,.3,1) both}' +
      '@keyframes yvgIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +
      '.yvg-count{font-size:11px;letter-spacing:.12em;color:#93C5FD;margin-bottom:8px}' +
      '.yvg-title{margin:0 0 8px;font-size:17px;font-weight:700;letter-spacing:-.01em;line-height:1.35}' +
      '.yvg-body{margin:0;font-size:13.5px;line-height:1.65;color:var(--text-2,rgba(255,255,255,.75))}' +
      '.yvg-body b{color:var(--text-1,#fff);font-weight:600}' +
      '.yvg-dots{display:flex;gap:5px;margin:14px 0 12px}' +
      '.yvg-dots i{display:block;width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.18)}' +
      '.yvg-dots i.on{width:18px;border-radius:3px;background:#93C5FD}' +
      '.yvg-btns{display:flex;align-items:center;gap:8px}' +
      '.yvg-sp{flex:1}' +
      '.yvg-btns button{font-family:inherit;font-size:13px;cursor:pointer;border-radius:9px;padding:8px 14px;border:1px solid transparent;transition:background .15s,border-color .15s,color .15s}' +
      '.yvg-skip{background:none;color:var(--text-3,rgba(255,255,255,.5));padding-left:4px!important}' +
      '.yvg-skip:hover{color:var(--text-1,#fff)}' +
      '.yvg-prev{background:none;color:var(--text-2,rgba(255,255,255,.75));border-color:var(--edge,rgba(255,255,255,.14))!important}' +
      '.yvg-prev:hover{border-color:rgba(255,255,255,.35)!important;color:#fff}' +
      '.yvg-next{background:#fff;color:#0B0D12;font-weight:600}' +
      '.yvg-next:hover{background:#DCEBFF}' +
      '.yvg-btns button:focus-visible{outline:2px solid #93C5FD;outline-offset:2px}' +
      '.yvg-open{overflow-x:hidden}' +
      '@media (max-width:640px){.yvg-tip{padding:16px 16px 14px}.yvg-title{font-size:16px}}' +
      '@media (prefers-reduced-motion:reduce){.yvg-hole,.yvg-tip{transition:none;animation:none}}';
    var st = document.createElement("style");
    st.id = "yv-guide-css";
    st.textContent = css;
    document.head.appendChild(st);
  }

  window.yvGuide = { start: start, seen: seen };
})();
