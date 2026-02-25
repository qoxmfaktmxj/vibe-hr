# 공통 신청서/결재(HRI) 모듈 상세 계획서

> 작성일: 2026-02-25
> 프로젝트: Vibe-HR (인사관리 시스템)
> 모듈명: HRI (HR Integrated Request)
> 목적: 전사 공통 신청서/결재/수신 프로세스를 표준화하고, 조직 기반 자동 결재선을 통해 운영 비용을 줄인다.

---

## 1. 배경과 목표

### 1.1 배경
- 현재 신청서 유형별로 화면/결재 로직이 분산되어 확장 비용이 크다.
- 조직 변경(팀장/부서장/대표 변경) 시 결재선 유지보수가 수작업에 의존한다.
- 신청서 상태 정의가 화면마다 달라 운영/감사 추적이 어렵다.

### 1.2 핵심 목표
- 신청서 엔진을 공통화: 신규 신청서 추가 시 코드/설정 중심으로 확장.
- 조직 기반 자동 결재선 생성: 팀장결재선, 부서장결재선, 대표결재선 자동 반영.
- 상태 표준화: `임시저장 -> 결재처리중 -> 결재반려 -> 수신처리중 -> 수신반려 -> 처리완료`.
- 감사/이력 강화: 누가/언제/무엇을 승인·반려·수신처리했는지 100% 추적.

### 1.3 설계 원칙
- 설정 우선(코드 최소화): 신청서 코드관리와 결재선 템플릿으로 동작.
- 스냅샷 고정: 제출 시점 결재선을 스냅샷으로 저장해 조직 변경 영향 차단.
- 무결성 우선: 상태 전이 규칙과 권한 규칙을 API 레벨에서 강제.
- 현대적 UX: 복잡한 설정은 단계형 편집(기본정보 > 결재 > 수신 > 옵션)으로 분리.

---

## 2. 범위 정의

### 2.1 포함 범위 (In Scope)
- 신청서 코드관리(유형/정책/옵션)
- 결재선 템플릿 관리(전사/조직/직무 규칙)
- 신청서 작성/임시저장/제출/회수
- 결재함(승인/반려) + 수신함(처리/반려)
- 상태 추적, 이력, 첨부, 알림

### 2.2 제외 범위 (Out of Scope, 1차)
- 외부 전자결재 제품 연동
- 복잡한 병렬 결재/조건 분기 워크플로 엔진(2차)
- 문서 PDF 전자서명(2차)

---

## 3. 업무 상태 모델

### 3.1 표준 상태코드
| 상태코드 | 한글명 | 설명 |
|---|---|---|
| DRAFT | 임시저장 | 작성 중. 제출 전 상태 |
| APPROVAL_IN_PROGRESS | 결재처리중 | 결재 단계 진행 중 |
| APPROVAL_REJECTED | 결재반려 | 결재 단계에서 반려 |
| RECEIVE_IN_PROGRESS | 수신처리중 | 결재 완료 후 수신 처리 대기/진행 |
| RECEIVE_REJECTED | 수신반려 | 수신 단계에서 반려 |
| COMPLETED | 처리완료 | 전체 프로세스 종료 |
| WITHDRAWN | 회수 | 제출 후 신청자가 회수(선택) |

### 3.2 상태 전이 규칙
- `DRAFT -> APPROVAL_IN_PROGRESS` (제출)
- `APPROVAL_IN_PROGRESS -> APPROVAL_REJECTED` (결재 반려)
- `APPROVAL_IN_PROGRESS -> RECEIVE_IN_PROGRESS` (최종 결재 승인)
- `RECEIVE_IN_PROGRESS -> RECEIVE_REJECTED` (수신 반려)
- `RECEIVE_IN_PROGRESS -> COMPLETED` (수신 처리 완료)
- `APPROVAL_IN_PROGRESS -> WITHDRAWN` (아직 결재 미완료, 회수 허용 시)
- 반려 후 재기안은 신규 신청 또는 동일 신청 재제출 정책 중 택1(권장: 동일 신청 재제출 + 이력 누적)

### 3.3 상태별 액션 권한
- 신청자: 임시저장, 제출, 회수, 재제출
- 결재자: 승인, 반려
- 수신자: 처리완료, 수신반려
- 관리자: 강제종결/상태정정(감사로그 필수)

---

## 4. 데이터 모델 (HRI_ 테이블)

## 4.1 마스터/설정

