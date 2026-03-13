# Menu and Sample Seed Policy

작성일: 2026-03-12  
적용 저장소: `C:\Users\kms\Desktop\dev\vibe-hr`

## 1. 목적

새 메뉴가 추가될 때마다 다음 두 가지가 항상 같이 들어가도록 기준을 고정한다.

1. 메뉴 seed
2. 해당 메뉴를 눈으로 확인할 수 있는 최소 샘플 데이터 seed

사용자 요구:
- “메뉴가 늘어났다는 것”을 어디서 실행해도 즉시 알 수 있어야 함
- 신규 메뉴가 빈 화면만 나오지 않고, 샘플 데이터 몇 건으로 기능 존재를 바로 인지할 수 있어야 함

## 2. 현재 코드에서 확인된 seed 패턴

메뉴 seed:
- `backend/app/bootstrap.py:228` `MENU_TREE`
- `backend/app/bootstrap.py:1200` `ensure_menus`
- `backend/app/bootstrap.py:1234` `ensure_menu_actions`

도메인 샘플 seed 예시:
- 급여 샘플: `backend/app/bootstrap.py:2408` `ensure_pay_phase2_samples`
- 복리후생 마스터: `backend/app/bootstrap.py:182` `WEL_BENEFIT_TYPE_SEEDS`, `2750` `ensure_wel_benefit_types`
- 교육 샘플: `backend/app/bootstrap.py:193` `TRA_ORGANIZATION_SEEDS`, `198` `TRA_COURSE_SEEDS`, `2789` `ensure_tra_seed_data`
- 평가 샘플: `backend/app/bootstrap.py:2172` `PAP_FINAL_RESULT_SEEDS`, `2180` `PAP_APPRAISAL_SEEDS`, `2209` `ensure_pap_final_results`, `2248` `ensure_pap_appraisal_masters`
- 공통결재 폼 샘플: `backend/app/bootstrap.py:2085` `HRI_FORM_TYPE_SEEDS`, `2543` `ensure_hri_form_types`

부트스트랩 실행 위치:
- `backend/app/bootstrap.py:3367` `ensure_menus(session)`
- `backend/app/bootstrap.py:3386` `ensure_pay_phase2_samples(session)`
- `backend/app/bootstrap.py:3392` `ensure_wel_benefit_types(session)`
- `backend/app/bootstrap.py:3393` `ensure_tra_seed_data(session)`

## 3. 앞으로의 정책

새 메뉴를 추가할 때는 아래 5가지를 하나의 작업 묶음으로 본다.

1. 화면/라우트 추가
2. `MENU_TREE` 에 메뉴 seed 추가
3. `ensure_<module>_seed_data()` 또는 동등 함수 추가
4. 부트스트랩 메인 시퀀스에 seed 함수 연결
5. Playwright로 메뉴/화면 노출 확인

즉, “메뉴 추가”는 단순 라우트 추가가 아니라 “보이는 메뉴 + 보이는 샘플 데이터 + 브라우저 검증”까지 포함한다.

## 4. 최소 기준

### 4.1 메뉴 seed

필수:
- `code`
- `name`
- `path`
- `icon`
- `sort_order`
- `roles`

위치:
- `backend/app/bootstrap.py` 의 `MENU_TREE`

### 4.2 샘플 seed

메뉴 종류별 최소 기준:

| 메뉴 유형 | 최소 seed 기준 |
|---|---|
| 마스터 관리형 | 3~5건 |
| 신청/결재형 | 1건 이상 Draft, 1건 이상 완료/반려 |
| 집계/실행형 | 1건 이상 실행 이력 + 1건 이상 대상 데이터 |
| 코드/설정형 | 5건 이상 대표 코드 |

### 4.3 브라우저 검증

필수 검증:
- 로그인 후 좌측 메뉴에 새 메뉴가 보이는지
- 해당 메뉴 화면 진입 시 빈 화면이 아닌 seed 데이터가 보이는지

권장 방식:
- 워크스페이스 전용 Playwright 세션 사용
- 예시:
  - `npx --yes --package @playwright/cli playwright-cli -s=wave1 open http://127.0.0.1:3000/login --browser chrome --profile C:\Users\kms\Desktop\dev\vibe-hr\output\playwright\wave1`
  - 이후 `snapshot`, `click`, `fill` 로 확인

이번 점검에서 확인한 브라우저 근거:
- 로그인 화면: `http://127.0.0.1:3000/login`
- 로그인 후 대시보드: `http://127.0.0.1:3000/dashboard`
- 스냅샷: `C:\Users\kms\Desktop\dev\vibe-hr\.playwright-cli\page-2026-03-12T08-38-59-846Z.yml`

## 5. 구현 체크리스트

새 모듈/메뉴 추가 시 반드시 체크:

1. `frontend/src/app/<module>/...` 화면 파일 생성
2. `backend/app/api/...` API 추가
3. `backend/app/services/...` 서비스 추가
4. `backend/app/bootstrap.py` `MENU_TREE` 에 메뉴 추가
5. `backend/app/bootstrap.py` 에 대표 seed 배열 추가
6. `backend/app/bootstrap.py` 에 `ensure_<module>_seed_data` 함수 추가
7. 부트스트랩 메인 시퀀스에 함수 등록
8. Playwright로 메뉴 노출/초기 데이터 확인

## 6. 권장 패턴

### 6.1 함수명

- `ensure_<module>_seed_data`
- `ensure_<module>_samples`
- `ensure_<module>_masters`

### 6.2 seed 구조

권장:
- 상단에 `*_SEEDS` 상수 배열 선언
- 중간에 `ensure_*` 함수 구현
- 하단 `bootstrap` 메인 실행부에서 호출

### 6.3 신규 메뉴 예시

복리후생 메뉴를 추가한다면:
- 메뉴 seed: `wel`, `wel.requests`, `wel.loan`, `wel.medical` 등
- 샘플 seed:
  - 유형 4건
  - 신청서 2건
  - 승인완료 1건
  - 급여연동 후보 1건

평가 운영 메뉴를 추가한다면:
- 메뉴 seed: `pap.cycles`, `pap.assignments`, `pap.results`
- 샘플 seed:
  - 평가회차 2건
  - 평가대상 3건
  - 결과 2건

## 7. 현재 상태에 대한 판단

현재는 일부 모듈만 이 정책을 충족한다.

충족 예:
- 급여: 메뉴 seed + 샘플 데이터 존재
- 교육: 메뉴 seed + 조직/과정 seed 존재
- 평가: 메뉴 seed + 결과/평가마스터 seed 존재

부분 충족:
- 복리후생: 마스터 seed는 있으나 메뉴와 실제 신청 샘플이 없다

미흡 포인트:
- 신규 메뉴를 추가할 때 “반드시 샘플 데이터도 넣는다”는 명문화 규칙이 없었다

## 8. 앞으로의 적용 기준

앞으로 제가 이 저장소에서 메뉴를 추가할 때는 다음을 기본 약속으로 따른다.

- 메뉴를 추가하면 `MENU_TREE` 도 같이 수정한다.
- 메뉴를 추가하면 해당 메뉴에서 바로 보이는 seed 데이터도 같이 넣는다.
- seed 데이터가 없다면 메뉴 추가를 완료로 보고하지 않는다.
- 가능하면 Playwright로 메뉴 노출과 초기 데이터를 같이 확인한다.
