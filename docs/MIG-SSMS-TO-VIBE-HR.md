# SSMS-master -> vibe-hr 마이그레이션 설계서

> **작성일:** 2026-02-25
> **대상:** SSMS-master _NEW 화면 -> vibe-hr "관리" 메뉴 통합
> **목적:** AI 팀원 간 개발 분담용 설계 문서

---

## 1. 개요

### 1.1 마이그레이션 범위

SSMS-master 프로젝트의 _NEW 화면들을 vibe-hr 프로젝트에 **"관리"** 대메뉴로 추가한다.
- 메뉴 위치: **시스템(settings) 메뉴 바로 위** (sort_order: 800번대)
- 테이블 접두사: 기존 SSMS 테이블명 대신 **`mng_`** 접두사 사용
- 기술 스택 변환: Vue3 + Spring Boot + Oracle → **Next.js + FastAPI + PostgreSQL**

### 1.2 원본/대상 기술 스택 비교

| 구분 | SSMS-master (원본) | vibe-hr (대상) |
|------|-------------------|----------------|
| Frontend | Vue 3 + PrimeVue + Vite | Next.js 16 + React 19 + shadcn/ui + ag-grid |
| Backend | Spring Boot 2.7 + MyBatis | FastAPI + SQLModel |
| Database | Oracle 11g XE | PostgreSQL |
| Auth | JWT (자체 구현) | JWT (vibe-hr 기존 auth 활용) |
| State | Pinia | SWR + React Context |
| CSS | PrimeVue + Tailwind | Tailwind CSS 4 + shadcn/ui |

---

## 2. 메뉴 구조 설계

### 2.1 vibe-hr 기존 메뉴 트리 + 신규 "관리" 메뉴

```
대시보드          (sort_order: 100)
인사              (sort_order: 200)
조직              (sort_order: 300)
근태              (sort_order: 400)
신청서            (sort_order: 450)
급여              (sort_order: 500)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
★ 관리 (NEW)     (sort_order: 800)  ← 신규 추가
  ├─ 고객관리
  │   ├─ 고객사관리          /mng/companies
  │   └─ 담당자현황          /mng/manager-status
  ├─ 개발관리
  │   ├─ 추가개발관리        /mng/dev-requests
  │   ├─ 프로젝트관리        /mng/dev-projects
  │   ├─ 문의관리            /mng/dev-inquiries
  │   └─ 인력현황            /mng/dev-staff
  ├─ 외주관리
  │   ├─ 외주계약관리        /mng/outsource-contracts
  │   └─ 외주근태현황        /mng/outsource-attendance
  └─ 인프라관리
      └─ 인프라구성관리      /mng/infra
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
시스템            (sort_order: 900)
```

### 2.2 bootstrap.py MENU_TREE 추가 데이터

```python
{
    "code": "mng",
    "name": "관리",
    "path": None,
    "icon": "Briefcase",
    "sort_order": 800,
    "roles": ["admin", "hr_manager"],
    "children": [
        {
            "code": "mng.client",
            "name": "고객관리",
            "path": None,
            "icon": "Building",
            "sort_order": 810,
            "roles": ["admin", "hr_manager"],
            "children": [
                {"code": "mng.companies", "name": "고객사관리", "path": "/mng/companies", "icon": "Building", "sort_order": 811, "roles": ["admin", "hr_manager"]},
                {"code": "mng.manager-status", "name": "담당자현황", "path": "/mng/manager-status", "icon": "Users", "sort_order": 812, "roles": ["admin", "hr_manager"]},
            ],
        },
        {
            "code": "mng.dev",
            "name": "개발관리",
            "path": None,
            "icon": "Code",
            "sort_order": 820,
            "roles": ["admin", "hr_manager"],
            "children": [
                {"code": "mng.dev-requests", "name": "추가개발관리", "path": "/mng/dev-requests", "icon": "ListPlus", "sort_order": 821, "roles": ["admin", "hr_manager"]},
                {"code": "mng.dev-projects", "name": "프로젝트관리", "path": "/mng/dev-projects", "icon": "FolderKanban", "sort_order": 822, "roles": ["admin", "hr_manager"]},
                {"code": "mng.dev-inquiries", "name": "문의관리", "path": "/mng/dev-inquiries", "icon": "MessageSquare", "sort_order": 823, "roles": ["admin", "hr_manager"]},
                {"code": "mng.dev-staff", "name": "인력현황", "path": "/mng/dev-staff", "icon": "UserCheck", "sort_order": 824, "roles": ["admin", "hr_manager"]},
            ],
        },
        {
            "code": "mng.outsource",
            "name": "외주관리",
            "path": None,
            "icon": "UserPlus",
            "sort_order": 830,
            "roles": ["admin", "hr_manager"],
            "children": [
                {"code": "mng.outsource-contracts", "name": "외주계약관리", "path": "/mng/outsource-contracts", "icon": "FileText", "sort_order": 831, "roles": ["admin", "hr_manager"]},
                {"code": "mng.outsource-attendance", "name": "외주근태현황", "path": "/mng/outsource-attendance", "icon": "CalendarCheck", "sort_order": 832, "roles": ["admin", "hr_manager"]},
            ],
        },
        {
            "code": "mng.infra",
            "name": "인프라관리",
            "path": None,
            "icon": "Server",
            "sort_order": 840,
            "roles": ["admin"],
            "children": [
                {"code": "mng.infra-config", "name": "인프라구성관리", "path": "/mng/infra", "icon": "Server", "sort_order": 841, "roles": ["admin"]},
            ],
        },
    ],
}
```

