# LOGI 입고관리 (3PL Inbound)

3PL이 화주사의 입고예정을 받아 입고처리까지 기록·관리하는 웹 애플리케이션입니다.
범위: 입고예정 등록 → 승인 → 차량별 ASN·상차지시 → (PDA) 상차 → (PDA) 검수·입고완료

## 설계 문서

| 문서 | 내용 |
|---|---|
| [01 업무 프로세스](docs/01-process-flow.md) | 역할별 업무 흐름, 단계별 상세, 이상 처리 |
| [02 전표 흐름](docs/02-document-flow.md) | IP→AS→LD→GR 전표 체계, 상태 다이어그램, 정합성 규칙 R1~R13 |
| [03 ERD](docs/03-erd.md) | ERD, 테이블 정의, 이력 테이블 규칙 |
| [04 기준정보](docs/04-master-data.md) | 기준정보 7종 항목·권한·공통코드 초기값 |

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 프론트엔드 | Vite, React 19, TypeScript, React Router |
| UI | Tailwind CSS v4, shadcn/ui (Radix, Nova), Lucide, Pretendard |
| 데이터 | TanStack Query, TanStack Table v9, react-hook-form + zod, SheetJS |
| 백엔드 | Supabase (PostgreSQL, Auth, RLS, Edge Functions) |
| 배포 | Vercel |

## 시작하기

### 1. 앱 실행
```bash
npm install --legacy-peer-deps   # @hookform/resolvers의 선택적 peer 충돌 회피
cp .env.example .env.local       # Supabase URL / ANON KEY 입력
npm run dev                      # http://localhost:5173
```

### 2. Supabase 프로젝트 연결 (최초 1회)
```bash
npx supabase login                          # 브라우저 로그인
npx supabase link --project-ref <프로젝트 ref>  # DB 비밀번호 입력
npm run db:push                             # 마이그레이션 적용 (테이블·이력·RLS·초기 데이터)
npm run fn:deploy                           # 사용자 관리 Edge Function 배포
```

### 3. 최초 관리자 등록
1. Supabase 대시보드 > Authentication > Users > **Add user**로 관리자 이메일·비밀번호를 만듭니다(Auto Confirm 체크).
2. SQL Editor에서 프로필을 연결합니다.
   ```sql
   insert into public.profiles (id, login_id, user_name, user_type, role)
   select id, email, '관리자', 'INTERNAL', 'ADMIN'
   from auth.users where email = '관리자 이메일';
   ```
3. 이후 사용자는 앱의 **관리 > 사용자** 화면에서 등록합니다.

## 주요 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입 검사 + 프로덕션 빌드 |
| `npm run lint` / `npm run format` | 린트(oxlint) / 포맷(prettier) |
| `npm run test:db` | 마이그레이션 검증 (PGlite, Docker 불필요) — 제약·정합성·RLS·이력 시나리오 |
| `npm run db:push` | 연결된 Supabase 프로젝트에 마이그레이션 적용 |
| `npm run db:types` | 연결된 프로젝트에서 DB 타입 생성 |
| `npm run fn:deploy` | Edge Function `admin-users` 배포 |

## 폴더 구조

```
src/
├─ app/                라우터, 메뉴(역할별 노출), 인증 가드, 레이아웃
├─ components/ui/      shadcn 컴포넌트
├─ components/common/  DataTable, FormSheet, 폼 필드, PageHeader
├─ features/
│  ├─ auth/            로그인
│  ├─ master/          기준정보 (회사·화주사·센터·품목·차량·공통코드)
│  └─ admin/           사용자 관리
└─ lib/                supabase·query client, 인증 컨텍스트, 타입, 오류 메시지
supabase/
├─ migrations/         01 공통함수 · 02 기준정보 · 03 입고전표 · 04 RLS · 05 초기데이터
├─ functions/          admin-users (사용자 생성·수정·비밀번호 초기화)
└─ tests/              마이그레이션 검증 스크립트
docs/                  설계 문서
```

## 배포 (Vercel)

GitHub 저장소를 Vercel 프로젝트에 연결하고, Environment Variables에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 등록합니다. SPA 라우팅은 `vercel.json`의 rewrite로 처리합니다.
