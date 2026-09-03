# Supabase 인증 메일 — 한국어 템플릿

Supabase 대시보드 → **Authentication → Emails → Templates** 탭에서 각 템플릿을 열어
Subject 와 Body(HTML)를 아래로 바꾸고 Save. 코드가 아니라 대시보드 설정이라
여기에는 붙여넣을 원본만 보관한다.

발송은 Resend SMTP(`notify@yventures.ac`, 2026-09-03 연결됨)로 나간다.
`{{ .ConfirmationURL }}` 같은 변수는 그대로 둘 것 — Supabase 가 링크로 바꾼다.

확인 링크는 `/auth/login.html?confirmed=1` 로 돌아온다(js/auth.js 의 emailRedirectTo).
그 주소가 **Authentication → URL Configuration → Redirect URLs** 에 허용돼 있어야 한다.
  - Site URL: `https://yventures.ac`
  - Redirect URLs: `https://yventures.ac/**`, `http://localhost:8080/**`

---

## Confirm signup — 가입 확인

**Subject**
```
[Y-VENTURES] 이메일 주소를 확인해 주세요
```

**Body**
```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Pretendard','Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1a1a;line-height:1.7">
  <p style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;color:#2563eb;font-weight:600">Y-VENTURES</p>
  <h1 style="margin:0 0 18px;font-size:22px;font-weight:800;letter-spacing:-.02em">이메일 주소를 확인해 주세요</h1>
  <p style="margin:0 0 24px;font-size:15px;color:#444">Y-VENTURES 홈페이지 가입을 마치려면 아래 버튼을 눌러 이메일 주소를 확인해 주세요. 학회원 권한은 확인 후 운영진이 승인하면 열립니다.</p>
  <p style="margin:0 0 28px"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 22px;background:#111;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px">이메일 확인하기</a></p>
  <p style="margin:0 0 6px;font-size:13px;color:#777">버튼이 안 눌리면 아래 주소를 복사해 브라우저에 붙여넣으세요.</p>
  <p style="margin:0 0 28px;font-size:12px;color:#999;word-break:break-all">{{ .ConfirmationURL }}</p>
  <p style="margin:0;font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px">본인이 가입한 것이 아니라면 이 메일은 무시하셔도 됩니다. 링크는 한 번만 쓸 수 있고 1시간 뒤 만료됩니다.</p>
</div>
```

---

## Reset password — 비밀번호 재설정

**Subject**
```
[Y-VENTURES] 비밀번호 재설정 안내
```

**Body**
```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Pretendard','Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1a1a;line-height:1.7">
  <p style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;color:#2563eb;font-weight:600">Y-VENTURES</p>
  <h1 style="margin:0 0 18px;font-size:22px;font-weight:800;letter-spacing:-.02em">비밀번호를 재설정합니다</h1>
  <p style="margin:0 0 24px;font-size:15px;color:#444">아래 버튼을 누르면 새 비밀번호를 정할 수 있습니다.</p>
  <p style="margin:0 0 28px"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 22px;background:#111;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px">비밀번호 재설정</a></p>
  <p style="margin:0 0 6px;font-size:13px;color:#777">버튼이 안 눌리면 아래 주소를 복사해 브라우저에 붙여넣으세요.</p>
  <p style="margin:0 0 28px;font-size:12px;color:#999;word-break:break-all">{{ .ConfirmationURL }}</p>
  <p style="margin:0;font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px">요청한 적이 없다면 이 메일은 무시하셔도 됩니다. 비밀번호는 바뀌지 않습니다.</p>
</div>
```

---

## Magic Link / Change Email

지금 사이트는 비밀번호 로그인만 쓰므로 손대지 않아도 된다. 나중에 쓰게 되면
위 형식을 그대로 따라 만들 것.
