/* ──────────────────────────────────────────────────────────────
   Y-VENTURES 인증 헬퍼 (Supabase 이메일 + 비밀번호)

   필요 스크립트 (이 파일보다 먼저 로드):
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="/js/auth-config.js"></script>
     <script src="/js/auth.js"></script>

   사용:
     await yvAuth.signUp(email, password, name)
     await yvAuth.signIn(email, password)
     await yvAuth.signOut()
     await yvAuth.getUser()         // 로그인 안돼있으면 null
     await yvAuth.requireAuth()     // 보호 페이지 상단에서 호출 (미로그인 시 로그인으로 리다이렉트)
   ────────────────────────────────────────────────────────────── */
(function () {
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("[yvAuth] supabase-js 가 로드되지 않았습니다. CDN 스크립트를 먼저 넣어주세요.");
    return;
  }
  if (!window.YV_SUPABASE_URL || window.YV_SUPABASE_URL.indexOf("YOUR-PROJECT") !== -1) {
    console.error("[yvAuth] js/auth-config.js 에 Supabase URL / anon key 를 채워주세요.");
  }

  var client = window.supabase.createClient(
    window.YV_SUPABASE_URL,
    window.YV_SUPABASE_ANON_KEY
  );

  function loginPath() { return window.YV_LOGIN_PATH || "/auth/login.html"; }

  /* next 리다이렉트 검증: 동일 출처 상대경로(단일 '/' 시작)만 허용.
     '//evil.com', 'https://...', 'javascript:...' 등은 모두 기본 경로로 대체 → 오픈 리다이렉트/XSS 차단 */
  function safeNext(n) {
    return (typeof n === "string" && /^\/(?!\/)/.test(n))
      ? n
      : (window.YV_AFTER_LOGIN_PATH || "/index.html");
  }

  var yvAuth = {
    client: client,
    safeNext: safeNext,

    /* 회원가입. name 은 user_metadata.full_name 으로 저장 */
    async signUp(email, password, name) {
      return await client.auth.signUp({
        email: email,
        password: password,
        options: { data: { full_name: name || "" } }
      });
    },

    async signIn(email, password) {
      return await client.auth.signInWithPassword({ email: email, password: password });
    },

    async signOut() {
      return await client.auth.signOut();
    },

    /* 현재 로그인 사용자 (없으면 null) */
    async getUser() {
      var res = await client.auth.getSession();
      return (res && res.data && res.data.session) ? res.data.session.user : null;
    },

    /* 보호 페이지 가드: 미로그인 시 로그인 페이지로 보냄.
       로그인돼 있으면 페이지를 노출(visibility 복구)하고 user 반환. */
    async requireAuth() {
      var user = await this.getUser();
      if (!user) {
        var next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.replace(loginPath() + "?next=" + next);
        return null;
      }
      document.documentElement.classList.remove("yv-gated");
      return user;
    },

    /* 로그인된 상태면 들어올 필요 없는 페이지(로그인/가입)에서 호출 */
    async redirectIfAuthed() {
      var user = await this.getUser();
      if (user) {
        var params = new URLSearchParams(window.location.search);
        window.location.replace(safeNext(params.get("next")));
      }
    }
  };

  window.yvAuth = yvAuth;
})();