---

## 3. 데이터베이스 설계

### 3.1 테이블 네이밍 규칙

| SSMS 원본 테이블 | vibe-hr 신규 테이블 | 설명 |
|------------------|---------------------|------|
| TMST001_NEW | **mng_companies** | 고객사 마스터 |
| TSMT052_NEW | **mng_manager_companies** | 담당자-고객사 매핑 |
| TSMT300_NEW | **mng_dev_requests** | 추가개발 요청 |
| TSMT310_NEW | **mng_dev_projects** | 추가개발 프로젝트 |
| TSMT320_NEW | **mng_dev_inquiries** | 추가개발 문의 |
| TSMT200_NEW | **mng_outsource_contracts** | 외주인력 계약 |
| TSMT201_NEW | **mng_outsource_attendances** | 외주인력 근태 |
| TSMT001_NEW | **mng_infra_masters** | 인프라 마스터 |
| TSMT002_NEW | **mng_infra_configs** | 인프라 구성 상세 |

> **참고:** SSMS의 `TSYS005_NEW`(공통코드), `TSYS305_NEW`(사용자), `TSYS972_NEW`(파일) 등 시스템 테이블은 vibe-hr 기존 테이블(`app_codes`, `auth_users`, 별도 파일관리)로 대체한다.

### 3.2 공통 컬럼 변환 규칙

| SSMS 컬럼 | vibe-hr 컬럼 | 변환 규칙 |
|-----------|-------------|-----------|
| ENTER_CD | (삭제) | 단일 테넌트이므로 불필요 |
| CHKID / CHKDATE | created_at / updated_at | UTC datetime 자동생성 |
| SABUN (사번) | employee_id (FK) | hr_employees.id 참조 |
| Y/N 플래그 | boolean | PostgreSQL native boolean |
| YYYYMMDD (문자열 날짜) | date | PostgreSQL native date |
| YYYYMM (문자열 년월) | date (1일로 저장) | 또는 year/month int 필드 분리 |
| CODE (공통코드 참조) | code_group + code | app_code_groups / app_codes 참조 |

### 3.3 SQLModel 엔티티 정의

아래 엔티티들을 `backend/app/models/entities.py`에 추가한다.

#### 3.3.1 mng_companies (고객사 마스터)

```python
class MngCompany(SQLModel, table=True):
    """고객사 마스터"""
    __tablename__ = "mng_companies"
    __table_args__ = (
        UniqueConstraint("company_code", name="uq_mng_companies_code"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    company_code: str = Field(max_length=20, index=True)       # COMPANY_CD
    company_name: str = Field(max_length=100)                   # COMPANY_NM
    company_group_code: Optional[str] = Field(default=None, max_length=20)  # COMPANY_GRP_CD
    company_type: Optional[str] = Field(default=None, max_length=40)        # OBJECT_DIV
    management_type: Optional[str] = Field(default=None, max_length=40)     # MANAGE_DIV
    representative_company: Optional[str] = Field(default=None, max_length=20)  # REPRESENT_COMPANY
    start_date: Optional[date] = None                           # SDATE
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
```

#### 3.3.2 mng_manager_companies (담당자-고객사 매핑)

```python
class MngManagerCompany(SQLModel, table=True):
    """담당자-고객사 매핑"""
    __tablename__ = "mng_manager_companies"
    __table_args__ = (
        UniqueConstraint("employee_id", "company_id", "start_date",
                         name="uq_mng_manager_companies_emp_comp_sdate"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    employee_id: int = Field(foreign_key="hr_employees.id", index=True)  # SABUN -> employee FK
    company_id: int = Field(foreign_key="mng_companies.id", index=True)  # COMPANY_CD -> company FK
    start_date: date                                             # SDATE
    end_date: Optional[date] = None                              # EDATE
    note: Optional[str] = Field(default=None, max_length=500)    # NOTE
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
```

#### 3.3.3 mng_dev_requests (추가개발 요청)

