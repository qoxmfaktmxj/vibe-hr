# HRI 모듈 테스트 시나리오 (DB 접근 가능 AI 전달용)

> 작성일: 2026-02-25
> 대상 브랜치: `main` (HRI 초안 반영 후)
> 목적: DB 접근 가능한 AI가 HRI 모듈을 E2E로 점검하고, 결함 수정까지 이어갈 수 있도록 테스트 절차를 표준화한다.

---

## 1. 테스트 목표

- HRI 신청서 공통 기능(코드관리, 결재선관리, 신청/결재/수신)을 실제 데이터로 검증한다.
- 상태 전이 무결성(`DRAFT -> APPROVAL_IN_PROGRESS -> ... -> COMPLETED`)을 보장한다.
- 조직 기반 결재자 해석(팀장/부서장/대표/fallback)이 실제 데이터에서 동작하는지 확인한다.
- 테스트 중 발견한 결함을 수정하고, 수정 후 재검증한다.

---

## 2. 대상 범위

### 2.1 Backend
- 모델: `Hri*` 엔티티 전부
- API:
  - `/api/v1/hri/form-types`
  - `/api/v1/hri/approval-templates`
  - `/api/v1/hri/requests/*`
  - `/api/v1/hri/tasks/*`
- 시드: `bootstrap.py`의 HRI 시드

### 2.2 Frontend
- BFF: `frontend/src/app/api/hri/**`
- 화면:
  - `/hri/admin/form-types`
  - `/hri/admin/approval-lines`
  - `/hri/requests/mine`
  - `/hri/tasks/approvals`
  - `/hri/tasks/receives`

---

## 3. 사전 준비

### 3.1 실행 환경
1. DB(PostgreSQL) 접근 가능해야 함
2. Backend 실행
3. Frontend 실행
4. 기본 시드 계정 확인
   - `admin` 계정 존재 여부
   - 일반 직원 계정(employee role) 존재 여부

### 3.2 추천 초기화 절차
1. 테스트 전 DB 백업
2. HRI 테이블 초기화(필요 시)
3. 서버 재기동으로 `seed_initial_data()` 반영

---

## 4. DB 스모크 체크 (필수)

아래 SQL을 순서대로 실행한다.

```sql
-- 1) 테이블 존재 확인
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'hri_%'
ORDER BY tablename;

-- 2) 시드된 신청서 코드 확인
SELECT form_code, form_name_ko, module_code, requires_receive, is_active
FROM hri_form_types
ORDER BY default_priority, id;

-- 3) 시드된 결재 템플릿/단계 확인
SELECT t.template_code, t.template_name, t.scope_type, t.is_default, s.step_order, s.step_type, s.actor_role_code
FROM hri_approval_line_templates t
JOIN hri_approval_line_steps s ON s.template_id = t.id
ORDER BY t.priority DESC, t.id, s.step_order;

-- 4) 매핑 확인
SELECT ft.form_code, tm.template_code, m.is_active, m.effective_from, m.effective_to
FROM hri_form_type_approval_maps m
JOIN hri_form_types ft ON ft.id = m.form_type_id
JOIN hri_approval_line_templates tm ON tm.id = m.template_id
ORDER BY ft.form_code;
```

성공 기준:
- `hri_` 테이블이 모두 조회된다.
- form type 최소 3건 이상 존재
- template 최소 3건 이상 존재
- mapping 최소 3건 이상 존재

---

## 5. API 테스트 시나리오

## 5.1 관리자 시나리오 A: 신청서 코드관리

1. `GET /api/v1/hri/form-types`
2. 신규 코드 추가(batch)
3. 기존 코드 수정(batch)
4. 코드 삭제(batch)

검증 포인트:
- 중복 `form_code` 저장 시 409
- 삭제 후 목록에서 미노출
- `created_by/updated_by` 값 반영

예시 요청:
```json
{
  "items": [
    {
      "id": null,
      "form_code": "HRI_TEST_FORM",
      "form_name_ko": "테스트 신청서",
      "form_name_en": "Test Form",
      "module_code": "COMMON",
      "is_active": true,
      "allow_draft": true,
      "allow_withdraw": true,
      "requires_receive": false,
      "default_priority": 99
    }
  ],
  "delete_ids": []
}
```

## 5.2 관리자 시나리오 B: 결재선 템플릿 관리

1. `GET /api/v1/hri/approval-templates`
2. 신규 템플릿 생성(batch)
3. 단계 추가/수정/삭제(batch)
4. 템플릿 삭제(batch)

검증 포인트:
- step_order 중복 방지
- `ROLE_BASED` + `USER_FIXED` 혼합 저장 가능
- 템플릿 삭제 시 step cascade 정상

---

## 5.3 사용자 시나리오 C: 신청서 작성~제출

1. `POST /api/v1/hri/requests/draft`
2. `POST /api/v1/hri/requests/{id}/submit`
3. `GET /api/v1/hri/requests/my`

검증 포인트:
- 제출 시 `hri_request_step_snapshots` 자동 생성
- 상태가 `APPROVAL_IN_PROGRESS` 또는 `RECEIVE_IN_PROGRESS`로 전환
- `hri_request_histories`에 CREATE/SUBMIT 이력 생성

---

## 5.4 결재 시나리오 D: 승인/반려

1. 결재자 계정으로 `GET /api/v1/hri/tasks/my-approvals`
2. 승인: `POST /api/v1/hri/requests/{id}/approve`
3. 반려: `POST /api/v1/hri/requests/{id}/reject`

