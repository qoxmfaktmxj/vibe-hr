Status: Draft
Owner: 석
Canonical: Yes
Source of Truth: This file
Last Verified: 2026-03-22
Confidence: Medium

# SECURITY.md

## 목적
Vibe-HR의 보안 관련 기본 원칙과 변경 승인 기준을 정의한다.

## 현재 보안 경계
- 인증: JWT 기반 로그인 흐름 [Observed]
- 인가: 메뉴 권한 + 액션 권한 도입 중 [Observed]
- 민감 도메인:
  - auth/authz
  - 개인정보/조직 정보
  - 급여/정산 의미
  - 데이터 복구/정합성

## 인증 / 인가 구조
- 인증 방식:
  - `ENTER_CD + login_id + password`
  - JWT access token 발급
- 인가 모델:
  - 메뉴 접근권한
  - 메뉴 액션 권한(query/create/copy/template_download/upload/save/download)
- 원칙:
  - UI 비노출만으로 보안을 대체하지 않는다.
  - 서버 enforcement가 반드시 함께 있어야 한다.

## 민감 데이터 처리
- 민감 데이터:
  - 사원 개인정보
  - 조직/발령/근태 정보
  - 급여/상여/복리후생/연말정산 관련 데이터
- 금지:
  - 비밀값/민감값을 ledger에 raw로 남기기
  - 자격증명을 문서/테스트 fixture에 평문으로 장기 보관

## 비밀 관리 원칙
- secret 저장 위치: deploy env 및 운영 환경 변수 기준 `NEEDS_CONFIRMATION`
- 로컬 개발 규칙:
  - `.env*`는 필요한 범위만 사용
  - 테스트/문서에 production secret을 남기지 않는다
- CI/CD 규칙:
  - 자동배포는 비활성화됨
  - 수동 배포 전 확인 후 `workflow_dispatch` 사용

## 승인 필요 변경
다음은 기본적으로 R3로 본다.
- auth 변경
- role/permission 의미 변경
- secret/credential 처리
- 공개 보안 경계 변경
- payroll semantics 변경
- schema/migration/destructive data 작업

## 운영 원칙
- auth/permission/payroll 관련 변경은 자동 cron 실행 금지
- 브라우저 테스트가 필요하면 실제 UI + 서버 응답을 함께 본다
- 새 화면 추가 시 메뉴/권한/DB entry가 빠지지 않도록 검토한다