```python
class MngDevRequest(SQLModel, table=True):
    """추가개발 요청관리"""
    __tablename__ = "mng_dev_requests"

    id: Optional[int] = Field(default=None, primary_key=True)
    company_id: int = Field(foreign_key="mng_companies.id", index=True)    # REQUEST_COMPANY_CD
    request_ym: date                                  # REQUEST_YM (매월 1일로 저장)
    request_seq: int                                  # REQUEST_SEQ
    status_code: Optional[str] = Field(default=None, max_length=20)        # STATUS_CD (app_codes 참조)
    part_code: Optional[str] = Field(default=None, max_length=20)          # PART_CD
    requester_name: Optional[str] = Field(default=None, max_length=100)    # REQUEST_NM
    request_content: Optional[str] = None             # REQUEST_CONTENT
    manager_employee_id: Optional[int] = Field(default=None, foreign_key="hr_employees.id")  # MANAGER_SABUN
    developer_employee_id: Optional[int] = Field(default=None, foreign_key="hr_employees.id")  # DEVELOPER_SABUN
    is_paid: bool = Field(default=False)              # PAID_YN
    paid_content: Optional[str] = Field(default=None, max_length=500)      # PAID_CONTENT
    has_tax_bill: bool = Field(default=False)         # TAX_BILL_YN
    start_ym: Optional[date] = None                   # START_YM
    end_ym: Optional[date] = None                     # END_YM
    dev_start_date: Optional[date] = None             # SDATE
    dev_end_date: Optional[date] = None               # EDATE
    paid_man_months: Optional[float] = None           # PAID_MM
    actual_man_months: Optional[float] = None         # REAL_MM
    note: Optional[str] = Field(default=None, max_length=500)  # CONTENT
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
```

#### 3.3.4 mng_dev_projects (추가개발 프로젝트)

```python
class MngDevProject(SQLModel, table=True):
    """추가개발 프로젝트관리"""
    __tablename__ = "mng_dev_projects"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_name: str = Field(max_length=200)                   # PROJECT_NM
    company_id: int = Field(foreign_key="mng_companies.id", index=True)    # REQUEST_COMPANY_CD
    part_code: Optional[str] = Field(default=None, max_length=20)          # PART_CD
    assigned_staff: Optional[str] = Field(default=None, max_length=200)    # INPUT_MAN_POWER
    contract_start_date: Optional[date] = None        # CONTRACT_STD_DT
    contract_end_date: Optional[date] = None          # CONTRACT_END_DT
    dev_start_date: Optional[date] = None             # DEVELOP_STD_DT
    dev_end_date: Optional[date] = None               # DEVELOP_END_DT
    inspection_status: Optional[str] = Field(default=None, max_length=20)  # INSPECTION_YN
    has_tax_bill: bool = Field(default=False)          # TAX_BILL_YN
    actual_man_months: Optional[float] = None          # REAL_MM
    contract_amount: Optional[int] = None              # CONTRACT_PRICE
    note: Optional[str] = Field(default=None, max_length=500)  # REMARK
    # 파일첨부는 별도 mng_attachments 또는 기존 파일관리 모듈 활용
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
```

#### 3.3.5 mng_dev_inquiries (추가개발 문의)

```python
class MngDevInquiry(SQLModel, table=True):
    """추가개발 문의관리"""
    __tablename__ = "mng_dev_inquiries"

    id: Optional[int] = Field(default=None, primary_key=True)
    company_id: int = Field(foreign_key="mng_companies.id", index=True)    # REQUEST_COMPANY_CD
    inquiry_content: Optional[str] = None              # IN_CONTENT
    hoped_start_date: Optional[date] = None            # PROCEED_HOPE_DT
    estimated_man_months: Optional[float] = None       # EST_REAL_MM
    sales_rep_name: Optional[str] = Field(default=None, max_length=100)    # SALES_NM
    client_contact_name: Optional[str] = Field(default=None, max_length=100)  # CHARGE_NM
    progress_code: Optional[str] = Field(default=None, max_length=20)      # IN_PROCEED_CODE (app_codes 참조)
    is_confirmed: bool = Field(default=False)          # CONFIRM_YN
    project_name: Optional[str] = Field(default=None, max_length=200)      # PROJECT_NM
    note: Optional[str] = Field(default=None, max_length=500)  # REMARK
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
```

#### 3.3.6 mng_outsource_contracts (외주인력 계약)

```python
class MngOutsourceContract(SQLModel, table=True):
    """외주인력 계약관리"""
    __tablename__ = "mng_outsource_contracts"
    __table_args__ = (
        UniqueConstraint("employee_id", "start_date",
                         name="uq_mng_outsource_contracts_emp_sdate"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    employee_id: int = Field(foreign_key="hr_employees.id", index=True)    # SABUN
    start_date: date                                   # SDATE
    end_date: date                                     # EDATE
    total_leave_count: Optional[float] = Field(default=0)    # TOT_CNT (생성연차개수)
    extra_leave_count: Optional[float] = Field(default=0)    # SVC_CNT (추가연차개수)
    note: Optional[str] = Field(default=None, max_length=500)  # NOTE
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
```

#### 3.3.7 mng_outsource_attendances (외주인력 근태)

```python
class MngOutsourceAttendance(SQLModel, table=True):
    """외주인력 근태관리"""
    __tablename__ = "mng_outsource_attendances"

    id: Optional[int] = Field(default=None, primary_key=True)
    contract_id: int = Field(foreign_key="mng_outsource_contracts.id", index=True)
    employee_id: int = Field(foreign_key="hr_employees.id", index=True)    # SABUN
    attendance_code: str = Field(max_length=20)        # GNT_CD (app_codes 참조)
    apply_date: Optional[date] = None                  # APPLY_DATE
    status_code: Optional[str] = Field(default=None, max_length=20)  # STATUS_CD (app_codes 참조)
    start_date: date                                   # SDATE
    end_date: date                                     # EDATE
    apply_count: Optional[float] = None                # APPLY_CNT (자동계산)
    note: Optional[str] = Field(default=None, max_length=500)  # NOTE
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
```

