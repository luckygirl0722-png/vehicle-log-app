# 🚗 실시간 차량일지 작성 앱

삼우에레코주식회사 영업용 차량의 운행 내역을 실시간으로 기록하고, 세무·회계용 차량운행일지를 자동 생성하는 웹 기반 시스템입니다.

- **관리자 웹**: 차량·운전자 관리, 운행현황 모니터링, 승인 처리, Excel/PDF 보고서 출력
- **운전자 앱**: 모바일 브라우저에서 출발·도착 기록 입력, 운행일지 제출

**서비스 URL**: https://vehicle-log-app-two.vercel.app

## 문서 안내

| 문서 | 용도 |
|------|------|
| [01_SETUP.md](./01_SETUP.md) | 로컬 개발 환경 빠른 설치 가이드 |
| [02_HANDOVER.md](./02_HANDOVER.md) | 프로젝트 전체 구조·DB 스키마·배포/이관 체크리스트 등 종합 가이드 |
| [CLAUDE.md](./CLAUDE.md) | AI(Claude)에게 작업을 맡길 때 반드시 먼저 읽혀야 하는 프로젝트 컨텍스트 문서 |

## 빠른 시작

```bash
npm install
cp .env.example .env.local   # 환경변수 입력 (01_SETUP.md 참고)
npm run dev                  # http://localhost:3000
```

## 기술 스택

Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase (PostgreSQL + Auth + RLS) · SheetJS · @react-pdf/renderer · Resend · Vercel