### 4.1.1 `HRI_FORM_TYPE` (신청서 코드 마스터)
- 목적: 신청서 유형 정의(예: 재직증명, 근태정정, 경비청구)
- 주요 컬럼:
  - `id` PK
  - `form_code` varchar(30) UNIQUE
  - `form_name_ko` varchar(100)
  - `form_name_en` varchar(100) NULL
  - `module_code` varchar(30) (TIM/CPN/ORG/COMMON)
  - `is_active` boolean
  - `allow_draft` boolean
  - `allow_withdraw` boolean
  - `requires_receive` boolean
  - `default_priority` smallint
  - `created_at`, `updated_at`, `created_by`, `updated_by`
- 인덱스: `(module_code, is_active)`, `(form_name_ko)`

### 4.1.2 `HRI_FORM_TYPE_POLICY` (신청서 유형 정책)
- 목적: 유형별 처리 정책/유효성 규칙 보관
- 주요 컬럼:
  - `id` PK
  - `form_type_id` FK -> `HRI_FORM_TYPE.id`
  - `policy_key` varchar(50) (예: attachment_required)
  - `policy_value` varchar(500)
  - `effective_from`, `effective_to`
- 인덱스: `(form_type_id, policy_key, effective_from)`

### 4.1.3 `HRI_APPROVAL_LINE_TEMPLATE` (결재선 템플릿 헤더)
- 목적: 결재선 정의의 상위 단위
- 주요 컬럼:
  - `id` PK
  - `template_code` varchar(30) UNIQUE
  - `template_name` varchar(100)
  - `scope_type` varchar(20) (GLOBAL/COMPANY/DEPT/TEAM/USER)
  - `scope_id` varchar(40) NULL
  - `is_default` boolean
  - `is_active` boolean
  - `priority` smallint (높을수록 우선)
  - `created_at`, `updated_at`
- 인덱스: `(scope_type, scope_id, is_active, priority)`

### 4.1.4 `HRI_APPROVAL_LINE_STEP` (결재선 단계)
- 목적: 템플릿 내 단계 정의
- 주요 컬럼:
  - `id` PK
  - `template_id` FK -> `HRI_APPROVAL_LINE_TEMPLATE.id`
  - `step_order` smallint
  - `step_type` varchar(20) (APPROVAL/RECEIVE/REFERENCE)
  - `actor_resolve_type` varchar(30) (ROLE_BASED/USER_FIXED)
  - `actor_role_code` varchar(30) NULL (TEAM_LEADER/DEPT_HEAD/CEO)
  - `actor_user_id` bigint NULL
  - `allow_delegate` boolean
  - `required_action` varchar(20) (APPROVE/RECEIVE)
- 인덱스: `(template_id, step_order)` UNIQUE

### 4.1.5 `HRI_FORM_TYPE_APPROVAL_MAP` (신청서유형-결재선 매핑)
- 목적: 신청서별 기본 템플릿 연결
- 주요 컬럼:
  - `id` PK
  - `form_type_id` FK
  - `template_id` FK
  - `is_active` boolean
  - `effective_from`, `effective_to`
- 인덱스: `(form_type_id, effective_from, effective_to)`

### 4.1.6 `HRI_APPROVAL_ACTOR_RULE` (역할 해석 규칙)
- 목적: ROLE_BASED를 실제 사번으로 해석하기 위한 규칙
- 주요 컬럼:
  - `id` PK
  - `role_code` varchar(30) (TEAM_LEADER/DEPT_HEAD/CEO)
  - `resolve_method` varchar(30) (ORG_CHAIN/JOB_POSITION/FIXED_USER)
  - `fallback_rule` varchar(30) (ESCALATE/SKIP/HR_ADMIN)
  - `is_active` boolean
- 인덱스: `(role_code, is_active)`

---

## 4.2 트랜잭션

### 4.2.1 `HRI_REQUEST_MASTER` (신청서 본문 헤더)
- 목적: 신청서 인스턴스의 대표 레코드
- 주요 컬럼:
  - `id` PK
  - `request_no` varchar(40) UNIQUE (예: HRI-202602-000123)
  - `form_type_id` FK
  - `requester_id` bigint
  - `requester_org_id` bigint
  - `title` varchar(200)
  - `content_json` jsonb
  - `status_code` varchar(30)
  - `current_step_order` smallint NULL
  - `submitted_at`, `completed_at`
  - `created_at`, `updated_at`
- 인덱스:
  - `(requester_id, created_at DESC)`
  - `(status_code, created_at DESC)`
  - `(form_type_id, created_at DESC)`