#### 3.3.8 mng_infra_masters (인프라 마스터)

```python
class MngInfraMaster(SQLModel, table=True):
    """인프라 구성 마스터"""
    __tablename__ = "mng_infra_masters"
    __table_args__ = (
        UniqueConstraint("company_id", "service_type", "env_type",
                         name="uq_mng_infra_masters_comp_svc_env"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    company_id: int = Field(foreign_key="mng_companies.id", index=True)    # COMPANY_CD
    service_type: str = Field(max_length=40)           # TASK_GUBUN_CD
    env_type: str = Field(max_length=10)               # DEV_GB_CD ('dev' | 'prod')
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
```

#### 3.3.9 mng_infra_configs (인프라 구성 상세)

```python
class MngInfraConfig(SQLModel, table=True):
    """인프라 구성 상세 (키-값 방식)"""
    __tablename__ = "mng_infra_configs"
    __table_args__ = (
        UniqueConstraint("master_id", "section", "config_key",
                         name="uq_mng_infra_configs_master_section_key"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    master_id: int = Field(foreign_key="mng_infra_masters.id", index=True)
    section: str = Field(max_length=100)               # 섹션 구분 (WEB, WAS, DB 등)
    config_key: str = Field(max_length=100)            # COLUMN_NM
    config_value: Optional[str] = None                 # COLUMN_VALUE
    sort_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
```

### 3.4 공통코드 그룹 추가 (app_code_groups / app_codes)

SSMS의 `TSYS005_NEW` 공통코드를 vibe-hr의 `app_code_groups` + `app_codes`로 마이그레이션한다.

| SSMS GRCODE_CD | vibe-hr 그룹 코드 | 설명 | 코드 예시 |
|----------------|-------------------|------|----------|
| DEV_STATUS | MNG_DEV_STATUS | 개발 진행상태 | 접수, 진행중, 완료, 보류 |
| S10200 | MNG_PART | 파트 구분 | SI파트, SM파트 등 |
| S10300 | MNG_APPROVAL_STATUS | 승인 상태 | 신청, 승인, 반려 |
| GNT_CD | MNG_ATTENDANCE_TYPE | 외주 근태종류 | 연차, 반차, 병가 등 |
| STATUS_CD | MNG_ATTENDANCE_STATUS | 외주 근태상태 | 신청, 승인, 반려 |
| (신규) | MNG_INQUIRY_STATUS | 문의 진행상태 | 접수, 검토중, 완료 |
| (신규) | MNG_INSPECTION | 검수 상태 | 미검수, 검수완료 |
| (신규) | MNG_SERVICE_TYPE | 서비스 구분 | ERP, MES, WMS 등 |

---

## 4. Backend API 설계

### 4.1 API 라우터 구조

```
/api/v1/mng/
├── /companies              고객사 CRUD
├── /manager-status         담당자현황 조회
├── /dev-requests           추가개발 요청 CRUD
├── /dev-projects           추가개발 프로젝트 CRUD
├── /dev-inquiries          추가개발 문의 CRUD
├── /dev-staff              인력현황 조회 (read-only)
├── /outsource-contracts    외주계약 CRUD
├── /outsource-attendances  외주근태 CRUD
├── /infra-masters          인프라 마스터 CRUD
└── /infra-configs          인프라 구성 상세 CRUD
```

### 4.2 파일 생성 목록

#### Backend 신규 파일

| 파일 경로 | 설명 |
|----------|------|
| `backend/app/api/mng_company.py` | 고객사 API 라우터 |
| `backend/app/api/mng_dev.py` | 개발관리 API 라우터 (requests, projects, inquiries, staff) |
| `backend/app/api/mng_outsource.py` | 외주관리 API 라우터 (contracts, attendances) |
| `backend/app/api/mng_infra.py` | 인프라관리 API 라우터 |
| `backend/app/services/mng_company_service.py` | 고객사 서비스 |
| `backend/app/services/mng_dev_service.py` | 개발관리 서비스 |
| `backend/app/services/mng_outsource_service.py` | 외주관리 서비스 |
| `backend/app/services/mng_infra_service.py` | 인프라관리 서비스 |
| `backend/app/schemas/mng.py` | 관리 모듈 전체 Pydantic 스키마 |

#### Backend 수정 파일

| 파일 경로 | 변경 내용 |
|----------|----------|
| `backend/app/models/entities.py` | MngCompany 등 9개 모델 추가 |
| `backend/app/main.py` | 4개 라우터 등록 |
| `backend/app/bootstrap.py` | MENU_TREE에 "관리" 메뉴 추가 + 공통코드 시드 추가 |

### 4.3 주요 API 엔드포인트 상세

#### 4.3.1 고객사 관리 (`/api/v1/mng/companies`)

```
GET    /                    목록 조회 (페이징, 검색)
GET    /{id}                단건 상세
POST   /                    신규 등록
PUT    /{id}                수정
DELETE /                    다건 삭제 (body: {ids: [1,2,3]})
GET    /dropdown            고객사 드롭다운 (id, company_name만 반환)
```

