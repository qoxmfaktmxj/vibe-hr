# EHR Legacy 1차 인벤토리

작성일: 2026-02-27  
대상 소스: `C:\Users\kms\Desktop\EHR_DB명세` + 현재 `vibe-hr` 코드베이스

## 1. 레거시 DB 객체 총량

- 테이블: 1,092
- 프로시저: 371
- 함수: 525
- 패키지: 108
- 뷰: 41

근거 파일:
- `EHR_DB명세/Table_summary.md`
- `EHR_DB명세/Procedure_summary.md`
- `EHR_DB명세/Function_summary.md`
- `EHR_DB명세/Package_summary.md`
- `EHR_DB명세/View_summary.md`

## 2. 도메인별 객체 규모 (핵심 prefix 기준)

| 도메인 | 레거시 prefix | 테이블 | 프로시저 | 함수 | 메모 |
|---|---|---:|---:|---:|---|
| HR 인사 | `THRM` / `P_HRM*` / `F_HRM*` | 168 | 38 | 21 | 사원/인사기록/인사발령 로직 다수 |
| HRI 신청/결재 | `THRI` / `P_HRI*` / `F_HRI*` | 44 | 20 | 6 | 신청서/결재선/상태 전이 |
| ORG 조직 | `TORG` / `P_ORG*` / `F_ORG*` | 84 | 11 | 40 | 조직개편/조직장/권한 연동 |
| TIM 근태 | `TTIM` / `P_TIM*` / `F_TIM*` | 107 | 38 | 26 | 출퇴근/휴가/스케줄/집계 |
| CPN 급여 | `TCPN` / `P_CPN*` / `F_CPN*` | 254 | 139 | 107 | 계산/정산/연말정산 로직 집중 |
| BEN 복리 | `TBEN` / `P_BEN*` / `F_BEN*` | 79 | 15 | 19 | 4대보험/대부/복리후생 |
| PAP 평가 | `TPAP` / `P_PAP*` / `F_PAP*` | 60 | 47 | 45 | 평가주기/평정/등급 배분 |
| TRA 교육 | `TTRA` / `P_TRA*` / `F_TRA*` | 26 | 6 | 2 | 필수교육/교육신청 |
| SYS/SEC | `TSYS`,`TSEC` / `P_SYS*`,`P_SEC*` / `F_SYS*`,`F_SEC*` | 154 | 30 | 30 | 메뉴/권한/운영/배치 |

## 3. 현재 Vibe-HR 구현량 스냅샷

### 3.1 화면 라우트 (`frontend/src/app/**/page.tsx`)

| 모듈 | 페이지 수 |
|---|---:|
| `tim` | 10 |
| `hr` | 10 |
| `mng` | 9 |
| `org` | 7 |
| `settings` | 5 |
| `hri` | 5 |
| `payroll` | 4 |

### 3.2 백엔드 API (`backend/app/api/*.py`)

| 모듈 | API 파일 수 |
|---|---:|
| `tim_*` | 7 |
| `mng_*` | 4 |
| `hri_*` | 3 |
| `hr_*`, `employee`, `organization`, `pay_*`, `auth`, `menu`, `common`, `dashboard` | 각 1 |

## 4. 1차 판단 요약

- `HR/ORG/TIM/HRI`는 화면 골격과 API가 이미 존재하므로 레거시 대응률이 상대적으로 높다.
- `CPN`은 레거시 로직 규모가 가장 큰데 현재 Vibe-HR은 코드/세율/항목/그룹 중심으로 제한되어 있다.
- `BEN/PAP/TRA`는 레거시 근거는 충분하지만 Vibe-HR 구현은 사실상 미착수에 가깝다.
- 레거시 DB는 Oracle 프로시저/함수 의존도가 매우 높아, 화면 추출 시 SQL 객체 호출 흐름 추적이 필수다.

## 5. 다음 단계 (2차 분석 준비)

1. `Procedure_split`, `Function_split`에서 호출 관계(`CALL`, `SELECT F_*`) 추출
2. 화면 후보별 핵심 트랜잭션(조회/등록/승인/마감) 분리
3. Vibe-HR 라우트/메뉴와 매핑하여 `완료/부분/미구현` 상태 확정
