<!-- IMMUTABLE PRE-CUTOVER ARCHIVE: historical FastAPI/Alembic evidence only; not an executable Spring operating instruction. -->
# Alembic 마이그레이션 도입 검토 (v0.1)

> **IMMUTABLE PRE-CUTOVER ARCHIVE - NON-EXECUTABLE**
>
> This document preserves retired migration planning evidence. Do not run, restore, or update legacy commands or paths. Use `docs/SPRING_BOOT_JAVA_MIGRATION_PLAN.md` for current Spring-only guidance.

- Date: 2026-07-08
- Status: approved (2026-07-09 사용자 승인, 선행조건인 DB 단일화 완료) → 도입 착수
- Risk Class: R3 (DB 스키마/마이그레이션 체계)
- Owner: kms

## 1. 문제 (사고 근거)

현행: `SQLModel.metadata.create_all` + 수동 `ADD COLUMN IF NOT EXISTS` 패치 산재 (`app/core/database.py init_db()`, `bootstrap.py`의 ensure_* 5곳+).

- create_all은 **기존 테이블에 컬럼을 추가하지 않음** → 모델 변경 시 패치를 잊으면 드리프트
- **실사고**: 2026-07-08, `tim_attendance_daily` 9개 컬럼 + `wel_benefit_requests.employee_id` 드리프트로 근태 체크인 API 500 (TASK_LEDGER `VH-SESSION-20260708`)
- 패치가 2개 파일에 흩어져 적용 순서·이력 추적 불가, 롤백 수단 없음

## 2. 선택지

| 안 | 내용 | 평가 |
|---|---|---|
| A. Alembic 도입 | autogenerate 기반 버전 관리 | 표준. 이력·롤백·CI 검증 가능. 초기 셋업 비용 |
| B. 현행 유지 + 드리프트 검사 자동화 | metadata vs information_schema 비교 스크립트를 pytest/CI에 추가 | 저비용이나 근본 해결 아님 (검출만, 적용은 여전히 수동) |
| C. A+B 병행 | Alembic + 드리프트 검사를 안전망으로 | **권고** |

## 3. 권고: C안

Alembic을 단일 스키마 변경 경로로 만들고, 드리프트 검사를 회귀 테스트로 상시 유지.

### 도입 절차 (승인 후)

1. `alembic init backend/migrations` — env.py는 `app.core.config.settings.database_url` + `SQLModel.metadata` 연결
2. **baseline**: 현행 모델 상태를 최초 리비전으로 autogenerate → 기존 DB에는 `alembic stamp head` (테이블 재생성 없음)
3. `init_db()`의 create_all + DO $$ 패치 블록 제거는 **한 릴리스 유예** (stamp 정착 확인 후 제거)
4. bootstrap의 ensure_*_schema 함수들 → 해당 내용이 baseline에 포함됨을 확인 후 삭제
5. 개발 워크플로 문서화: 모델 변경 → `alembic revision --autogenerate` → 리뷰 → `alembic upgrade head`
6. 드리프트 검사 pytest 추가 (metadata vs information_schema — 2026-07-08 세션의 비교 스크립트 로직 재사용)
7. CI: PR에 미적용 autogenerate diff 존재 시 실패 (스키마 변경 누락 방지)

### 주의점

- **이중 DB**: `.env`는 `myhr`, 예제는 `vibe_hr` — stamp 전에 단일화 필수 (선행: 이중 DB 정리 태스크)
- autogenerate 노이즈: SQLModel 타입 표현 차이로 가짜 diff 가능 → baseline 직후 `alembic check` 클린 확인
- PAP 테이블 대문자 리네임 이력(`"PAP_APPRAISAL_MASTERS"`) 같은 비표준 상태가 baseline에 이미 반영돼 있는지 검증 필요
- 테스트는 SQLite 메모리 create_all 유지 (마이그레이션은 PostgreSQL 대상만)

## 4. 승인 요청 사항 (R3)

1. C안(Alembic + 드리프트 검사 안전망) 채택
2. 선행 조건: myhr/vibe_hr DB 단일화 완료 후 착수
3. baseline stamp 방식(기존 DB 무변경) 승인
<!-- IMMUTABLE PRE-CUTOVER ARCHIVE: historical FastAPI/Alembic evidence only; not an executable Spring operating instruction. -->