### 4.2.2 `HRI_REQUEST_STEP_SNAPSHOT` (결재/수신 라인 스냅샷)
- 목적: 제출 시점 확정된 라인 저장
- 주요 컬럼:
  - `id` PK
  - `request_id` FK
  - `step_order` smallint
  - `step_type` varchar(20)
  - `actor_user_id` bigint
  - `actor_name` varchar(100)
  - `actor_org_id` bigint
  - `actor_role_code` varchar(30)
  - `action_status` varchar(20) (WAITING/APPROVED/REJECTED/RECEIVED)
  - `acted_at` datetime NULL
  - `comment` varchar(1000) NULL
- 인덱스: `(request_id, step_order)` UNIQUE, `(actor_user_id, action_status)`

### 4.2.3 `HRI_REQUEST_HISTORY` (상태/행위 이력)
- 목적: 감사 로그
- 주요 컬럼:
  - `id` PK
  - `request_id` FK
  - `event_type` varchar(30) (CREATE/SUBMIT/APPROVE/REJECT/RECEIVE/WITHDRAW/ADMIN_OVERRIDE)
  - `from_status` varchar(30) NULL
  - `to_status` varchar(30) NULL
  - `actor_user_id` bigint
  - `actor_ip` varchar(45) NULL
  - `event_payload_json` jsonb NULL
  - `created_at`
- 인덱스: `(request_id, created_at DESC)`, `(actor_user_id, created_at DESC)`

### 4.2.4 `HRI_REQUEST_ATTACHMENT` (첨부 파일)
- 목적: 신청서 첨부
- 주요 컬럼:
  - `id` PK
  - `request_id` FK
  - `file_key` varchar(300)
  - `file_name` varchar(255)
  - `file_size` bigint
  - `mime_type` varchar(120)
  - `uploaded_by` bigint
  - `uploaded_at`
- 인덱스: `(request_id, uploaded_at DESC)`

### 4.2.5 `HRI_REQUEST_COUNTER` (문서번호 시퀀스)
- 목적: 월별/유형별 번호 생성
- 주요 컬럼:
  - `counter_key` PK (예: 202602:FORM_CODE)
  - `last_seq` int
  - `updated_at`

---

## 5. 결재선 자동 생성 설계

### 5.1 생성 시점
- `제출` 버튼 클릭 시점에 생성/확정.
- 임시저장 단계에서는 생성하지 않음(조직 변경 반영 가능성 때문).

### 5.2 템플릿 선택 우선순위
1. 사용자 스코프(USER)
2. 팀 스코프(TEAM)
3. 부서 스코프(DEPT)
4. 회사 스코프(COMPANY)
5. 전사 기본(GLOBAL + is_default=true)

### 5.3 역할 기반 해석 규칙
- `TEAM_LEADER`: 신청자 소속 팀의 리더 1인
- `DEPT_HEAD`: 상위 부서 체인의 부서장 1인
- `CEO`: 회사 대표 1인
- 사용자 고정(`USER_FIXED`) 단계는 지정 사번 그대로 사용

### 5.4 결재선 생성 알고리즘 (요약)
1. 신청자, 신청일, 신청서유형으로 유효 템플릿 선택
2. 템플릿 step 순회
3. `actor_resolve_type=ROLE_BASED`이면 `HRI_APPROVAL_ACTOR_RULE`로 사번 해석
4. 해석 실패 시 fallback 적용(`ESCALATE/SKIP/HR_ADMIN`)
5. 중복 결재자 제거 정책 적용(같은 사람이 연속 단계일 때 병합 여부 설정)
6. `HRI_REQUEST_STEP_SNAPSHOT`에 고정 저장

### 5.5 예외 처리 정책
- 팀장 공석: 부서장으로 승격(ESCALATE)
- 부서장 공석: 대표 결재로 승격
- 대표 공석: HR_ADMIN 고정 대체(시스템 운영자)
- 결재자 비활성/휴직: 대결자 우선, 없으면 fallback

---

## 6. 기능 상세 (화면/업무)

## 6.1 관리자 영역

### 6.1.1 신청서 코드관리 화면
- 경로: `/hri/admin/form-types`
- 주요 기능:
  - 신청서 코드 CRUD
  - 사용여부/정렬순서/수신필요여부 설정
  - 정책키(첨부필수, 최대첨부건수, 재기안허용 등) 관리
- UX 방향:
  - 좌측 목록 + 우측 상세 편집(마스터-디테일)
  - 복잡 옵션은 아코디언 섹션으로 분리

