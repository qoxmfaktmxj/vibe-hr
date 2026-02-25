# 급여/보상(CPN) 모듈 상세 문서

## 목적
급여 기초코드/요율/수당·공제/그룹을 기준으로 월급여 계산 파이프라인을 구축한다.

## 현재 구현 범위
- Phase1 중심
  - 급여코드
  - 세율/보험요율
  - 수당/공제항목
  - 항목그룹
- 시드 기반 기본 데이터 자동 반영

## 주요 경로
- Backend API: `backend/app/api/pay_setup.py`
- Frontend: `frontend/src/app/payroll/*`

## 데이터 모델 핵심
- `pay_payroll_codes`
- `pay_tax_rates`
- `pay_allowance_deductions`
- `pay_item_groups`, `pay_item_group_details`

## 변경 시 주의
1. 급여 계산 엔진 도입 전에도 마스터코드의 backward compatibility 유지 필요
2. 세율 데이터는 연도별 versioning 보장
3. 과세/비과세 구분 변경 시 급여 산식 영향도 큼

## 테스트 체크
- 목록/배치저장/삭제
- 코드 중복 제약(Unique)
- 시드 재실행 시 upsert 동작
