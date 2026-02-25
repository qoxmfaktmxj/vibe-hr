# MNG 모듈 DB/통합 테스트 계획서

작성일: 2026-02-26  
대상: `mng_*` 관리 모듈 (TASK 1~5)

## 1. 목적
- DB 연결/스키마/시드/CRUD가 실제로 정상 동작하는지 확인
- 로컬 환경에서 DB 실행이 막히는 경우에도, 다음 작업자가 바로 이어서 검증할 수 있도록 체크포인트를 표준화

## 2. 선행 조건
- PostgreSQL 기동 상태
- backend 실행 가능 환경(Python 3.x + dependencies)
- frontend 실행 가능 환경(Node + npm)
- 관리자 계정 로그인 가능

## 3. 테스트 범위
- 모델/테이블: `mng_companies` 포함 9개 테이블
- 시드: 메뉴 트리(`관리`) + MNG 공통코드 그룹
- API: `/api/v1/mng/*`
- 프론트: `/mng/*` 9개 화면

## 4. DB 테스트 시나리오

### 4.1 스키마/시드 검증
1. 서버 기동 후 테이블 존재 확인
2. 고유키/인덱스 존재 확인
3. 메뉴 `관리`(sort_order=800) 확인
4. 코드그룹 `MNG_*` 생성 확인

권장 SQL:
```sql
-- 9개 테이블 확인
select tablename
from pg_tables
where schemaname = 'public'
  and tablename like 'mng_%'
order by tablename;

-- 메뉴 확인
select code, name, sort_order
from app_menus
where code like 'mng%';

-- 공통코드 그룹 확인
select code, name
from app_code_groups
where code like 'MNG_%'
order by code;
```

### 4.2 무결성/제약조건 검증
1. 고객사 코드 중복 insert 차단(`uq_mng_companies_code`)
2. 외주계약 동일 `employee_id + start_date` 중복 차단
3. 인프라 마스터 동일 `(company_id, service_type, env_type)` 중복 차단
4. FK 무결성(존재하지 않는 employee/company/master 참조 차단)

### 4.3 CRUD/API 검증
각 엔드포인트별로 `GET -> POST -> PUT -> DELETE` 왕복 검증
- companies / manager-status
- dev-requests / dev-projects / dev-inquiries
- dev-staff (read-only)
- outsource-contracts / outsource-attendances
- infra-masters / infra-configs

### 4.4 회귀 검증
1. 기존 HR/ORG/TIM 화면 진입/조회 영향 없음
2. 메뉴 권한(`admin`, `hr_manager`) 정상 적용
3. 탭 전환 시 중복 재조회 이슈 미발생

## 5. 프론트 품질 기준 (요청사항 반영)
- AG Grid 적용 확인 (MNG 리스트 영역)
- shadcn/ui 컴포넌트 사용 확인
- 날짜 입력 `CustomDatePicker` 사용 확인 (`type="date"` 미사용)
- 인코딩 깨짐 문자 미포함

권장 점검 명령:
```powershell
# AG Grid 적용 확인
rg -n "MngSimpleGrid|AgGridReact" frontend/src/components/mng

# 커스텀 달력 사용 확인
rg -n "CustomDatePicker" frontend/src/components/mng
rg -n "type=\"date\"" frontend/src/components/mng

# 인코딩 깨짐 문자 탐지
rg -n "[\uFFFD]" frontend/src backend/app docs
```

## 6. 자동 검증 명령
```powershell
# Frontend
cd frontend
npm run lint
npm run build

# Backend (Python 가능 환경에서)
cd ../backend
python -m compileall app
```

## 7. 환경 제약 시 대체 절차
Python/DB 실행 불가 환경에서는 아래만 먼저 수행:
1. 정적 점검(`lint`, `build`, grep 기반 품질 체크)
2. API/서비스 코드 리뷰(엔드포인트 누락 여부)
3. DB 테스트 항목을 본 문서 기준으로 인수인계

## 8. 최종 체크리스트
- [ ] 9개 `mng_*` 테이블 생성 확인
- [ ] 메뉴/공통코드 시드 확인
- [ ] 제약조건(중복/FK) 검증
- [ ] API CRUD/조회 왕복 검증
- [ ] 프론트 9개 화면 동작 검증
- [ ] AG Grid + shadcn/ui + CustomDatePicker 기준 충족
- [ ] lint/build 통과
- [ ] 통합 회귀 테스트 통과

## 9. 이번 작업 기준 검증 로그 (2026-02-26)

### 1차 검증
- `npm run lint`: 통과
- `npm run build`: 통과
- 구조 점검:
  - `ag_grid=27`
  - `shadcn_imports=33`
  - `custom_datepicker=19`
  - `native_date_inputs=0`
  - `utf8_strict_decode=pass`

### 2차 검증 (재실행)
- `npm run lint`: 통과
- `npm run build`: 통과
- 구조 점검:
  - `ag_grid=27`
  - `shadcn_imports=33`
  - `custom_datepicker=19`
  - `native_date_inputs=0`
  - `utf8_strict_decode=pass`

### 참고
- backend 실행 검증은 현재 작업 환경에 Python 런타임이 없어 미수행.
- DB 연결 기반 테스트는 본 문서 4장 시나리오로 운영 환경에서 추가 수행 필요.