#### 4.3.2 담당자 현황 (`/api/v1/mng/manager-status`)

```
GET    /                    담당자-고객사 매핑 목록 (JOIN 조회)
POST   /                    담당자-고객사 매핑 등록
DELETE /                    매핑 삭제
```

#### 4.3.3 추가개발 요청 (`/api/v1/mng/dev-requests`)

```
GET    /                    목록 조회 (페이징, 상태필터, 회사필터)
GET    /{id}                단건 상세
POST   /                    신규 등록
PUT    /{id}                수정
DELETE /                    다건 삭제
GET    /monthly-summary     월별 집계 (DevelopManagement의 list2 대응)
```

#### 4.3.4 추가개발 프로젝트 (`/api/v1/mng/dev-projects`)

```
GET    /                    목록 조회 (페이징, 회사필터, 기간필터)
GET    /{id}                단건 상세
POST   /                    신규 등록
PUT    /{id}                수정
DELETE /                    다건 삭제
```

#### 4.3.5 추가개발 문의 (`/api/v1/mng/dev-inquiries`)

```
GET    /                    목록 조회 (페이징, 상태필터, 회사필터)
GET    /{id}                단건 상세
POST   /                    신규 등록
PUT    /{id}                수정
DELETE /                    다건 삭제
```

#### 4.3.6 인력현황 (`/api/v1/mng/dev-staff`)

```
GET    /projects            프로젝트별 인력 현황 (read-only)
GET    /revenue-summary     월별 매출 현황 (read-only)
```

#### 4.3.7 외주계약 관리 (`/api/v1/mng/outsource-contracts`)

```
GET    /                    목록 조회 (기간검색, 사번/이름 검색)
GET    /{id}                단건 상세
POST   /                    신규 등록
PUT    /{id}                수정
DELETE /                    다건 삭제
GET    /check-duplicate     중복 체크 (employee_id + start_date)
```

#### 4.3.8 외주근태 관리 (`/api/v1/mng/outsource-attendances`)

```
GET    /summary             외주인력별 근태 요약 (발행/사용/잔여일수)
GET    /{contract_id}       계약별 상세 근태 목록
POST   /                    근태 등록
DELETE /                    근태 삭제
```

#### 4.3.9 인프라 관리 (`/api/v1/mng/infra-masters`, `/api/v1/mng/infra-configs`)

```
GET    /infra-masters                    마스터 목록 (회사별, 서비스구분별)
POST   /infra-masters                    마스터 등록
DELETE /infra-masters                    마스터 삭제
GET    /infra-configs/{master_id}        구성 상세 조회
POST   /infra-configs/{master_id}        구성 상세 등록/수정 (upsert)
DELETE /infra-configs/{id}               구성 상세 삭제
```

### 4.4 Pydantic 스키마 설계 (`backend/app/schemas/mng.py`)

```python
# ── 고객사 ──
class MngCompanyItem(BaseModel):
    id: int
    company_code: str
    company_name: str
    company_group_code: Optional[str]
    company_type: Optional[str]
    management_type: Optional[str]
    representative_company: Optional[str]
    start_date: Optional[date]
    is_active: bool
    created_at: datetime
    updated_at: datetime

class MngCompanyCreateRequest(BaseModel):
    company_code: str = Field(min_length=1, max_length=20)
    company_name: str = Field(min_length=1, max_length=100)
    company_group_code: Optional[str] = None
    company_type: Optional[str] = None
    management_type: Optional[str] = None
    representative_company: Optional[str] = None
    start_date: Optional[date] = None

class MngCompanyUpdateRequest(BaseModel):
    company_name: Optional[str] = None
    company_group_code: Optional[str] = None
    company_type: Optional[str] = None
    management_type: Optional[str] = None
    representative_company: Optional[str] = None
    start_date: Optional[date] = None
    is_active: Optional[bool] = None

class MngCompanyListResponse(BaseModel):
    items: list[MngCompanyItem]
    total: int

# ── 추가개발 요청 ──
class MngDevRequestItem(BaseModel):
    id: int
    company_id: int
    company_name: Optional[str] = None          # JOIN 결과
    request_ym: date
    request_seq: int
    status_code: Optional[str] = None
    status_name: Optional[str] = None           # app_codes JOIN
    part_code: Optional[str] = None
    part_name: Optional[str] = None             # app_codes JOIN
    requester_name: Optional[str] = None
    request_content: Optional[str] = None
    manager_employee_id: Optional[int] = None
    manager_name: Optional[str] = None          # JOIN 결과
    developer_employee_id: Optional[int] = None
    developer_name: Optional[str] = None        # JOIN 결과
    is_paid: bool
    paid_content: Optional[str] = None
    has_tax_bill: bool
    start_ym: Optional[date] = None
    end_ym: Optional[date] = None
    dev_start_date: Optional[date] = None
    dev_end_date: Optional[date] = None
    paid_man_months: Optional[float] = None
    actual_man_months: Optional[float] = None
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime

# (나머지 스키마도 동일 패턴으로 Item / CreateRequest / UpdateRequest / ListResponse 생성)
```

