/* ──────────────────────────────────────────────────────────────
   회원 전용 페이지 가드.

   보호할 페이지의 <head> 안에, 아래 순서로 추가하세요:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="/js/auth-config.js"></script>
     <script src="/js/auth.js"></script>
     <script src="/js/auth-guard.js"></script>

   동작:
     - 로딩 즉시 페이지를 숨김(yv-gated) → 미로그인 사용자에게 내용이 깜빡 노출되지 않음
     - 로그인돼 있으면 페이지를 보여주고, 아니면 로그인 페이지로 보냄(?next=현재경로)
   ────────────────────────────────────────────────────────────── */
document.documentElement.classList.add("yv-gated");

window.addEventListener("DOMContentLoaded", function () {
  if (window.yvAuth && typeof window.yvAuth.requireAuth === "function") {
    yvAuth.requireAuth();
  } else {
    // 설정이 안 된 경우: 사이트가 완전히 잠기지 않도록 노출하고 콘솔에 경고
    console.error("[auth-guard] yvAuth 미초기화 — auth-config.js 설정을 확인하세요.");
    document.documentElement.classList.remove("yv-gated");
  }
});
