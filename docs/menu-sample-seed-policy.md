# Menu and Sample Seed Policy

작성일: 2026-03-12  
적용 저장소: `C:\Users\kms\Desktop\dev\vibe-hr`

## 1. 목적

새 메뉴가 추가될 때마다 다음 두 가지가 항상 같이 들어가도록 기준을 고정한다.

1. 메뉴 seed
2. 해당 메뉴를 눈으로 확인할 수 있는 최소 샘플 데이터 seed

사용자 요구:
- “메뉴가 늘어났다는 것”을 어디서 실행해도 즉시 알 수 있어야 함
- 신규 메뉴가 빈 화면만 나오지 않고, 샘플 데이터 몇 건으로 기능 존재를 바로 인지할 수 있어야 함

## 2. 기준 데이터와 개발용 샘플

메뉴, 역할과 필수 기준 데이터는 [Flyway SQL](../backend-spring/src/main/resources/db/migration)에서 관리한다. 기존 메뉴와 액션의 초기값은 `V3__required_reference_data.sql`에서 확인한다. 새 기준 데이터는 이미 배포한 SQL의 체크섬을 보존하는 후속 마이그레이션으로 추가한다.

[Rust 시드](../backend-rust/src/db/seed.rs)는 명시적으로 실행한다. `seed dev dev`는 개발 관리자 2명, `seed demo demo 10`은 테스트 사원 10명을 준비한다. 도메인 거래 샘플은 각 검증 시나리오의 격리 DB에 준비한다. 접속 조건과 명령은 [로컬 시드 절차](../README.md#시드-데이터)를 따른다.

## 3. 앞으로의 정책

새 메뉴를 추가할 때는 아래 5가지를 하나의 작업 묶음으로 본다.

1. 화면/라우트 추가
2. 메뉴와 허용 액션, 역할 매핑의 필수 값을 Flyway 변경으로 관리
3. 화면을 확인할 최소 샘플과 기대 결과 정의
4. 로컬 검증용 DB에만 시나리오 데이터 준비
5. 해당 역할로 로그인해 메뉴 노출과 화면 데이터를 Playwright로 확인

## 4. 최소 기준

### 4.1 메뉴 seed

필수:
- `code`
- `name`
- `path`
- `icon`
- `sort_order`
- `roles`

위치:
- `backend-spring/src/main/resources/db/migration/`의 버전별 SQL

### 4.2 샘플 seed

메뉴 종류별 최소 기준:

| 메뉴 유형 | 최소 seed 기준 |
|---|---|
| 마스터 관리형 | 3~5건 |
| 신청/결재형 | 1건 이상 Draft, 1건 이상 완료/반려 |
| 집계/실행형 | 1건 이상 실행 이력 + 1건 이상 대상 데이터 |
| 코드/설정형 | 5건 이상 대표 코드 |

### 4.3 브라우저 검증

필수 검증:
- 로그인 후 좌측 메뉴에 새 메뉴가 보이는지
- 해당 메뉴 화면 진입 시 빈 화면이 아닌 seed 데이터가 보이는지

권장 방식:
- 워크스페이스 전용 Playwright 세션 사용
- 예시:
  - `npx --yes --package @playwright/cli playwright-cli -s=wave1 open http://127.0.0.1:3000/login --browser chrome --profile C:\Users\kms\Desktop\dev\vibe-hr\output\playwright\wave1`
  - 이후 `snapshot`, `click`, `fill` 로 확인

이번 점검에서 확인한 브라우저 근거:
- 로그인 화면: `http://127.0.0.1:3000/login`
- 로그인 후 대시보드: `http://127.0.0.1:3000/dashboard`
- 스냅샷: `C:\Users\kms\Desktop\dev\vibe-hr\.playwright-cli\page-2026-03-12T08-38-59-846Z.yml`

## 5. 구현 체크리스트

1. 화면, BFF 라우트, `backend-rust/src/`의 업무 핸들러와 액션 권한을 확인한다.
2. 필수 메뉴와 권한 매핑의 Flyway 변경을 검토한다.
3. 테스트 데이터의 생성 조건과 검증 후 처리 방법을 명시한다.
4. 허용 역할의 메뉴와 샘플 조회, 권한 없는 사용자에 대한 서버 응답을 확인한다.

## 6. 신규 메뉴의 샘플 설계

복리후생 메뉴를 추가한다면:
- 메뉴 seed: `wel`, `wel.requests`, `wel.loan`, `wel.medical` 등
- 샘플 seed:
  - 유형 4건
  - 신청서 2건
  - 승인완료 1건
  - 급여연동 후보 1건

평가 운영 메뉴를 추가한다면:
- 메뉴 seed: `pap.cycles`, `pap.assignments`, `pap.results`
- 샘플 seed:
  - 평가회차 2건
  - 평가대상 3건
  - 결과 2건

## 7. 2026년 3월 점검 기록

아래는 당시 부트스트랩을 기준으로 조사한 결과다.

충족 예:
- 급여: 메뉴 seed + 샘플 데이터 존재
- 교육: 메뉴 seed + 조직/과정 seed 존재
- 평가: 메뉴 seed + 결과/평가마스터 seed 존재

부분 충족:
- 복리후생: 마스터 seed는 있으나 메뉴와 실제 신청 샘플이 없다

미흡 포인트:
- 신규 메뉴를 추가할 때 “반드시 샘플 데이터도 넣는다”는 명문화 규칙이 없었다

## 8. 앞으로의 적용 기준

앞으로 제가 이 저장소에서 메뉴를 추가할 때는 다음을 기본 약속으로 따른다.

- 메뉴를 추가하면 Flyway 기준 데이터와 액션 권한 매핑을 함께 검토한다.
- 메뉴를 추가하면 해당 메뉴에서 바로 보이는 seed 데이터도 같이 넣는다.
- seed 데이터가 없다면 메뉴 추가를 완료로 보고하지 않는다.
- 가능하면 Playwright로 메뉴 노출과 초기 데이터를 같이 확인한다.