### 6.1.2 결재선 템플릿 관리 화면
- 경로: `/hri/admin/approval-lines`
- 주요 기능:
  - 템플릿 헤더 관리(스코프/우선순위)
  - 단계별 결재선 편집(팀장/부서장/대표/고정사용자)
  - 시뮬레이션: 특정 사번 기준 실제 해석 결과 미리보기
- UX 방향:
  - Step Builder UI (세로 타임라인)
  - 단계 드래그 정렬, 단계 복사, 검증 오류 즉시 표시

## 6.2 사용자 영역

### 6.2.1 신청서 작성/상세
- 경로: `/hri/requests/new`, `/hri/requests/[id]`
- 주요 기능:
  - 신청서 유형 선택 후 동적 폼 렌더링
  - 임시저장, 제출, 회수, 재제출
  - 결재선 미리보기(제출 전)

### 6.2.2 내 신청서 목록
- 경로: `/hri/requests/mine`
- 주요 기능:
  - 상태/기간/유형 필터
  - 상태 배지 표시, 현재 결재단계 표시
  - 빠른 액션(회수/재제출)

### 6.2.3 결재함
- 경로: `/hri/tasks/approvals`
- 주요 기능:
  - 내 결재대기 목록
  - 승인/반려(의견 필수 여부 정책화)
  - 일괄 승인(옵션)

### 6.2.4 수신함
- 경로: `/hri/tasks/receives`
- 주요 기능:
  - 수신 처리 대기 목록
  - 처리완료/수신반려
  - 처리 결과 메모

---

## 7. API/BFF 설계안

### 7.1 Backend API (FastAPI)
- `GET /api/v1/hri/form-types`
- `POST /api/v1/hri/form-types/batch`
- `GET /api/v1/hri/approval-templates`
- `POST /api/v1/hri/approval-templates/batch`
- `POST /api/v1/hri/requests`
- `PUT /api/v1/hri/requests/{id}` (임시저장 수정)
- `POST /api/v1/hri/requests/{id}/submit`
- `POST /api/v1/hri/requests/{id}/withdraw`
- `POST /api/v1/hri/requests/{id}/approve`
- `POST /api/v1/hri/requests/{id}/reject`
- `POST /api/v1/hri/requests/{id}/receive-complete`
- `POST /api/v1/hri/requests/{id}/receive-reject`
- `GET /api/v1/hri/requests/my`
- `GET /api/v1/hri/tasks/my-approvals`
- `GET /api/v1/hri/tasks/my-receives`

### 7.2 Frontend BFF (Next.js Route Handler)
- `/app/api/hri/...` 경로로 백엔드 프록시
- 권한/쿠키 토큰 검증 일관 처리
- 프론트 컴포넌트는 BFF 경유만 사용

### 7.3 공통 응답 규격
- `{ items, total_count }` 목록
- `{ ok: true, data }` 단건
- `{ ok: false, code, message }` 오류

---

## 8. 권한/보안/감사

### 8.1 권한 매트릭스
| 기능 | employee | manager | hr_manager | admin |
|---|---|---|---|---|
| 신청서 작성/제출 | O | O | O | O |
| 결재 승인/반려 | 본인 결재건 | 본인 결재건 | 본인 결재건 | O |
| 수신 처리 | 본인 수신건 | 본인 수신건 | 본인 수신건 | O |
| 코드관리 | X | X | O | O |
| 결재선관리 | X | X | O | O |
| 관리자 상태정정 | X | X | X | O |

### 8.2 감사 로그 정책
- 승인/반려/회수/수신처리/강제변경은 반드시 `HRI_REQUEST_HISTORY` 저장
- 변경 전/후 상태, 처리자, IP, 코멘트 기록

### 8.3 데이터 접근 제어
- 목록 조회 시 본인/권한 범위 스코프 적용
- 관리자라도 민감 첨부 접근은 별도 권한 플래그 고려

---

## 9. 성능/운영 고려

### 9.1 성능 목표
- 내 결재함 첫 화면: 1.5초 이내
- 신청서 상세 조회: 1초 이내
- 목록 페이지네이션: 50건 기준 1초 이내

### 9.2 인덱스 전략
- `HRI_REQUEST_MASTER(status_code, created_at)`
- `HRI_REQUEST_STEP_SNAPSHOT(actor_user_id, action_status, step_order)`
- `HRI_REQUEST_HISTORY(request_id, created_at)`

