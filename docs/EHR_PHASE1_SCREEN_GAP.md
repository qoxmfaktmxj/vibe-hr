# EHR Legacy -> Vibe-HR 화면 추출/갭 (1차)

작성일: 2026-02-27  
기준: 레거시 SQL 객체명(프로시저/함수/테이블 prefix) + 현재 Vibe-HR 라우트/컴포넌트

## 1. 분류 기준

- `완료`: 화면 + API + 핵심 CRUD/업무 흐름이 존재
- `부분`: 화면/조회는 있으나 레거시 핵심 처리(배치/마감/정산/승인 등)가 부족
- `미구현`: 레거시 근거는 있으나 대응 화면이 없음

## 2. 화면 후보 매핑표 (1차)

| 도메인 | 레거시 근거 | 후보 화면(업무명) | Vibe-HR 현재 상태 | 우선순위 |
|---|---|---|---|---|
| HR | `THRM100*`, `P_HRM_SABUN_CREATE` | 사원마스터 | 완료 (`/hr/employee`) | 상 |
| HR | `THRM111~129`, `F_HRM_GET_EMP_INFO` | 인사기본정보 상세 | 완료/부분 (`/hr/basic`) | 상 |
| HR | `P_HRM_POST*`, `THRM191*` | 인사발령/이력관리 | 부분 (`/hr/admin/*`) | 상 |
| HR | `P_HRM_RETIRE_CHECK_LIST`, `TRET*` | 퇴직 체크리스트/퇴직처리 | 미구현 | 상 |
| ORG | `TORG*`, `P_ORG_CHANGE_*` | 조직코드관리 | 완료 (`/org/departments`) | 상 |
| ORG | `F_ORG_GET_CHIEF_*`, `P_ORG_APPLY_REORG` | 조직개편 시뮬/적용 | 부분 (`/org/chart` 중심) | 상 |
| ORG | `P_ORG_SCHEME_SORT_CREATE*` | 조직정렬/조직도 배치 | 미구현 | 중 |
| TIM | `TTIM*`, `P_TIM_TIMECARD_*` | 출퇴근/일근태 | 완료 (`/tim/check-in`, `/tim/status`) | 상 |
| TIM | `P_TIM_ANNUAL_*`, `F_TIM_GET_HOLIDAY_CNT` | 휴가 신청/승인/잔여 | 완료/부분 (`/tim/leave-*`, `/tim/annual-leave`) | 상 |
| TIM | `P_TIM_SCHEDULE_*`, `tim_schedule_*` | 근무스케줄 생성/예외 | 완료/부분 (`/tim/work-codes` + API) | 상 |
| TIM | `P_TIM_MONTH_*`, `P_TIM_WORK_HOUR_BATCH` | 월마감/근무시간 배치 | 미구현 | 상 |
| CPN | `TCPN*`, `P_CPN_BASE_*` | 급여코드/세율/항목그룹 | 완료 (`/payroll/*`) | 중 |
| CPN | `P_CPN_CAL_PAY*`, `P_CPN_SEP_*` | 급여계산/정산 실행 | 미구현 | 상 |
| CPN | `P_CPN_YEA_*`, `F_CPN_YEA_*` | 연말정산 실행/검증 | 미구현 | 상 |
| CPN | `P_CPN_YEA_CLOSE*`, `P_CPN_YEA_RESULT_CONFIRM` | 급여/연말 마감/취소 | 미구현 | 상 |
| HRI | `P_HRI_APP_MASTER_INS`, `F_HRI_APPROVAL_LINE` | 신청서 유형/결재선 관리 | 완료 (`/hri/admin/*`) | 상 |
| HRI | `P_HRI_APP_REQUEST_INS`, `P_HRI_AUTH_STATUS_AGREE` | 신청서 작성/결재/수신 | 완료 (`/hri/requests/*`, `/hri/tasks/*`) | 상 |
| HRI | `P_HRI_MAIL_SEND_INS*` | 결재/수신 알림 정책 | 부분 | 중 |
| SYS/SEC | `TSYS*`, `P_SYS_MANAGER_AUTH_CREATE`, `F_SEC_GET_AUTH_CHK` | 권한/메뉴/역할관리 | 완료/부분 (`/settings/*`) | 상 |
| SYS | `P_SYS_ENTER_DATA_COPY*`, `P_SYS_ALL_DATA_DELETE` | 데이터 이관/정합성 점검 도구 | 미구현 | 중 |
| BEN | `TBEN*`, `P_BEN_*`, `F_BEN_*` | 복리후생/4대보험/대부금 | 미구현 | 상 |
| PAP | `TPAP*`, `P_PAPN_*`, `F_PAPN_*` | 인사평가(평정/등급배분) | 미구현 | 중 |
| TRA | `TTRA*`, `P_TRA_*` | 교육신청/필수교육 관리 | 미구현 | 중 |

## 3. 우선 착수 대상 (추천)

1. `CPN 급여계산/마감` 화면군
2. `HR 퇴직/장기근속` 화면군
3. `BEN 복리후생` 화면군
4. `ORG 조직개편 적용` 화면군

## 4. “기존과 다르게 만든 부분” 처리 전략

- 동일 명칭 매핑이 안 되면 `대체구현` 태그를 먼저 부여한다.
- 대체구현은 다음 3종으로 구분한다.
  - `UI 통합형`: 레거시 2~3개 화면을 Vibe-HR 1개 화면으로 통합
  - `API 분해형`: 레거시 1개 프로시저를 Vibe-HR 다중 API로 분해
  - `정책 변경형`: 레거시 규칙을 신규 정책으로 치환
- 각 대체구현 건은 반드시 “레거시 근거 객체명”을 문서에 남긴다.

## 5. 2차 분석에서 추가할 항목

- 프로시저 내부 SQL로 실제 참조 테이블 추적
- 함수 호출 체인 기준의 화면별 입력/출력 파라미터 정의
- 배치/마감 계열의 실행 순서도(Pre-check -> Run -> Close -> Rollback)
