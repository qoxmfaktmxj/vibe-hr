# TRA(교육) 화면 구축 체크리스트

작성일: 2026-02-27  
상태: Draft

## 1) 범위 확정
- [ ] 1차 구축 화면 범위 확정 (`/tra/course-events`, `/tra/applications`, `/tra/required-standards`, `/tra/required-targets`, `/tra/elearning-windows`, `/tra/histories`, `/tra/cyber-upload`)
- [ ] 화면별 담당자(백엔드/프론트) 지정
- [ ] 레거시-신규 매핑 정책 확정 (`TTRA* -> tra_*`)

## 2) DB/도메인 설계
- [ ] 핵심 테이블 매핑 설계서 작성 (`TTRA001/101/121/160/161/201/250/301/401`)
- [ ] 신규 엔티티 모델 정의 (`tra_organizations`, `tra_courses`, `tra_events`, `tra_required_rules`, `tra_required_targets`, `tra_applications`, `tra_elearning_windows`, `tra_histories`, `tra_cyber_uploads`)
- [ ] PK/UK/인덱스 설계 확정 (회차/대상자 생성 중복 방지 포함)
- [ ] 마이그레이션 작성 및 적용

## 3) 백엔드 API 구현
- [ ] `backend/app/schemas/tra.py` 생성
- [ ] `backend/app/services/tra_service.py` 생성
- [ ] `backend/app/api/tra.py` 생성
- [ ] `backend/app/main.py`에 TRA router 등록

### 3-1) 기본 CRUD API
- [ ] 과정/회차 조회/저장 API
- [ ] 교육신청 조회/등록 API
- [ ] 필수교육 기준 조회/저장 API
- [ ] 필수교육 대상 조회 API
- [ ] 이러닝 신청기간 조회/저장 API
- [ ] 교육이력 조회/수정 API

### 3-2) 배치/업무 API
- [ ] 필수교육 회차 자동생성 API (`required-events`)
- [ ] 필수교육 대상자 자동생성 API (`required-targets`)
- [ ] 이러닝 신청기간 자동생성 API (`elearning-windows`)
- [ ] 사이버교육 업로드 반영 API (`cyber-results/apply`)

### 3-3) 결재(HRI) 연동
- [ ] 교육신청 시 결재요청 헤더/라인 생성
- [ ] 승인 완료 시 교육이력 반영 처리
- [ ] 반려/회수 시 데이터 정합성 처리

## 4) 프론트 화면 구현 (AG Grid 표준)
- [ ] 페이지 파일 생성 (`frontend/src/app/tra/**/page.tsx`)
- [ ] 각 페이지에 `GRID_SCREEN` metadata 선언
- [ ] 화면 컴포넌트 생성 (`frontend/src/components/tra/*`)
- [ ] 공통 모듈 사용 강제 (`components/grid/*`, `lib/grid/*`)
- [ ] 상태 계약 적용 (`_status`, `_original`, `_prevStatus`)
- [ ] 툴바 순서 준수 (`query -> create -> copy -> template -> upload -> save -> download`)

### 4-1) 화면별 체크
- [ ] `course-events` (과정/회차 관리)
- [ ] `applications` (교육신청 관리)
- [ ] `required-standards` (필수교육 기준관리)
- [ ] `required-targets` (필수교육 대상/이수현황)
- [ ] `elearning-windows` (이러닝 신청기간)
- [ ] `histories` (교육이력 관리)
- [ ] `cyber-upload` (업로드/반영)

### 4-2) 레지스트리/검증
- [ ] `config/grid-screens.json`에 TRA 화면 모두 등록
- [ ] `npm run validate:grid` 통과
- [ ] `npm run lint` 통과
- [ ] `npm run build` 통과

## 5) 메뉴/권한
- [ ] `backend/app/bootstrap.py` 메뉴 트리에 `tra.*` 추가
- [ ] 기본 권한 매핑
- [ ] 조회 권한: `employee`, `hr_manager`, `admin`
- [ ] 기준/배치 실행 권한: `hr_manager`, `admin`
- [ ] 권한별 버튼 노출/차단 검증

## 6) 테스트

### 6-1) 기능 테스트
- [ ] 과정/회차 생성/수정/삭제 시나리오
- [ ] 교육신청 작성/조회 시나리오
- [ ] 필수교육 기준 저장/조회 시나리오
- [ ] 필수교육 대상 생성 배치 시나리오
- [ ] 이러닝 기간 생성 배치 시나리오
- [ ] 사이버 업로드 반영 시나리오

### 6-2) 통합 테스트
- [ ] 신청 -> 결재 -> 이력반영 E2E
- [ ] 반려/회수 -> 데이터 복구 E2E
- [ ] 배치 재실행 idempotent 검증

## 7) 주차별 실행 계획
- [ ] 1주차: 과정/회차 + 교육신청 (API/화면)
- [ ] 2주차: 필수교육 기준/대상 + 자동생성 배치
- [ ] 3주차: 이러닝 기간 + 교육이력 + 사이버 반영
- [ ] 4주차: 메뉴/권한 + 통합테스트 + 운영 점검

## 8) 완료 기준
- [ ] `/tra/*` 1차 화면 7종 운영 가능
- [ ] `/api/v1/tra/*` 핵심 API 및 배치 운영 가능
- [ ] 결재 연동 완료(신청/승인/반려 흐름)
- [ ] AG Grid 표준 검증 3종(`validate:grid`, `lint`, `build`) 통과
- [ ] E2E 2종 이상 통과 기록