### 9.3 운영 포인트
- 배치 알림(미처리 결재건 리마인드)
- 휴가/부재 시 대결자 자동 치환
- 템플릿 변경 시 기존 문서는 스냅샷 유지

---

## 10. 구현 단계(권장 로드맵)

### Phase 1: 마스터/기초 API
- `HRI_FORM_TYPE`, `HRI_FORM_TYPE_POLICY`
- 코드관리 화면, 기본 BFF

### Phase 2: 결재선 템플릿/자동생성
- `HRI_APPROVAL_LINE_TEMPLATE`, `HRI_APPROVAL_LINE_STEP`, `HRI_APPROVAL_ACTOR_RULE`
- 결재선 관리 화면 + 해석 시뮬레이터

### Phase 3: 신청/결재 코어
- `HRI_REQUEST_MASTER`, `HRI_REQUEST_STEP_SNAPSHOT`, `HRI_REQUEST_HISTORY`
- 임시저장/제출/승인/반려

### Phase 4: 수신/완료/첨부
- `HRI_REQUEST_ATTACHMENT`
- 수신함/처리완료/수신반려

### Phase 5: 고도화
- 통계 대시보드
- SLA/지연경보
- 병렬 결재/조건 분기

---

## 11. 화면 디자인 가이드 (Vibe-HR 맞춤)

### 11.1 디자인 방향
- 기존 레거시처럼 한 화면에 과도한 컬럼을 몰아넣지 않는다.
- 목록과 상세를 분리하고, 상세에서 단계별 정보(신청내용/결재선/이력/첨부)를 탭 구성.
- 상태는 텍스트+컬러 배지로 통일(`DRAFT` 회색, `IN_PROGRESS` 파랑, `REJECTED` 빨강, `COMPLETED` 초록).

### 11.2 공통 컴포넌트
- `RequestStatusBadge`
- `ApprovalLineTimeline`
- `RequestActionBar`
- `AttachmentUploader`
- `HistoryPanel`

### 11.3 접근성/모바일
- 키보드 조작 가능(결재 버튼 포커스 순서)
- 모바일에서는 목록 카드형, 상세는 하단 시트 액션

---

## 12. 테스트 시나리오

### 12.1 핵심 시나리오
1. 임시저장 -> 제출 -> 팀장 승인 -> 부서장 승인 -> 대표 승인 -> 수신처리 -> 완료
2. 결재 2단계에서 반려 -> 신청자 수정 -> 재제출 -> 정상완료
3. 팀장 공석 상태 제출 -> fallback으로 부서장 자동 승격
4. 제출 후 조직 변경 발생 -> 스냅샷 유지로 기존 결재선 불변 확인
5. 권한 없는 사용자의 결재 API 호출 차단(403)

### 12.2 데이터 무결성
- 동일 요청에 동시 승인 요청 시 낙관적 락/상태체크로 중복처리 방지
- 상태 전이 불가 케이스 API 차단

---

## 13. 초기 DDL 샘플 (요약)

```sql
CREATE TABLE HRI_FORM_TYPE (
  id BIGSERIAL PRIMARY KEY,
  form_code VARCHAR(30) UNIQUE NOT NULL,
  form_name_ko VARCHAR(100) NOT NULL,
  module_code VARCHAR(30) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  allow_draft BOOLEAN NOT NULL DEFAULT TRUE,
  allow_withdraw BOOLEAN NOT NULL DEFAULT TRUE,
  requires_receive BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE HRI_REQUEST_MASTER (
  id BIGSERIAL PRIMARY KEY,
  request_no VARCHAR(40) UNIQUE NOT NULL,
  form_type_id BIGINT NOT NULL REFERENCES HRI_FORM_TYPE(id),
  requester_id BIGINT NOT NULL,
  title VARCHAR(200) NOT NULL,
  content_json JSONB NOT NULL,
  status_code VARCHAR(30) NOT NULL,
  current_step_order SMALLINT,
  submitted_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

## 14. 산출물 목록
- 백엔드 모델/스키마/서비스/API
- 프론트 BFF + 관리자 화면 2종 + 사용자 화면 4종
- 상태/권한/감사 테스트 케이스
- 운영자 가이드(결재선 설정, fallback 운영)

---

## 15. 결론
- 본 계획은 Vibe-HR에 맞춘 공통 신청서 프레임워크 구축안이다.
- 1차는 “신청서 코드관리 + 자동 결재선 + 표준 상태머신”에 집중하고,
- 2차에서 병렬결재/고급분기/외부연동을 확장하는 방식이 가장 안정적이다.