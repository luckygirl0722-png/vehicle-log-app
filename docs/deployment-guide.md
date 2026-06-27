# 배포 가이드 — 차량 운행일지 앱

## 1단계 — Supabase 운영 프로젝트 설정

```bash
# 1. Supabase 대시보드 (https://supabase.com) → New Project 생성
# 2. SQL Editor → supabase/migrations/001_init_schema.sql 전체 실행
# 3. SQL Editor → supabase/seed.sql 실행 (테스트 데이터 선택)
```

### 필수 환경변수 (Settings → API)
| 변수 | 위치 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → service_role |

### Auth 설정
- Authentication → Providers → Email 활성화
- Authentication → URL Configuration → Site URL: `https://your-domain.com`
- Redirect URLs 추가: `https://your-domain.com/auth/callback`

---

## 2단계 — Resend 이메일 설정

```
1. https://resend.com 가입
2. Domains → 발신 도메인 등록 (DNS 인증 필요)
3. API Keys → 키 생성
4. RESEND_API_KEY, EMAIL_FROM 환경변수에 등록
```

---

## 3단계 — Vercel 배포

```bash
# 1. GitHub에 코드 푸시
git add .
git commit -m "feat: 차량 운행일지 앱 완성"
git push origin main

# 2. Vercel (https://vercel.com) → Import Git Repository
# 3. Framework: Next.js (자동 감지)
# 4. Environment Variables 추가 (아래 목록 참조)
# 5. Deploy
```

### Vercel 환경변수 설정
```
NEXT_PUBLIC_SUPABASE_URL        = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = eyJ...
SUPABASE_SERVICE_ROLE_KEY       = eyJ...
NEXT_PUBLIC_APP_URL             = https://your-domain.com
RESEND_API_KEY                  = re_...
EMAIL_FROM                      = noreply@your-domain.com
```

### 커스텀 도메인 연결
```
Vercel → Project → Settings → Domains → Add Domain
DNS 설정: CNAME record → cname.vercel-dns.com
```

---

## 4단계 — 초기 관리자 설정

```sql
-- Supabase SQL Editor에서 실행
-- 1. 관리자 계정 생성 후 user_id 확인
SELECT id, email FROM auth.users WHERE email = 'admin@your-domain.com';

-- 2. admin 역할 부여
UPDATE public.user_roles
SET role = 'admin'
WHERE user_id = '<위에서 확인한 user_id>';
```

---

## 5단계 — 배포 후 확인 체크리스트

- [ ] `/login` 페이지 접근 확인
- [ ] 운전자 로그인 → 모바일 홈 진입
- [ ] 관리자 로그인 → 대시보드 진입
- [ ] 운행 기록 등록 → 대시보드 실시간 반영
- [ ] Excel/PDF 다운로드 정상 작동
- [ ] 이메일 알림 수신 확인
- [ ] PWA 설치 배너 표시 (모바일)
- [ ] 오프라인 → 온라인 동기화 확인

---

## 운영 모니터링

| 항목 | 도구 |
|------|------|
| 서버 로그 | Vercel Dashboard → Functions |
| DB 상태 | Supabase Dashboard → Database |
| 이메일 발송 현황 | Resend Dashboard → Emails |
| 에러 추적 | Vercel Dashboard → Deployments |
