/* ──────────────────────────────────────────────────────────────
   Y-VENTURES 로그인 설정 (Supabase)

   아래 두 값을 본인 Supabase 프로젝트 값으로 교체하세요.
   Supabase 대시보드 → Project Settings → Data API(또는 API) 에서 확인:
     - Project URL          → YV_SUPABASE_URL
     - Project API Keys > anon public  → YV_SUPABASE_ANON_KEY

   ⚠️ anon(public) 키는 브라우저에 노출돼도 안전한 공개 키입니다.
      절대 service_role(secret) 키는 여기에 넣지 마세요.
   ────────────────────────────────────────────────────────────── */

window.YV_SUPABASE_URL      = "https://inlxwukdloehnfnoklza.supabase.co";
window.YV_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubHh3dWtkbG9laG5mbm9rbHphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MDk2MTIsImV4cCI6MjA5NzE4NTYxMn0.mGm1P7YkMFuzouyTQaHVM_m2wir1npVVtTWMu3_hnaM";

/* 로그인하지 않은 사용자가 보호 페이지에 접근하면 이 경로로 보냅니다. */
window.YV_LOGIN_PATH = "/auth/login.html";
/* 로그인 성공 후 기본 이동 경로 (?next= 파라미터가 있으면 그쪽 우선) */
window.YV_AFTER_LOGIN_PATH = "/index.html";
