# 근태(TIM) 모듈 상세 문서

## 목적
근무코드/공휴일/일상근태/휴가/리포트/스케줄 생성을 통합 관리한다.

## 현재 구현 범위
- Phase2: 출근/퇴근/현황/정정
- Phase3: 연차/휴가신청/승인
- Phase4: 리포트 요약 대시보드
- 휴가 3단계 흐름(요청 반영)
  - 1/2번 화면에서 휴가 생성·승인
  - 3번 화면에서 개인별 누적 휴가 현황 조회
- 스케줄 엔진 스캐폴드:
  - 부서 기본 스케줄
  - 개인 예외 스케줄
  - 일자별 확정 스케줄 생성

## 주요 경로
- Backend API:
  - `backend/app/api/tim_attendance_daily.py`
  - `backend/app/api/tim_leave.py`
  - `backend/app/api/tim_report.py`
  - `backend/app/api/tim_schedule.py`
- Frontend:
  - `frontend/src/app/tim/*`
  - `frontend/src/components/tim/*`
  - 대시보드 출퇴근 패널

## 데이터 모델 핵심
- `tim_attendance_daily`
- `tim_attendance_corrections`
- `tim_holidays`
- `tim_work_schedule_codes`
- `hr_annual_leaves`, `tim_leave_requests`
- (신규) `tim_schedule_patterns`, `tim_schedule_pattern_days`, `tim_department_schedule_assignments`, `tim_employee_schedule_exceptions`, `tim_employee_daily_schedules`

## 판정 우선순위(정책)
`개인예외 > 부서기본 > 회사기본`, 이후 공휴일 merge

## 변경 시 주의
1. 출퇴근 API는 지각/야근/주말 판정 로직과 직결됨
2. 휴가 신청 단위는 분 단위/일 단위 정책을 동시에 지원할 수 있게 확장 예정
3. 스케줄 생성은 overwrite 모드 사용 시 기존 데이터 덮어쓰기 영향 확인 필요
4. 개인별 휴가 누적 화면은 `hr_annual_leaves`를 기준으로 조회되며, 생성/승인 화면(1/2번)과 데이터 일관성을 유지해야 함

## 테스트 체크
- 출근/퇴근 누적
- today-schedule 정확성
- 휴가 승인/취소 시 연차 증감 무결성
- 리포트 집계 일관성
