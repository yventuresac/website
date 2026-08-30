/* ──────────────────────────────────────────────────────────────
   상단 네비게이션에 Login / Logout 링크 주입.
   - 로그인 안돼 있으면: "LOGIN" (로그인 페이지로 이동)
   - 로그인돼 있으면:   "LOGOUT" (클릭 시 로그아웃 후 새로고침)
   navMenu(#navMenu)가 있는 페이지에서만 동작하며, 없으면 조용히 무시.
   ────────────────────────────────────────────────────────────── */
(function () {
  var menu = document.getElementById("navMenu");
  if (!menu) return;

  var li = document.createElement("li");
  li.className = "nav-item nav-auth";
  var a = document.createElement("a");
  a.href = window.YV_LOGIN_PATH || "/auth/login.html";
  a.textContent = "Login";
  li.appendChild(a);
  menu.appendChild(li);

  if (!window.yvAuth) return; // 설정 전이면 기본 Login 링크 유지

  yvAuth.getUser().then(function (user) {
    if (!user) return;
    /* 로그인 상태면 학회원 허브로 안내한다. 로그아웃은 허브 안에 있다 —
       네비의 한 칸을 로그아웃에 쓰는 것보다 갈 곳을 보여주는 쪽이 낫다. */
    a.textContent = "MY PAGE";
    a.href = "/members/";
  });
})();
