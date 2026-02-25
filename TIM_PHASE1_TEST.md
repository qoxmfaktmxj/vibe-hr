# TIM Phase 1 - 기초설정 테스트 가이드

## 범위
- 근태코드관리 `/tim/codes`
- 근무코드관리 `/tim/work-codes`
- 공휴일관리 `/tim/holidays`

## 핵심 검증
1. 근태코드 18개 시드 확인
2. 근무코드 8개 시드 확인
3. 공휴일 2025/2026 데이터 확인
4. Batch 저장(insert/update/delete) 동작 확인
5. 메뉴 권한(hr_manager/admin) 확인

## 빠른 API 체크
- `GET /api/v1/tim/attendance-codes`
- `GET /api/v1/tim/work-schedules`
- `GET /api/v1/tim/holidays?year=2026`

## 성공 기준
- CRUD 정상
- 화면 AG Grid 저장/엑셀 내보내기 정상
- 권한 제어 정상