검증 포인트:
- 승인 시 다음 step으로 정확히 이동
- 최종 승인 후 `RECEIVE_IN_PROGRESS` 또는 `COMPLETED`
- 반려 시 `APPROVAL_REJECTED`
- 이력 `APPROVE/REJECT` 생성

---

## 5.5 수신 시나리오 E: 수신처리/수신반려

1. 수신자 계정으로 `GET /api/v1/hri/tasks/my-receives`
2. 완료: `POST /api/v1/hri/requests/{id}/receive-complete`
3. 반려: `POST /api/v1/hri/requests/{id}/receive-reject`

검증 포인트:
- 완료 시 `COMPLETED`
- 반려 시 `RECEIVE_REJECTED`
- 이력 `RECEIVE_COMPLETE/RECEIVE_REJECT` 생성

---

## 5.6 예외 시나리오 F: 회수/재제출

1. 제출 직후 `withdraw`
2. 반려 상태 문서 재기안(draft save + submit)

검증 포인트:
- 회수 가능 상태에서만 성공
- 회수 시 대기 step 상태 정리
- 재제출 시 snapshot 재생성

---

## 5.7 권한 시나리오 G: 비인가 접근

- employee가 관리자 API 호출
- 타인의 문서를 approve/reject 시도

성공 기준:
- 403 또는 적절한 4xx
- 데이터 변경 없음

---

## 6. DB 무결성 검증 SQL

```sql
-- 요청별 최신 상태 확인
SELECT request_no, status_code, current_step_order, submitted_at, completed_at
FROM hri_request_masters
ORDER BY id DESC
LIMIT 50;

-- 스냅샷 step 진행 상태 확인
SELECT request_id, step_order, step_type, actor_user_id, action_status, acted_at
FROM hri_request_step_snapshots
ORDER BY request_id DESC, step_order;

-- 이벤트 이력 확인
SELECT request_id, event_type, from_status, to_status, actor_user_id, created_at
FROM hri_request_histories
ORDER BY id DESC
LIMIT 200;

-- 고아 데이터 확인 (반드시 0건이어야 함)
SELECT s.id
FROM hri_request_step_snapshots s
LEFT JOIN hri_request_masters m ON m.id = s.request_id
WHERE m.id IS NULL;

SELECT h.id
FROM hri_request_histories h
LEFT JOIN hri_request_masters m ON m.id = h.request_id
WHERE m.id IS NULL;
```

---

## 7. 결함 발생 시 수정 우선순위

### P0 (즉시 수정)
- 상태 전이 오류 (잘못된 status_code)
- 권한 우회 가능
- 중복 승인/중복 반려 가능
- snapshot 미생성 또는 actor_user_id null

### P1 (1차 릴리스 전)
- fallback 해석 오동작(팀장/부서장/대표)
- 이력 누락
- 목록/상세 조회 성능 저하(대기 2초 초과)

### P2 (고도화)
- 정책키(`attachment_required` 등) 미적용 항목
- UI 편의성 개선

---

## 8. AI 수정 작업 가이드

DB 접근 가능한 AI는 아래 순서로 작업한다.

1. `python -m compileall backend/app` 통과 확인
2. API 시나리오 실행 + SQL 검증
3. 결함 목록 작성 (재현 절차, 원인, 수정파일)
4. 코드 수정
5. 동일 시나리오 재실행
6. 결과를 아래 템플릿으로 보고

결함 보고 템플릿:

```md
### [결함ID] 제목
- 심각도: P0/P1/P2
- 재현절차:
  1. ...
  2. ...
- 실제결과:
- 기대결과:
- 원인:
- 수정파일:
- 검증결과:
```

---

## 9. 최종 인수 기준 (Go/No-Go)

Go 조건:
- 필수 시나리오(5.1~5.7) 전부 통과
- 무결성 SQL 이상 없음
- P0 결함 0건
- P1 결함은 우회 또는 수정 완료

No-Go 조건:
- 상태 전이/권한/무결성 중 하나라도 실패

---

## 10. 현재 초안 기준 확인 메모

- 결재자 자동 해석은 현재 `position_title` 문자열 매칭 기반 초안이다.
- 신청서 정책키(`HRI_FORM_TYPE_POLICY`)는 저장되지만 런타임 강제 검증은 최소 수준이다.
- `content_json`은 문자열 저장 방식으로 구현되어 있으며, 향후 JSONB 타입 적용 권장.

이 항목들은 테스트 후 우선순위에 따라 개선 작업을 진행한다.

---

## 11. DB 접근 AI 전달용 프롬프트 템플릿

아래 프롬프트를 DB 접근 가능한 AI에게 그대로 전달한다.

```md
다음 저장소의 HRI 모듈을 E2E 테스트하고 결함이 있으면 바로 수정해줘.

[입력 문서]
- HRI_TEST_SCENARIO.md (필수 절차)
- HRI_REQUEST_MODULE_PLAN.md (설계 기준)

[수행 순서]
1. DB 스모크 체크(SQL) 실행
2. API 시나리오 5.1~5.7 전부 실행
3. 결함 목록 작성 (재현절차/원인/수정파일)
4. 코드 수정
5. 동일 시나리오 재검증
6. 결과 리포트 작성

[제약]
- 상태 전이/권한/무결성 실패는 P0로 처리
- 수정 후 반드시 재검증 결과를 첨부
- 스키마 변경 시 DDL/마이그레이션 영향도 함께 보고
```
