# LOGI 입고관리 (3PL Inbound)

3PL이 화주사의 입고예정을 받아 입고처리까지 기록·관리하는 웹 애플리케이션입니다.

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 프론트엔드 | Vite, React 19, TypeScript, React Router |
| UI | Tailwind CSS v4, shadcn/ui (Radix, Nova), Lucide, Pretendard |
| 데이터 | TanStack Query, TanStack Table, react-hook-form + zod, SheetJS |
| 백엔드 | Supabase (PostgreSQL, Auth, RLS) |
| 배포 | Vercel |

## 시작하기

```bash
npm install --legacy-peer-deps   # @hookform/resolvers의 선택적 peer 충돌 회피
cp .env.example .env.local       # Supabase URL / ANON KEY 입력
npm run dev                      # http://localhost:5173
```

## 주요 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입 검사 + 프로덕션 빌드 |
| `npm run lint` / `npm run format` | 린트(oxlint) / 포맷(prettier) |
| `npm run db:start` | 로컬 Supabase 기동 (Docker 필요) |
| `npm run db:reset` | 마이그레이션·시드 재적용 |
| `npm run db:types` | DB 타입 생성 → `src/types/database.types.ts` |

## 폴더 구조

```
src/
├─ app/            라우터, 메뉴 정의, 레이아웃(사이드바·헤더·⌘K·테마)
├─ components/ui/  shadcn 컴포넌트
├─ features/       업무 단위 화면 (dashboard, …)
├─ hooks/  lib/    공용 훅, supabase·query client
supabase/          config, migrations
```

## 배포 (Vercel)

GitHub 저장소를 Vercel 프로젝트에 연결하고, Environment Variables에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 등록합니다. SPA 라우팅은 `vercel.json`의 rewrite로 처리합니다.
