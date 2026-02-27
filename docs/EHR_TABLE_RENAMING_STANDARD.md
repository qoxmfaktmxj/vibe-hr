# Legacy `T*` 테이블 -> Vibe-HR 테이블 네이밍 표준 (1차)

작성일: 2026-02-27  
적용 범위: 레거시 Oracle `T*` 계열 테이블을 Vibe-HR(PostgreSQL) 구조로 이관할 때

## 1. 목표

- 레거시 코드형 이름(`THRM100`, `TCPN501` 등)을 사람이 읽을 수 있는 업무명으로 전환
- 도메인 prefix를 통일해 화면/API/모델 추적 비용 감소
- “원본 추적 가능성”을 보장해 운영 중 역추적 가능하게 설계

## 2. Vibe-HR 표준 규칙

1. 테이블명은 `snake_case`, 소문자, 복수형 원칙
2. 도메인 prefix + 업무명 조합 사용  
   예: `hr_employees`, `tim_attendance_daily`, `hri_request_masters`
3. 신규 테이블은 코드형 suffix(`100`, `501`) 사용 금지
4. 레거시 객체코드는 별도 매핑 테이블로 관리

## 3. 도메인 prefix 매핑 규칙

| 레거시 prefix | Vibe-HR prefix | 비고 |
|---|---|---|
| `THRM*` | `hr_` | 인사 마스터/인사기록 |
| `THRI*` | `hri_` 또는 `hr_` | 신청/결재는 `hri_`, 인사기본 파생은 `hr_` |
| `TORG*` | `org_` | 조직/부서/조직구조 |
| `TTIM*` | `tim_` | 근태/휴가/스케줄 |
| `TCPN*` | `pay_` | 급여/세율/정산 |
| `TBEN*` | `ben_` | 복리후생/보험/대부 |
| `TPAP*` | `eva_` | 평가 도메인(신규 도입 시) |
| `TTRA*` | `tra_` | 교육 도메인(신규 도입 시) |
| `TSYS*` | `app_`/`auth_`/`sys_` | 메뉴/코드/권한 성격에 따라 분리 |
| `TSEC*` | `auth_`/`sec_` | 인증/보안 정책 |

## 4. 리네이밍 예시

| Legacy | New (예시) | 설명 |
|---|---|---|
| `THRM100` | `hr_employees` | 사원 기본 마스터 |
| `THRM111_HIST` | `hr_employee_info_records` | 인사기록 이력 |
| `TORG105` | `org_departments` | 부서 마스터 |
| `TTIM001` | `tim_attendance_daily` | 일근태 |
| `TTIM120` | `tim_leave_requests` | 휴가 신청 |
| `TCPN105` | `pay_payroll_codes` | 급여코드 |
| `TCPN403` | `pay_tax_rates` | 세율 |
| `THRI201` | `hri_request_masters` | 신청서 헤더 |

## 5. 필수 추적 테이블 (권장)

레거시와 신규가 다르게 설계된 경우가 많으므로, 아래 매핑 테이블을 반드시 유지:

```sql
create table if not exists app_legacy_object_xref (
  id bigserial primary key,
  legacy_object_type varchar(20) not null,  -- TABLE / VIEW / PROC / FUNC
  legacy_object_name varchar(128) not null, -- THRM100 / P_HRM_POST / F_HRM_GET_EMP_INFO
  new_domain varchar(30) not null,          -- hr / tim / org / pay / hri ...
  new_object_name varchar(128) not null,    -- hr_employees / hr_employee_service.create
  mapping_type varchar(20) not null,        -- 1:1 / 1:N / N:1 / REPLACED
  confidence varchar(10) not null,          -- HIGH / MED / LOW
  note text null,
  created_at timestamptz not null default now()
);
```

## 6. 프로시저/함수 로직 이관 원칙

- `P_*`(프로시저) 비즈니스 로직은 서비스 계층으로 이관
  - 예: `P_HRM_POST_*` -> `hr_basic_service.py` 계열 command 함수
- `F_*`(함수) 조회/계산 로직은
  - 단순 계산: 애플리케이션 함수로 이관
  - 집계 SQL: view/materialized view/API 쿼리로 이관
- 이관 시 함수명 자체를 보존할 필요는 없지만, `app_legacy_object_xref`에 원본명을 남긴다.

## 7. 적용 체크리스트

1. 신규 테이블 생성 시 `T*` 코드형 이름 사용 금지
2. 도메인 prefix 규칙 준수
3. 레거시 객체명 매핑 등록
4. 화면/API 문서에 레거시 근거 객체명 표기
5. `1:N` 또는 `N:1` 매핑은 반드시 사유 기록
