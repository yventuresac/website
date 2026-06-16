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
    a.textContent = "Logout";
    a.href = "#";
    a.addEventListener("click", async function (e) {
      e.preventDefault();
      await yvAuth.signOut();
      window.location.reload();
    });
  });
})();
