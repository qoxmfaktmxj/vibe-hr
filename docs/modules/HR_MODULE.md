# HR 모듈 상세 문서

## 목적
인사 기본정보(프로필/인사기록/마스터)를 일관된 구조로 관리한다.

## 현재 구현 범위
- 사원 기본정보 조회/수정
- 인사기록 CRUD (관리자)
- 관리자/일반 사용자 권한 분리

## 주요 경로
- Backend API: `backend/app/api/hr_basic.py`, `backend/app/api/employee.py`
- Frontend: `frontend/src/components/hr/*`, `frontend/src/app/hr/*`

## 데이터 모델 핵심
- `hr_employees`
- `hr_employee_basic_profiles`
- `hr_employee_info_records`

## 변경 시 주의
1. 로그인 계정(`auth_users`)과 `hr_employees.user_id` 1:1 무결성 필수
2. 인사기록 탭 UI는 탭 저장/라우팅 로직과 연동되어 있어 페이지 구조 변경 시 탭 동작도 같이 검증
3. role 정책(`admin`, `hr_manager`, `employee`)과 메뉴권한 동시 검증

## 테스트 체크
- 본인 정보 조회
- 관리자 대상 사원 정보 수정
- 인사기록 추가/수정/삭제
- 권한 없는 접근 차단(403)