---

## 5. Frontend 설계

### 5.1 파일 생성 목록

#### 프론트엔드 신규 파일

```
frontend/src/app/mng/
├── companies/
│   └── page.tsx                     고객사관리 페이지
├── manager-status/
│   └── page.tsx                     담당자현황 페이지
├── dev-requests/
│   └── page.tsx                     추가개발관리 페이지
├── dev-projects/
│   └── page.tsx                     프로젝트관리 페이지
├── dev-inquiries/
│   └── page.tsx                     문의관리 페이지
├── dev-staff/
│   └── page.tsx                     인력현황 페이지
├── outsource-contracts/
│   └── page.tsx                     외주계약관리 페이지
├── outsource-attendance/
│   └── page.tsx                     외주근태현황 페이지
└── infra/
    └── page.tsx                     인프라구성관리 페이지

frontend/src/components/mng/
├── company-manager.tsx              고객사관리 클라이언트 컴포넌트
├── manager-status-viewer.tsx        담당자현황 클라이언트 컴포넌트
├── dev-request-manager.tsx          추가개발관리 클라이언트 컴포넌트
├── dev-project-manager.tsx          프로젝트관리 클라이언트 컴포넌트
├── dev-inquiry-manager.tsx          문의관리 클라이언트 컴포넌트
├── dev-staff-viewer.tsx             인력현황 클라이언트 컴포넌트
├── outsource-contract-manager.tsx   외주계약관리 클라이언트 컴포넌트
├── outsource-attendance-manager.tsx 외주근태현황 클라이언트 컴포넌트
└── infra-config-manager.tsx         인프라구성관리 클라이언트 컴포넌트

frontend/src/app/api/mng/
├── companies/route.ts               고객사 API 프록시
├── dev-requests/route.ts            추가개발 API 프록시
├── dev-projects/route.ts            프로젝트 API 프록시
├── dev-inquiries/route.ts           문의 API 프록시
├── dev-staff/route.ts               인력현황 API 프록시
├── outsource-contracts/route.ts     외주계약 API 프록시
├── outsource-attendances/route.ts   외주근태 API 프록시
├── infra-masters/route.ts           인프라마스터 API 프록시
└── infra-configs/route.ts           인프라구성 API 프록시
```

### 5.2 UI 컴포넌트 매핑 (SSMS PrimeVue -> vibe-hr shadcn/ui)

| SSMS (PrimeVue) | vibe-hr (shadcn/ui + ag-grid) | 용도 |
|------------------|-------------------------------|------|
| DataTable | ag-grid AgGridReact | 데이터 그리드 |
| Dialog | Dialog / Sheet | 모달 폼 |
| InputText | Input | 텍스트 입력 |
| InputNumber | Input (type=number) | 숫자 입력 |
| Textarea | Textarea | 멀티라인 텍스트 |
| Calendar | DatePicker (shadcn) | 날짜 선택 |
| Dropdown | Select / Combobox | 드롭다운 |
| Button | Button | 버튼 |
| Tag | Badge | 상태 뱃지 |
| Toast | Sonner toast | 알림 |
| ConfirmDialog | AlertDialog | 확인 다이얼로그 |
| FileUpload | Input (type=file) | 파일 업로드 |
| TabView | Tabs | 탭 UI |

### 5.3 페이지 구현 패턴 (vibe-hr 표준)

```tsx
// ── frontend/src/app/mng/companies/page.tsx ──
import { AppShell } from "@/components/layout/app-shell";
import { CompanyManager } from "@/components/mng/company-manager";
import { requireMenuAccess } from "@/lib/guard";

export default async function CompaniesPage() {
  await requireMenuAccess("/mng/companies");
  return (
    <AppShell title="고객사관리" description="고객사 정보를 관리합니다.">
      <CompanyManager />
    </AppShell>
  );
}
```

```tsx
// ── frontend/src/components/mng/company-manager.tsx ──
"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { AgGridReact } from "ag-grid-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function CompanyManager() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const { data, mutate } = useSWR(
    `/api/mng/companies?page=${page}&search=${search}`,
    fetcher
  );

  const columnDefs = [
    { field: "company_code", headerName: "회사코드", width: 120 },
    { field: "company_name", headerName: "회사이름", flex: 1 },
    { field: "company_type", headerName: "회사구분", width: 120 },
    { field: "start_date", headerName: "시작날짜", width: 120 },
    // ... 나머지 컬럼
  ];

  // CRUD 핸들러 (create, update, delete) ...

  return (
    <div className="flex flex-col gap-4">
      {/* 검색/버튼 영역 */}
      {/* ag-grid 테이블 영역 */}
      {/* 등록/수정 Dialog */}
    </div>
  );
}
```

---

## 6. 개발 작업 분배 (AI 팀원용)

### TASK 1: DB 모델 + 공통코드 시드 (선행 작업)

