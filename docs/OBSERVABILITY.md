Status: Draft
Owner: 석
Canonical: Yes
Source of Truth: This file
Last Verified: 2026-03-22
Confidence: Medium

# OBSERVABILITY.md

## 목적
변경의 영향과 런타임 상태를 관찰하기 위한 최소 기준을 정의한다.

## 현재 기본 전략
Vibe-HR의 현재 observability는 heavyweight stack보다 **lightweight but disciplined** 원칙을 따른다.

## 필수 로그/증거
### 작업 단위
- `docs/TASK_LEDGER.md`
- execution plan / execution report
- changed files / commands / validation summary / remaining risks

### 런타임 단위
- backend health 상태
- container status
- API 4xx/5xx 여부
- browser/manual validation 결과

### 배포 단위
- 어떤 commit이 배포됐는지
- 수동 배포 여부
- deploy 후 health 확인 여부
- 자동배포 비활성화 상태 유지 여부

## 금지 로그
- secret / access token / password raw 출력
- 민감 개인정보 raw dump
- 대량 payroll raw payload 로그

## 실패 분류 기준
- build_failure
- test_failure
- runtime_error
- permission_error
- data_integrity_error
- payroll_logic_mismatch
- deploy_failure
- env_failure
- tool_failure

## 변경 시 체크 포인트
새 기능/버그 수정 시 최소한 아래를 남긴다.
- 무엇을 바꿨는가
- 어떤 검증을 했는가
- 무엇이 아직 남았는가
- 브라우저에서 무엇을 확인했는가

## 추천 런타임 체크
- `/health` 200 여부
- 로그인 가능 여부
- 핵심 화면 진입 가능 여부
- 저장/조회/삭제 등 핵심 path의 응답 상태

## 향후 확장 후보
- structured deploy notes
- per-domain smoke checklist
- cron 결과를 eval summary에 반영하는 lightweight summary pipeline
