# Vibe-HR 프론트엔드

Next.js App Router가 HR 화면과 BFF를 제공합니다. BFF는 서버에서 Rust API를 호출하고 브라우저 세션 쿠키를 관리합니다.

## 로컬 실행

1. [백엔드 실행 절차](../README.md#로컬-실행-방법)에 따라 Rust API를 시작합니다.
2. [환경 변수 예시](../README.md#환경-변수)에 따라 이 디렉터리의 `.env.local`에 `VIBEHR_BFF_BACKEND_URL`과 서버와 동일한 `VIBEHR_BFF_ASSERTION_SECRET`을 설정합니다. Cargo로 실행한 기본 주소는 `http://127.0.0.1:8080`이며 Compose는 루프백 포트를 동적으로 할당합니다.
3. 이 디렉터리에서 다음 명령을 실행하고 `http://localhost:3000/login`에 접속합니다.

```powershell
npm ci
npm run dev
```

서버 요청 주소는 [backend-target.ts](src/app/api/_lib/backend-target.ts)에서 구성합니다. API 계약을 변경할 때는 해당 BFF 라우트와 [Rust 업무 모듈](../backend-rust/src)을 함께 확인합니다. 그리드 화면은 [그리드 표준](../docs/GRID_SCREEN_STANDARD.md), 변경 범위별 테스트는 [테스트 전략](../docs/TEST_STRATEGY.md)을 따릅니다.