**담당 범위:**
1. `backend/app/models/entities.py` — 9개 모델 추가 (섹션 3.3 참조)
2. `backend/app/bootstrap.py` — MENU_TREE에 "관리" 메뉴 추가 (섹션 2.2 참조)
3. `backend/app/bootstrap.py` — 공통코드 그룹/코드 시드 추가 (섹션 3.4 참조)

**완료 조건:**
- 서버 기동 시 mng_* 테이블 9개 자동 생성
- 메뉴에 "관리" 트리 표시
- 공통코드 드롭다운 데이터 조회 가능

---

### TASK 2: 고객사 관리 (Backend + Frontend 풀스택)

**담당 범위:**
1. `backend/app/schemas/mng.py` — MngCompany 관련 스키마
2. `backend/app/services/mng_company_service.py` — CRUD + dropdown 서비스
3. `backend/app/api/mng_company.py` — API 라우터
4. `backend/app/main.py` — 라우터 등록
5. `frontend/src/app/mng/companies/page.tsx` — 페이지
6. `frontend/src/components/mng/company-manager.tsx` — 클라이언트 컴포넌트
7. `frontend/src/app/api/mng/companies/route.ts` — API 프록시
8. `frontend/src/app/mng/manager-status/page.tsx` — 담당자현황 페이지
9. `frontend/src/components/mng/manager-status-viewer.tsx` — 담당자현황 컴포넌트
10. `frontend/src/app/api/mng/manager-status/route.ts` — API 프록시

**완료 조건:**
- 고객사 CRUD 전체 동작
- 담당자-고객사 매핑 조회/등록/삭제
- 다른 화면에서 고객사 드롭다운 사용 가능

---

### TASK 3: 개발관리 4개 화면 (Backend + Frontend 풀스택)

**담당 범위:**
1. `backend/app/schemas/mng.py` — DevRequest, DevProject, DevInquiry 스키마 추가
2. `backend/app/services/mng_dev_service.py` — 개발관리 전체 서비스
3. `backend/app/api/mng_dev.py` — 개발관리 API 라우터
4. `backend/app/main.py` — 라우터 등록
5. `frontend/src/app/mng/dev-requests/page.tsx` + 컴포넌트
6. `frontend/src/app/mng/dev-projects/page.tsx` + 컴포넌트
7. `frontend/src/app/mng/dev-inquiries/page.tsx` + 컴포넌트
8. `frontend/src/app/mng/dev-staff/page.tsx` + 컴포넌트
9. 각 페이지별 `frontend/src/app/api/mng/` API 프록시

**의존:** TASK 1 (모델), TASK 2 (고객사 드롭다운)

**완료 조건:**
- 추가개발관리 CRUD + 월별집계
- 프로젝트관리 CRUD
- 문의관리 CRUD
- 인력현황 읽기전용 대시보드 (프로젝트별, 월별 매출)

---

### TASK 4: 외주관리 2개 화면 (Backend + Frontend 풀스택)

**담당 범위:**
1. `backend/app/schemas/mng.py` — OutsourceContract, OutsourceAttendance 스키마 추가
2. `backend/app/services/mng_outsource_service.py` — 외주관리 서비스
3. `backend/app/api/mng_outsource.py` — 외주관리 API 라우터
4. `backend/app/main.py` — 라우터 등록
5. `frontend/src/app/mng/outsource-contracts/page.tsx` + 컴포넌트
6. `frontend/src/app/mng/outsource-attendance/page.tsx` + 컴포넌트
7. 각 페이지별 API 프록시

**의존:** TASK 1 (모델)

**완료 조건:**
- 외주계약 CRUD + 중복체크
- 외주근태 요약(발행/사용/잔여일수) + 상세근태 CRUD
- 근태코드/상태코드 드롭다운 동작

---

### TASK 5: 인프라관리 1개 화면 (Backend + Frontend 풀스택)

**담당 범위:**
1. `backend/app/schemas/mng.py` — InfraMaster, InfraConfig 스키마 추가
2. `backend/app/services/mng_infra_service.py` — 인프라관리 서비스
3. `backend/app/api/mng_infra.py` — 인프라관리 API 라우터
4. `backend/app/main.py` — 라우터 등록
5. `frontend/src/app/mng/infra/page.tsx` + 컴포넌트
6. API 프록시

**의존:** TASK 1 (모델), TASK 2 (고객사 드롭다운)

**완료 조건:**
- 인프라 마스터 등록/삭제 (회사 + 서비스구분 + 개발/운영)
- 인프라 구성 상세 키-값 편집 (동적 폼)
- 개발/운영 인프라 정보 여부 Tag 표시

---

## 7. 작업 순서 및 의존관계

```
TASK 1 (DB 모델 + 시드)
   │
   ├──→ TASK 2 (고객사) ──→ TASK 3 (개발관리) ※ 고객사 드롭다운 의존
   │                    └──→ TASK 5 (인프라)   ※ 고객사 드롭다운 의존
   │
   └──→ TASK 4 (외주관리) ※ 독립 진행 가능
```

**권장 실행 순서:**
1. TASK 1 (모든 작업의 기반)
2. TASK 2 + TASK 4 (병렬 진행)
3. TASK 3 + TASK 5 (TASK 2 완료 후 병렬 진행)

---

