# yventures.ac 현행 사이트 분석

> 목적: 현행 사이트를 기준으로 구조·디자인·톤을 파악하고, 리빌드 시 개선 방향 도출

---

## 1. 사이트 개요

| 항목 | 내용 |
|---|---|
| URL | https://yventures.ac |
| 플랫폼 | imweb (국내 노코드 빌더) |
| 언어 | 한/영 혼용 |
| 저작권 | © 2025 Y-VENTURES |

**한 줄 포지셔닝:** "연세대학교 학생 주도 스타트업 엑셀러레이터"

---

## 2. 사이트 구조 (IA)

```
yventures.ac
├── ABOUT
│   ├── Who we are
│   ├── Greetings
│   └── History
├── ACCELERATOR
│   ├── Boost Program
│   └── Y-Startup
├── ACADEMIA
│   ├── Curriculum
│   ├── Recruiting
│   ├── FAQ
│   └── Insight
├── PEOPLE
│   ├── Our Team
│   ├── Portfolio
│   └── Partners
└── CONTACT
```

---

## 3. 페이지별 콘텐츠 구성

### 메인 (홈)

- **Hero:** "ACCELERATE THE YONSEI STARTUP ECOSYSTEM" 대형 타이틀
- **Stats 섹션:** 숫자 3개로 신뢰감 구축
  - 투자 유치율 75%
  - 서비스 출시율 100%
  - 등록 창업가 210+
- **About 요약:** 한 문장 미션 + "더보기" 버튼
- **CTA:** Accelerator / Academia 각 프로그램으로 분기

### ABOUT

- "WHO WE ARE" 제목
- "WHY-VENTURES?" 섹션으로 설립 목적 서술
- 핵심 메시지: "초기 창업팀을 발굴하여 투자 유치가 가능한 유망 팀으로 성장하는 과정을 서포트"
- Greetings (대표 인사말), History (연혁) 서브페이지

### ACCELERATOR

- 핵심 메시지: "유망한 연세 초기 창업팀을 누구보다 먼저 발굴하여 폭발적인 성장과 실행을 할 수 있도록 지원합니다"
- Boost Program / Y-Startup 두 트랙 소개

### ACADEMIA

- "연세대학교 최초이자 유일한 VC학회, Y-Ventures Academia"
- APPLY CTA 버튼 강조

### PEOPLE

- Our Team: 팀원 소개
- Portfolio: 투자 기업 목록
- Partners: 파트너사 로고 나열

### CONTACT

3가지 문의 카테고리, 각각 Airtable 폼 연결:
- Y-VENTURES COFFEE CHAT (창업 상담)
- JOIN Y-VENTURES NETWORK (네트워크 참여)
- WORK WITH US (협업 문의)

---

## 4. 디자인 분석

### 4-1. 색상

imweb 기반으로 CSS 직접 접근이 제한적이나, 페이지 콘텐츠와 구조에서 파악한 내용:

| 역할 | 추정 색상 |
|---|---|
| 배경 | White (#FFFFFF) 또는 Off-white |
| 주 텍스트 | Black 또는 Near-black |
| 강조/Accent | 불명확 - 단색 계열로 추정 |
| CTA 버튼 | 어두운 계열 (블랙 또는 네이비) |

- 전체적으로 모노크롬 계열로 구성된 것으로 추정
- 색상보다 타이포그래피와 레이아웃으로 위계 구성

### 4-2. 타이포그래피

- 영문 헤드라인: 전체 대문자(All Caps) 사용 일관됨
  - "WHO WE ARE", "WHY-VENTURES?", "ACCELERATE THE YONSEI STARTUP ECOSYSTEM"
- 한/영 혼용: 섹션 타이틀은 영문, 설명 바디는 한국어
- 폰트 패밀리: imweb 기본 제공 폰트 사용 추정

### 4-3. 레이아웃

- 상단 고정(fixed) 헤더 + 드롭다운 네비게이션
- 풀스크린 Hero 섹션
- 섹션별 스크롤 구조 (단일 페이지 스크롤 + 서브페이지 분리 혼용)
- 반응형(모바일) 지원 - 햄버거 메뉴 사용
- 이미지: 기본 프로필 이미지(`default_profile.png`) 등 imweb 기본 에셋 사용

### 4-4. 인터랙션

- 알림 시스템 내장 (imweb 기능)
- 마이페이지 / 로그인 기능 (imweb 회원 기능)
- 외부 폼: Airtable 연동 (Contact 페이지)
- 소셜: Instagram, LinkedIn, KakaoTalk

---

## 5. 톤앤매너

| 항목 | 현행 |
|---|---|
| 언어 믹스 | 한영 혼용 (영문 타이틀 + 한국어 설명) |
| 문체 | 격식체, 전문적 |
| 감성 | 스타트업 특유의 에너지감 - "폭발적인 성장", "발굴" |
| 키워드 | Accelerate, Ecosystem, Student-Run |
| 타깃 | 연세대 재학생 창업자, 외부 파트너사 |

---

## 6. 현행 사이트 한계점

1. **플랫폼 제약** - imweb은 커스텀 CSS/JS에 한계, 디자인 자유도 낮음
2. **에셋 퀄리티** - 기본 프로필 이미지 등 imweb 기본 에셋 그대로 사용
3. **타이포그래피 완성도** - 폰트 계층구조가 단순, 브랜드 아이덴티티 약함
4. **인터랙션** - 로그인/알림 등 불필요한 imweb 기능이 UI를 복잡하게 만듦
5. **비주얼 임팩트 부족** - Hero가 텍스트 중심, 시각적 차별화 요소 없음
6. **로딩 속도** - imweb 특성상 외부 스크립트 다수 로드

---

## 7. 리빌드 방향 (개선 목표)

### 유지할 것

- 한/영 혼용 구조 (영문 타이틀, 한국어 설명)
- 5대 섹션 IA (About / Accelerator / Academia / People / Contact)
- 모노크롬 계열 색상 기조
- Stats로 신뢰감 구축하는 패턴

### 개선할 것

| 항목 | 현행 | 목표 |
|---|---|---|
| 플랫폼 | imweb (노코드) | 정적 HTML/CSS 또는 Next.js |
| 타이포그래피 | 기본 폰트 | Neue Haas Grotesk / Pretendard 조합 |
| Hero | 텍스트 위주 | 강한 타이포그래피 + 미니멀 레이아웃 |
| 인터랙션 | 로그인/알림 복잡 | 필요한 것만 - 스크롤 애니메이션 정도 |
| 이미지 에셋 | imweb 기본 | 직접 제작 또는 고퀄 사진 |
| 모바일 | 반응형 기본 | Mobile-first 설계 |
| Contact | Airtable 폼 외부 연결 | 페이지 내 인라인 폼 또는 깔끔한 이메일 CTA |

### 레퍼런스 방향성

- 극도의 미니멀 + 타이포그래피 중심
- 여백을 적극 활용한 고급감
- VC/스타트업 생태계에서 신뢰감을 주는 전문적 느낌
- 참고: Linear.app, Vercel.com 등 테크 미니멀리즘

---

*분석 기준일: 2026-04-17*
