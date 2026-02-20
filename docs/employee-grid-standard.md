# 사원관리 기준 AG Grid 표준 (확장용)

이 문서는 `사원관리` 화면을 기준으로, 이후 대량 데이터 화면(200개+)에 공통 적용할 표준을 정의한다.

## 1) 프론트 표준 구조

- `src/lib/hr/grid-change-tracker.ts`
  - `_status(clean/added/updated/deleted)` 전이 관련 공통 유틸
  - 원본 스냅샷/원복 판정/패치 변경 여부/삭제 복원 상태 계산
- `src/lib/hr/employee-batch.ts`
  - 화면 row를 백엔드 batch payload(`insert/update/delete`)로 변환
- `src/lib/hr/employee-api.ts`
  - 사원/부서 기본 조회(fetch + 에러 처리) 공통화

## 2) 백엔드 표준 구조

- `POST /api/v1/employees/batch`
  - 요청: `mode=atomic`, `insert[]`, `update[]`, `delete[]`
  - 처리: 단일 트랜잭션 원자 처리(전부 성공/전부 롤백)
  - 삭제: `IN` 절 청크 분할(현재 1000건 단위)
  - 응답: `inserted_count`, `updated_count`, `deleted_count`, `employees[]`

## 3) 상태 관리 규칙

- `added`: 신규 입력(임시 ID)
- `updated`: 기존 행 수정
- `deleted`: 삭제 표시(즉시 물리 삭제하지 않음)
- `clean`: 변경 없음

조회/저장 성공 시에는 항상 서버 데이터로 재적재하고 그리드를 리마운트해 색상/선택 상태까지 초기화한다.

## 4) 화면 확장 시 체크리스트

- 동일한 `_status` 패턴 재사용
- 저장은 반드시 batch API 1회 호출
- 부분 실패 행 삽입 금지(오류는 토스트로 노출)
- 대량 삭제는 청크 정책 유지(1000건 기준)
- 모바일/데스크톱에서 같은 비즈니스 규칙 사용

## 5) React 컴포지션 원칙 반영

React 스킬 가이드 기준으로, 화면 컴포넌트에 로직을 몰아넣지 말고:

- 상태 전이 로직은 `lib` 유틸로 분리
- API 통신은 `lib` 계층으로 분리
- 화면은 렌더링 + 이벤트 조합 중심으로 유지

이 구조를 기준으로 다음 화면(근태코드/휴일/공통코드/조직코드관리)도 동일 패턴으로 확장한다.