## 8. 주의사항 및 컨벤션

### 8.1 vibe-hr 코딩 컨벤션 준수

- **Backend 모델:** `SQLModel` 클래스, `__tablename__`은 snake_case 복수형
- **Backend 서비스:** 함수형 서비스 (클래스가 아닌 함수 모듈)
- **Backend API:** FastAPI `APIRouter`, `Depends(get_session)`, `Depends(get_current_user)`
- **권한 체크:** `dependencies=[Depends(require_roles("admin", "hr_manager"))]`
- **Frontend 페이지:** `requireMenuAccess()` → `AppShell` 래핑 → 클라이언트 컴포넌트
- **Frontend 데이터:** SWR `useSWR` 훅으로 데이터 fetching
- **Frontend UI:** shadcn/ui 컴포넌트 + ag-grid 테이블
- **알림:** `toast.success()` / `toast.error()` (Sonner)

### 8.2 SSMS 원본과 다른 점

| 항목 | SSMS 방식 | vibe-hr 방식 |
|------|----------|-------------|
| DB | Oracle + 문자열 날짜 | PostgreSQL + native date |
| 페이징 | ROW_NUMBER + startRow/endRow | offset/limit 또는 page/size |
| 사용자 참조 | SABUN(사번) 문자열 | employee_id (int FK) |
| 코드 참조 | GRCODE_CD + CODE 문자열 | app_code_groups + app_codes FK |
| 파일 관리 | TSYS972_NEW 자체 시퀀스 | 추후 파일모듈 구현 시 연동 |
| Y/N 플래그 | 문자열 'Y'/'N' 또는 '1'/'0' | boolean true/false |
| 멀티테넌트 | ENTER_CD 컬럼 | 단일 테넌트 (ENTER_CD 제거) |

### 8.3 파일 첨부 처리

SSMS의 `TSYS972_NEW` 파일관리는 1차 마이그레이션에서 **제외**한다.
- 프로젝트, 문의 화면의 파일첨부 기능은 **2차 구현**으로 분리
- 우선 CRUD 기본 기능 먼저 완성한 후, 파일 업로드 모듈 별도 설계

---

## 9. 체크리스트 (전체)

- [x] TASK 1: entities.py에 9개 MNG 모델 추가
- [x] TASK 1: bootstrap.py MENU_TREE에 "관리" 메뉴 트리 추가
- [x] TASK 1: bootstrap.py 공통코드 시드 추가 (MNG_* 코드그룹)
- [ ] TASK 1: 서버 기동 후 테이블/메뉴/코드 생성 확인
- [x] TASK 2: 고객사 Backend (스키마 + 서비스 + API)
- [x] TASK 2: 고객사 Frontend (페이지 + 컴포넌트 + API프록시)
- [x] TASK 2: 담당자현황 Backend + Frontend
- [x] TASK 3: 추가개발관리 Backend + Frontend
- [x] TASK 3: 프로젝트관리 Backend + Frontend
- [x] TASK 3: 문의관리 Backend + Frontend
- [x] TASK 3: 인력현황 Backend + Frontend
- [x] TASK 4: 외주계약관리 Backend + Frontend
- [x] TASK 4: 외주근태현황 Backend + Frontend
- [x] TASK 5: 인프라구성관리 Backend + Frontend
- [ ] 전체 통합 테스트
- [ ] 2차: 파일첨부 모듈 연동

---

## 10. 진행 로그 (인수인계용)

### 2026-02-25 진행분 (TASK 1~5 구현/보완)

- 완료:
  - backend MNG 모델/시드/라우터 기본 골격 반영
  - backend MNG 스키마/서비스/API 구현
  - frontend MNG API 프록시 기본 경로 생성

### 2026-02-26 추가 진행분 (중단 지점 이후 이어서 완료)

- 완료:
  - backend 보완:
    - `mng_company.py` 누락 import (`update_company`) 보완
    - 개발관리 API 확장:
      - `GET /api/v1/mng/dev-requests/monthly-summary`
      - `GET /api/v1/mng/dev-staff/projects`
      - `GET /api/v1/mng/dev-staff/revenue-summary`
    - 외주계약 중복체크 API 추가:
      - `GET /api/v1/mng/outsource-contracts/check-duplicate`
  - frontend API 프록시 보완:
    - `dev-requests/monthly-summary`
    - `dev-staff/projects`, `dev-staff/revenue-summary`
    - `outsource-contracts/check-duplicate`
    - `outsource-attendances/[contractId]`
    - `infra-configs/[masterId]`, `infra-configs/item/[configId]`
  - frontend 페이지/컴포넌트 9개 구현:
    - 고객사관리, 담당자현황
    - 추가개발관리, 프로젝트관리, 문의관리, 인력현황
    - 외주계약관리, 외주근태현황
    - 인프라구성관리
  - 프론트 타입 추가:
    - `frontend/src/types/mng.ts`
  - 프론트 정적검증:
    - `npm run lint` 통과

- 미완료/확인 필요:
  - 통합 테스트(실서버 기동 + DB 반영 확인)
  - Python 런타임 부재로 backend 실행 검증 미수행(현재 작업 환경 기준)
