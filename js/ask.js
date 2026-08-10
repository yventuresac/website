/* 질문하기 — 우측 하단 떠 있는 버튼
   로그인한 사용자가 바로 질문을 남기면 questions 테이블에 저장되고,
   DB 트리거가 accelerator@yventures.ac 로 메일을 보낸다.

   각 페이지에는 <script src="/js/ask.js" defer></script> 한 줄만 추가한다.
   Supabase 설정(auth-config.js, auth.js)이 없는 페이지에서는 스스로 물러난다. */
(function () {
  var MAX = 3000;

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function build() {
    if (document.getElementById('askBtn')) return;

    var btn = el('button', 'ask-fab');
    btn.id = 'askBtn';
    btn.type = 'button';
    btn.setAttribute('aria-label', '질문하기');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"' +
      ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/>' +
      '</svg><span class="ask-fab-label">질문하기</span>';

    var panel = el('div', 'ask-panel');
    panel.id = 'askPanel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', '질문하기');
    panel.hidden = true;
    panel.innerHTML =
      '<div class="ask-head">' +
        '<div>' +
          '<div class="ask-title">궁금한 점이 있으신가요?</div>' +
          '<div class="ask-sub">학회 담당자가 이메일로 답변드립니다.</div>' +
        '</div>' +
        '<button type="button" class="ask-close" id="askClose" aria-label="닫기">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"' +
          ' stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="ask-body" id="askBody"></div>';

    document.body.appendChild(btn);
    document.body.appendChild(panel);
    return { btn: btn, panel: panel };
  }

  function loginView(body) {
    var next = encodeURIComponent(location.pathname + location.search);
    body.innerHTML =
      '<p class="ask-note">질문을 남기려면 로그인이 필요합니다.<br>' +
      '답변을 보내드릴 이메일을 확인하기 위해서입니다.</p>' +
      '<div class="ask-actions">' +
        '<a class="btn btn-black" href="/auth/login.html?next=' + next + '">로그인</a>' +
        '<a class="btn btn-outline" href="/auth/signup.html?next=' + next + '">회원가입</a>' +
      '</div>' +
      '<p class="ask-alt">계정 없이 보내시려면 ' +
      '<a href="mailto:accelerator@yventures.ac">accelerator@yventures.ac</a> 로 메일 주세요.</p>';
  }

  function formView(body, user, name) {
    body.innerHTML =
      '<form class="ask-form" id="askForm">' +
        '<textarea id="askText" rows="5" maxlength="' + MAX + '" required ' +
          'placeholder="예) 타 학교 학생도 지원할 수 있나요?"></textarea>' +
        '<div class="ask-meta">' +
          '<span id="askCount">0 / ' + MAX + '</span>' +
          '<span class="ask-from">' + name + ' · ' + user.email + '</span>' +
        '</div>' +
        '<div class="ask-actions">' +
          '<button type="submit" class="btn btn-black" id="askSend">보내기</button>' +
        '</div>' +
        '<p class="ask-status" id="askStatus" role="status"></p>' +
      '</form>';

    var ta = document.getElementById('askText');
    var count = document.getElementById('askCount');
    ta.addEventListener('input', function () {
      count.textContent = ta.value.length + ' / ' + MAX;
    });

    var sending = false;
    document.getElementById('askForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (sending) return;
      var text = ta.value.trim();
      var status = document.getElementById('askStatus');
      if (text.length < 5) { status.textContent = '조금만 더 자세히 적어주세요.'; return; }

      sending = true;
      var sendBtn = document.getElementById('askSend');
      sendBtn.disabled = true;
      status.className = 'ask-status';
      status.textContent = '보내는 중…';

      var res = await yvAuth.client.from('questions').insert({
        user_id: user.id,
        author_name: name,
        author_email: user.email,
        body: text,
        page_url: location.pathname
      });

      sending = false;
      sendBtn.disabled = false;

      if (res.error) {
        status.className = 'ask-status is-error';
        status.textContent = /잠시 후/.test(res.error.message)
          ? '질문이 너무 자주 접수되었습니다. 잠시 후 다시 시도해 주세요.'
          : '전송에 실패했습니다. accelerator@yventures.ac 로 메일 주시면 확인하겠습니다.';
        return;
      }

      body.innerHTML =
        '<div class="ask-done">' +
          '<div class="ask-done-mark" aria-hidden="true">✓</div>' +
          '<p class="ask-done-title">질문이 전달되었습니다</p>' +
          '<p class="ask-note">' + user.email + ' 로 답변드리겠습니다.</p>' +
        '</div>';
    });

    setTimeout(function () { ta.focus(); }, 60);
  }

  async function init() {
    if (!window.yvAuth || !yvAuth.client) return;   // 설정이 없는 페이지에서는 만들지 않는다

    var ui = build();
    if (!ui) return;
    var btn = ui.btn, panel = ui.panel;
    var loaded = false;

    async function open() {
      panel.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(function () { panel.classList.add('is-open'); });

      if (loaded) return;
      loaded = true;
      var body = document.getElementById('askBody');
      body.innerHTML = '<p class="ask-note">불러오는 중…</p>';
      var user = null;
      try { user = await yvAuth.getUser(); } catch (e) {}
      if (!user) { loginView(body); loaded = false; return; }

      var name = (user.user_metadata && user.user_metadata.full_name) || user.email.split('@')[0];
      try {
        var p = await yvAuth.client.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
        if (p.data && p.data.display_name) name = p.data.display_name;
      } catch (e) {}
      formView(body, user, name);
    }

    function close() {
      panel.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      setTimeout(function () { panel.hidden = true; }, 200);
    }

    btn.addEventListener('click', function () {
      if (panel.hidden) open(); else close();
    });
    document.getElementById('askClose').addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) { close(); btn.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (panel.hidden) return;
      if (panel.contains(e.target) || btn.contains(e.target)) return;
      close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
