# TIM Phase 4 - 테스트 가이드

## API
- `GET /api/v1/tim/reports/summary`
- `GET /api/v1/tim/reports/summary?start_date=2026-02-01&end_date=2026-02-29`

검증:
- `status_counts` 키 존재(present/late/absent/leave/remote)
- `department_summaries` 배열 반환
- `leave_type_summaries` 배열 반환

## UI
- `/tim/reports` 접속 가능 (권한: hr_manager/admin)
- 총 근태 집계/휴가신청 건수 카드 노출
- 부서별 출근율 테이블 노출

## 성능
- 최근 30일 집계 응답 2초 이내 목표
