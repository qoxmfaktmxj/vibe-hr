from __future__ import annotations

import json
from datetime import date, datetime, timedelta
import random
import string

from sqlalchemy import func, text
from sqlmodel import Session, select

from app.core.security import hash_password
from app.models import (
    AppCode,
    AppCodeGroup,
    AppMenu,
    AppMenuAction,
    AppMenuRole,
    AppSystemSetting,
    AuthRole,
    AuthUser,
    AuthUserRole,
    HrAttendanceDaily,
    HrEmployee,
    HrEmployeeBasicProfile,
    HrEmployeeInfoRecord,
    HrContactPoint,
    HrCareer,
    HrLicense,
    HrMilitary,
    HrRecruitFinalist,
    HrRewardPunish,
    HrRetireChecklistItem,
    HrAppointmentOrder,
    HrAppointmentOrderItem,
    PapFinalResult,
    PapAppraisalMaster,
    HrAnnualLeave,
    HrLeaveRequest,
    OrgCorporation,
    OrgDepartment,
    TimAttendanceCode,
    TimHoliday,
    TimWorkScheduleCode,
    PayPayrollCode,
    PayTaxRate,
    PayAllowanceDeduction,
    PayItemGroup,
    PayItemGroupDetail,
    PayEmployeeProfile,
    PayVariableInput,
    PayPayrollRun,
    PayPayrollRunEvent,
    HriFormType,
    HriFormTypePolicy,
    HriApprovalLineTemplate,
    HriApprovalLineStep,
    HriFormTypeApprovalMap,
    HriApprovalActorRule,
    HriRequestMaster,
    HriRequestStepSnapshot,
    HriReqLeave,
    TimSchedulePattern,
    TimSchedulePatternDay,
    TimDepartmentScheduleAssignment,
    TimEmployeeScheduleException,
    MngCompany,
    MngManagerCompany,
    MngDevRequest,
    MngDevProject,
    MngDevInquiry,
    MngOutsourceContract,
    MngOutsourceAttendance,
    MngInfraMaster,
    MngInfraConfig,
    WelBenefitRequest,
    WelBenefitType,
    TraOrganization,
    TraCourse,
    TraEvent,
    TraRequiredRule,
    TraRequiredTarget,
    TraApplication,
    TraHistory,
    TraElearningWindow,
    TraCyberUpload,
)

DEV_EMPLOYEE_TOTAL = 6000
DEV_EMPLOYEE_LOGIN_PREFIX = "kr-"
DEV_EMPLOYEE_PASSWORD_HASH = hash_password("admin")
PRIMARY_DEPARTMENT_CODE = "HQ-HR"

KOREAN_SURNAMES = [
    "\uAE40",
    "\uC774",
    "\uBC15",
    "\uCD5C",
    "\uC815",
    "\uAC15",
    "\uC870",
    "\uC724",
    "\uC7A5",
    "\uC784",
    "\uC624",
    "\uD55C",
    "\uC11C",
    "\uC2E0",
    "\uAD8C",
    "\uD669",
    "\uC548",
    "\uC1A1",
    "\uB958",
    "\uC804",
]
KOREAN_GIVEN_FIRST = [
    "\uBBFC",
    "\uC11C",
    "\uC9C0",
    "\uC218",
    "\uC608",
    "\uD604",
    "\uC720",
    "\uC6B0",
    "\uC900",
    "\uD558",
    "\uC815",
    "\uC740",
    "\uC601",
    "\uB3D9",
    "\uC131",
    "\uC7AC",
    "\uC9C4",
    "\uD0DC",
    "\uC9C4",
    "\uC5F0",
]
KOREAN_GIVEN_SECOND = [
    "\uC900",
    "\uC544",
    "\uD76C",
    "\uC5F0",
    "\uD604",
    "\uC6B0",
    "\uD6C8",
    "\uC11D",
    "\uB9BC",
    "\uC11D",
    "\uC6D0",
    "\uB9AC",
    "\uC740",
    "\uB0A8",
    "\uC120",
    "\uBE48",
    "\uC601",
    "\uC548",
    "\uBBFC",
    "\uD658",
]

KOREAN_POSITION_TITLES = [
    "\uC0AC\uC6D0",
    "\uB300\uB9AC",
    "\uACFC\uC7A5",
    "\uCC28\uC7A5",
    "\uBD80\uC7A5",
]

DEPARTMENT_SEEDS = [
    {
        "code": "HQ-HR",
        "name": "\uC778\uC0AC\uBCF8\uBD80",
        "organization_type": "HEADQUARTERS",
        "cost_center_code": "CC-HR-001",
        "description": "\uC778\uC0AC \uC815\uCC45, \uBC1C\uB839, \uD3C9\uAC00, \uAE09\uC5EC \uAE30\uC900 \uC6B4\uC601",
    },
    {
        "code": "HQ-ENG",
        "name": "\uAC1C\uBC1C\uBCF8\uBD80",
        "organization_type": "HEADQUARTERS",
        "cost_center_code": "CC-ENG-001",
        "description": "\uC81C\uD488 \uAC1C\uBC1C, \uD50C\uB7AB\uD3FC \uAC1C\uC120, \uAE30\uC220 \uC6B4\uC601",
    },
    {
        "code": "HQ-SALES",
        "name": "\uC601\uC5C5\uBCF8\uBD80",
        "organization_type": "HEADQUARTERS",
        "cost_center_code": "CC-SALES-001",
        "description": "\uC601\uC5C5 \uC804\uB7B5, \uACE0\uAC1D \uBC1C\uAD74, \uC218\uC8FC \uAD00\uB9AC",
    },
    {
        "code": "HQ-FIN",
        "name": "\uC7AC\uBB34\uBCF8\uBD80",
        "organization_type": "HEADQUARTERS",
        "cost_center_code": "CC-FIN-001",
        "description": "\uD68C\uACC4, \uC790\uAE08, \uC608\uC0B0, \uACB0\uC0B0 \uAD00\uB9AC",
    },
    {
        "code": "HQ-OPS",
        "name": "\uC6B4\uC601\uBCF8\uBD80",
        "organization_type": "HEADQUARTERS",
        "cost_center_code": "CC-OPS-001",
        "description": "\uC6B4\uC601 \uD45C\uC900, \uC9C0\uC6D0 \uD504\uB85C\uC138\uC2A4, \uD604\uC7A5 \uC6B4\uC601",
    },
    *[
        {
            "code": f"ORG-{index:04d}",
            "name": f"\uC870\uC9C1{index:02d}",
            "organization_type": "TEAM",
            "cost_center_code": f"CC-ORG-{index:04d}",
            "description": f"\uC0D8\uD50C \uC870\uC9C1 {index:02d} \uC6B4\uC601 \uB2E8\uC704",
        }
        for index in range(1, 46)
    ],
]

CORPORATION_SEEDS = [
    {
        "enter_cd": "VIBE",
        "company_code": "VIBE",
        "corporation_name": "VIBE-HR",
        "corporation_number": "110111-1234567",
        "business_number": "123-45-67890",
        "company_seal_url": None,
        "certificate_seal_url": None,
        "company_logo_url": "/vibehr_mark.svg",
        "is_active": True,
    },
]

WEL_BENEFIT_TYPE_SEEDS = [
    {"code": "SCHOLARSHIP", "name": "학자금", "module_path": "/wel/scholarship", "is_deduction": False, "pay_item_code": "SCHOLARSHIP_GRANT", "sort_order": 10},
    {"code": "CONDOLENCE", "name": "경조금", "module_path": "/wel/condolence", "is_deduction": False, "pay_item_code": "CONDOLENCE_GRANT", "sort_order": 20},
    {"code": "MEDICAL", "name": "의료비", "module_path": "/wel/medical", "is_deduction": False, "pay_item_code": "MEDICAL_GRANT", "sort_order": 30},
    {"code": "LOAN", "name": "사내대출", "module_path": "/wel/loan", "is_deduction": True, "pay_item_code": "LOAN_REPAY", "sort_order": 40},
    {"code": "PENSION", "name": "개인연금", "module_path": "/wel/pension", "is_deduction": True, "pay_item_code": "PENSION_DEDUCT", "sort_order": 50},
    {"code": "RESORT", "name": "리조트", "module_path": "/wel/resort", "is_deduction": False, "pay_item_code": None, "sort_order": 60},
    {"code": "CLUB", "name": "동호회", "module_path": "/wel/club", "is_deduction": True, "pay_item_code": "CLUB_DEDUCT", "sort_order": 70},
    {"code": "HEALTH_CHECK", "name": "건강검진", "module_path": "/wel/health-check", "is_deduction": False, "pay_item_code": None, "sort_order": 80},
]

WEL_BENEFIT_REQUEST_SEEDS = [
    {
        "request_no": "WEL-202603-001",
        "benefit_type_code": "SCHOLARSHIP",
        "benefit_type_name": "\uD559\uC790\uAE08",
        "employee_no": "HR-0001",
        "employee_name": "\uAD00\uB9AC\uC790",
        "department_name": "\uC778\uC0AC\uCD1D\uAD04",
        "status_code": "payroll_reflected",
        "requested_amount": 1500000,
        "approved_amount": 1500000,
        "payroll_run_label": "2026-03 \uC815\uAE30\uAE09\uC5EC",
        "description": "\uC790\uB140 1\uD559\uAE30 \uB4F1\uB85D\uAE08 \uC9C0\uC6D0",
        "requested_at": datetime(2026, 3, 4, 9, 0),
        "approved_at": datetime(2026, 3, 5, 11, 30),
    },
    {
        "request_no": "WEL-202603-002",
        "benefit_type_code": "CONDOLENCE",
        "benefit_type_name": "\uACBD\uC870\uAE08",
        "employee_no": "HR-0142",
        "employee_name": "\uC774\uC11C\uC900",
        "department_name": "\uACBD\uC601\uC9C0\uC6D0\uD300",
        "status_code": "submitted",
        "requested_amount": 500000,
        "approved_amount": None,
        "payroll_run_label": None,
        "description": "\uAC00\uC871 \uACBD\uC870 \uC99D\uBE59 \uC811\uC218 \uD6C4 \uC778\uC0AC \uAC80\uD1A0 \uB300\uAE30",
        "requested_at": datetime(2026, 3, 8, 14, 10),
        "approved_at": None,
    },
    {
        "request_no": "WEL-202603-003",
        "benefit_type_code": "LOAN",
        "benefit_type_name": "\uC0AC\uB0B4\uB300\uCD9C",
        "employee_no": "HR-0098",
        "employee_name": "\uBC15\uC9C0\uD6C8",
        "department_name": "\uAC1C\uBC1C\uC6B41\uD300",
        "status_code": "approved",
        "requested_amount": 3000000,
        "approved_amount": 3000000,
        "payroll_run_label": "2026-04 \uACF5\uC81C \uC608\uC815",
        "description": "\uC0AC\uB0B4\uB300\uCD9C \uC2B9\uC778 \uD6C4 4\uC6D4 \uAE09\uC5EC \uBD84\uBD80\uD130 \uC0C1\uD658 \uC2DC\uC791",
        "requested_at": datetime(2026, 3, 9, 10, 20),
        "approved_at": datetime(2026, 3, 10, 16, 0),
    },
    {
        "request_no": "WEL-202603-004",
        "benefit_type_code": "MEDICAL",
        "benefit_type_name": "\uC758\uB8CC\uBE44",
        "employee_no": "HR-0215",
        "employee_name": "\uCD5C\uC720\uC9C4",
        "department_name": "\uC0DD\uC0B0\uAD00\uB9AC\uD300",
        "status_code": "rejected",
        "requested_amount": 320000,
        "approved_amount": None,
        "payroll_run_label": None,
        "description": "\uC99D\uBE59 \uBCF4\uC644 \uD544\uC694\uB85C \uBC18\uB824",
        "requested_at": datetime(2026, 3, 6, 15, 40),
        "approved_at": datetime(2026, 3, 7, 13, 15),
    },
    {
        "request_no": "WEL-202603-005",
        "benefit_type_code": "RESORT",
        "benefit_type_name": "\uB9AC\uC870\uD2B8",
        "employee_no": "HR-0312",
        "employee_name": "\uC724\uD558\uB9BC",
        "department_name": "\uC601\uC5C5\uC9C0\uC6D0\uD300",
        "status_code": "draft",
        "requested_amount": 200000,
        "approved_amount": None,
        "payroll_run_label": None,
        "description": "\uD558\uACC4 \uB9AC\uC870\uD2B8 \uC774\uC6A9 \uC2E0\uCCAD\uC11C \uC791\uC131 \uC911",
        "requested_at": datetime(2026, 3, 11, 18, 5),
        "approved_at": None,
    },
]

TRA_ORGANIZATION_SEEDS = [
    {"code": "TRORG00001", "name": "Vibe Academy", "business_no": "123-45-67890"},
    {"code": "TRORG00002", "name": "External Learning Lab", "business_no": "222-22-22222"},
]

TRA_COURSE_SEEDS = [
    {
        "course_code": "TRAC00001",
        "course_name": "신입사원 필수 온보딩",
        "in_out_type": "INTERNAL",
        "method_code": "OFFLINE",
        "status_code": "open",
        "mandatory_yn": True,
        "edu_level": "A",
        "organization_code": "TRORG00001",
    },
    {
        "course_code": "TRAC00002",
        "course_name": "직무 심화 이러닝",
        "in_out_type": "EXTERNAL",
        "method_code": "ONLINE",
        "status_code": "open",
        "mandatory_yn": False,
        "edu_level": "B",
        "organization_code": "TRORG00002",
    },
]

HR_RETIRE_CHECKLIST_SEEDS: list[tuple[str, str, bool, int, str]] = [
    ("asset_return", "회사 자산 반납", True, 10, "노트북/출입카드 등 지급 자산 반납"),
    ("document_handover", "업무 인수인계 완료", True, 20, "담당 업무 및 문서 인수인계"),
    ("account_close", "계정/권한 회수", True, 30, "내부 시스템 계정 및 권한 회수"),
    ("expense_settlement", "비용 정산 완료", False, 40, "법인카드/개인비용 정산"),
]

MENU_TREE: list[dict] = [
    {
        "code": "dashboard",
        "name": "대시보드",
        "path": "/dashboard",
        "icon": "LayoutDashboard",
        "sort_order": 100,
        "roles": ["employee", "hr_manager", "payroll_mgr", "admin"],
        "children": [],
    },
    {
        "code": "hr",
        "name": "인사",
        "path": None,
        "icon": "UsersRound",
        "sort_order": 200,
        "roles": ["hr_manager", "admin"],
        "children": [
            {
                "code": "hr.info",
                "name": "인사정보",
                "path": None,
                "icon": "UserRound",
                "sort_order": 201,
                "roles": ["hr_manager", "admin"],
                "children": [
                    {
                        "code": "hr.basic",
                        "name": "인사기본",
                        "path": "/hr/basic",
                        "icon": "UserRound",
                        "sort_order": 202,
                        "roles": ["hr_manager", "admin"],
                    },
                    {
                        "code": "hr.employee",
                        "name": "사원관리",
                        "path": "/hr/employee",
                        "icon": "UserRound",
                        "sort_order": 203,
                        "roles": ["hr_manager", "admin"],
                    },
                ],
            },
            {
                "code": "hr.recruit",
                "name": "채용관리",
                "path": None,
                "icon": "UserRound",
                "sort_order": 204,
                "roles": ["hr_manager", "admin"],
                "children": [
                    {
                        "code": "hr.recruit.finalists",
                        "name": "채용합격자등록",
                        "path": "/hr/recruit/finalists",
                        "icon": "UserRound",
                        "sort_order": 205,
                        "roles": ["hr_manager", "admin"],
                    },
                ],
            },
            {
                "code": "hr.appointment",
                "name": "\uBC1C\uB839\uAD00\uB9AC",
                "path": None,
                "icon": "FileText",
                "sort_order": 210,
                "roles": ["hr_manager", "admin"],
                "children": [
                    {"code": "hr.appointment.codes", "name": "\uBC1C\uB839\uCF54\uB4DC\uAD00\uB9AC", "path": "/hr/appointment/codes", "icon": "ListOrdered", "sort_order": 211, "roles": ["hr_manager", "admin"]},
                    {"code": "hr.appointment.records", "name": "\uBC1C\uB839\uCC98\uB9AC\uAD00\uB9AC", "path": "/hr/appointment/records", "icon": "UserRound", "sort_order": 212, "roles": ["hr_manager", "admin"]}
                ],
            },
            {
                "code": "hr.admin",
                "name": "\uC778\uC0AC\uAD00\uB9AC",
                "path": None,
                "icon": "UsersRound",
                "sort_order": 220,
                "roles": ["hr_manager", "admin"],
                "children": [
                    {"code": "hr.admin.rewards", "name": "\uC0C1\uBC8C\uAD00\uB9AC", "path": "/hr/admin/rewards", "icon": "UserRound", "sort_order": 221, "roles": ["hr_manager", "admin"]},
                    {"code": "hr.admin.contacts", "name": "\uC8FC\uC18C\uC5F0\uB77D\uCC98\uAD00\uB9AC", "path": "/hr/admin/contacts", "icon": "UserRound", "sort_order": 222, "roles": ["hr_manager", "admin"]},
                    {"code": "hr.admin.educations", "name": "\uD559\uB825\uAD00\uB9AC", "path": "/hr/admin/educations", "icon": "UserRound", "sort_order": 223, "roles": ["hr_manager", "admin"]},
                    {"code": "hr.admin.careers", "name": "\uACBD\uB825\uAD00\uB9AC", "path": "/hr/admin/careers", "icon": "UserRound", "sort_order": 224, "roles": ["hr_manager", "admin"]},
                    {"code": "hr.admin.certificates", "name": "\uC790\uACA9\uC99D\uAD00\uB9AC", "path": "/hr/admin/certificates", "icon": "UserRound", "sort_order": 225, "roles": ["hr_manager", "admin"]},
                    {"code": "hr.admin.military", "name": "\uBCD1\uC5ED\uAD00\uB9AC", "path": "/hr/admin/military", "icon": "UserRound", "sort_order": 226, "roles": ["hr_manager", "admin"]},
                    {"code": "hr.admin.evaluations", "name": "\uC778\uC0AC\uD3C9\uAC00\uAD00\uB9AC", "path": "/hr/admin/evaluations", "icon": "UserRound", "sort_order": 227, "roles": ["hr_manager", "admin"]}
                ],
            },
            {
                "code": "hr.retire",
                "name": "\uD1F4\uC9C1\uAD00\uB9AC",
                "path": None,
                "icon": "FileText",
                "sort_order": 230,
                "roles": ["hr_manager", "admin"],
                "children": [
                    {
                        "code": "hr.retire.checklist",
                        "name": "\uD1F4\uC9C1\uCCB4\uD06C\uB9AC\uC2A4\uD2B8",
                        "path": "/hr/retire/checklist",
                        "icon": "ListOrdered",
                        "sort_order": 231,
                        "roles": ["hr_manager", "admin"],
                    },
                    {
                        "code": "hr.retire.approvals",
                        "name": "\uD1F4\uC9C1\uC2B9\uC778\uAD00\uB9AC",
                        "path": "/hr/retire/approvals",
                        "icon": "FileText",
                        "sort_order": 232,
                        "roles": ["hr_manager", "admin"],
                    },
                ],
            },
        ],
    },
    {
        "code": "pap",
        "name": "\uC131\uACFC\uAD00\uB9AC",
        "path": None,
        "icon": "FileText",
        "sort_order": 250,
        "roles": ["hr_manager", "admin"],
        "children": [
            {
                "code": "pap.appraisals",
                "name": "\uD3C9\uAC00\uAE30\uC900\uAD00\uB9AC",
                "path": "/pap/appraisals",
                "icon": "ListOrdered",
                "sort_order": 251,
                "roles": ["hr_manager", "admin"],
            },
            {
                "code": "pap.final-results",
                "name": "\uCD5C\uC885\uB4F1\uAE09\uAD00\uB9AC",
                "path": "/pap/final-results",
                "icon": "Award",
                "sort_order": 252,
                "roles": ["hr_manager", "admin"],
            },
        ],
    },
    {
        "code": "org",
        "name": "조직",
        "path": None,
        "icon": "Building2",
        "sort_order": 300,
        "roles": ["hr_manager", "admin"],
        "children": [
            {
                "code": "org.manage",
                "name": "조직관리",
                "path": None,
                "icon": "FolderTree",
                "sort_order": 301,
                "roles": ["hr_manager", "admin"],
                "children": [
                    {"code": "org.corporations", "name": "법인관리", "path": "/org/corporations", "icon": "Building2", "sort_order": 302, "roles": ["hr_manager", "admin"]},
                    {"code": "org.departments", "name": "조직코드관리", "path": "/org/departments", "icon": "FolderTree", "sort_order": 303, "roles": ["hr_manager", "admin"]},
                    {"code": "org.chart", "name": "조직도관리", "path": "/org/chart", "icon": "FolderTree", "sort_order": 304, "roles": ["hr_manager", "admin"]},
                    {"code": "org.types", "name": "조직구분", "path": "/org/types", "icon": "FolderTree", "sort_order": 305, "roles": ["hr_manager", "admin"]},
                    {"code": "org.type-items", "name": "조직구분항목", "path": "/org/type-items", "icon": "FolderTree", "sort_order": 306, "roles": ["hr_manager", "admin"]},
                    {"code": "org.type-upload", "name": "조직구분업로드", "path": "/org/type-upload", "icon": "FolderTree", "sort_order": 307, "roles": ["hr_manager", "admin"]},
                    {"code": "org.type-personal-status", "name": "조직구분개인별현황", "path": "/org/type-personal-status", "icon": "FolderTree", "sort_order": 308, "roles": ["hr_manager", "admin"]}
                ],
            },
        ],
    },
    {
        "code": "tim",
        "name": "근태",
        "path": None,
        "icon": "Clock",
        "sort_order": 400,
        "roles": ["employee", "hr_manager", "admin"],
        "children": [
            {
                "code": "tim.base",
                "name": "근태기준관리",
                "path": None,
                "icon": "CalendarCheck2",
                "sort_order": 401,
                "roles": ["hr_manager", "admin"],
                "children": [
                    {"code": "tim.holidays", "name": "공휴일관리", "path": "/tim/holidays", "icon": "CalendarDays", "sort_order": 402, "roles": ["hr_manager", "admin"]},
                    {"code": "tim.codes", "name": "근태코드관리", "path": "/tim/codes", "icon": "CalendarCheck2", "sort_order": 403, "roles": ["hr_manager", "admin"]},
                    {"code": "tim.work-codes", "name": "근무코드관리", "path": "/tim/work-codes", "icon": "Clock", "sort_order": 404, "roles": ["hr_manager", "admin"]}
                ],
            },
            {
                "code": "tim.daily",
                "name": "일상근태",
                "path": None,
                "icon": "Clock",
                "sort_order": 410,
                "roles": ["employee", "hr_manager", "admin"],
                "children": [
                    {"code": "tim.check-in", "name": "출퇴근기록", "path": "/tim/check-in", "icon": "CalendarCheck2", "sort_order": 411, "roles": ["employee", "hr_manager", "admin"]},
                    {"code": "tim.status", "name": "근태현황", "path": "/tim/status", "icon": "ListOrdered", "sort_order": 412, "roles": ["hr_manager", "admin"]},
                    {"code": "tim.correction", "name": "근태수정", "path": "/tim/correction", "icon": "CalendarDays", "sort_order": 413, "roles": ["hr_manager", "admin"]}
                ],
            },
            {
                "code": "tim.leave",
                "name": "휴가관리",
                "path": None,
                "icon": "CalendarDays",
                "sort_order": 420,
                "roles": ["employee", "hr_manager", "admin"],
                "children": [
                    {"code": "tim.annual-leave", "name": "연차관리", "path": "/tim/annual-leave", "icon": "CalendarDays", "sort_order": 421, "roles": ["employee", "hr_manager", "admin"]},
                    {"code": "tim.leave-request", "name": "휴가신청", "path": "/tim/leave-request", "icon": "CalendarCheck2", "sort_order": 422, "roles": ["employee", "hr_manager", "admin"]},
                    {"code": "tim.leave-approval", "name": "휴가승인", "path": "/tim/leave-approval", "icon": "ListOrdered", "sort_order": 423, "roles": ["hr_manager", "admin"]}
                ],
            },
            {
                "code": "tim.reports",
                "name": "근태리포트",
                "path": "/tim/reports",
                "icon": "FileText",
                "sort_order": 430,
                "roles": ["hr_manager", "admin"],
                "children": [],
            },
        ],
    },
    {
        "code": "hri",
        "name": "신청서",
        "path": None,
        "icon": "FileText",
        "sort_order": 450,
        "roles": ["employee", "hr_manager", "admin"],
        "children": [
            {
                "code": "hri.requests",
                "name": "내 문서",
                "path": None,
                "icon": "ListOrdered",
                "sort_order": 451,
                "roles": ["employee", "hr_manager", "admin"],
                "children": [
                    {"code": "hri.requests.mine", "name": "내 신청서", "path": "/hri/requests/mine", "icon": "FileText", "sort_order": 452, "roles": ["employee", "hr_manager", "admin"]},
                    {"code": "hri.tasks.approvals", "name": "결재함", "path": "/hri/tasks/approvals", "icon": "ListOrdered", "sort_order": 453, "roles": ["employee", "hr_manager", "admin"]},
                    {"code": "hri.tasks.receives", "name": "수신함", "path": "/hri/tasks/receives", "icon": "ListOrdered", "sort_order": 454, "roles": ["employee", "hr_manager", "admin"]},
                ],
            },
            {
                "code": "hri.admin",
                "name": "신청서관리",
                "path": None,
                "icon": "Settings",
                "sort_order": 460,
                "roles": ["hr_manager", "admin"],
                "children": [
                    {"code": "hri.admin.form-types", "name": "신청서코드관리", "path": "/hri/admin/form-types", "icon": "ListOrdered", "sort_order": 461, "roles": ["hr_manager", "admin"]},
                    {"code": "hri.admin.approval-lines", "name": "결재선관리", "path": "/hri/admin/approval-lines", "icon": "ListOrdered", "sort_order": 462, "roles": ["hr_manager", "admin"]},
                ],
            },
        ],
    },
    {
        "code": "payroll",
        "name": "급여",
        "path": None,
        "icon": "Wallet",
        "sort_order": 500,
        "roles": ["payroll_mgr", "admin"],
        "children": [
            {
                "code": "payroll.base",
                "name": "급여기준관리",
                "path": None,
                "icon": "Calculator",
                "sort_order": 501,
                "roles": ["payroll_mgr", "admin"],
                "children": [
                    {"code": "payroll.allowance-deduction-items", "name": "수당공제항목관리", "path": "/payroll/allowance-deduction-items", "icon": "Calculator", "sort_order": 502, "roles": ["payroll_mgr", "admin"]},
                    {"code": "payroll.item-groups", "name": "항목그룹관리", "path": "/payroll/item-groups", "icon": "Calculator", "sort_order": 503, "roles": ["payroll_mgr", "admin"]},
                    {"code": "payroll.codes", "name": "급여코드관리", "path": "/payroll/codes", "icon": "Calculator", "sort_order": 504, "roles": ["payroll_mgr", "admin"]},
                    {"code": "payroll.tax-rates", "name": "세율및사회보험관리", "path": "/payroll/tax-rates", "icon": "Calculator", "sort_order": 505, "roles": ["payroll_mgr", "admin"]},
                    {"code": "payroll.payment-schedules", "name": "월급여일자관리", "path": "/payroll/payment-schedules", "icon": "CalendarDays", "sort_order": 506, "roles": ["payroll_mgr", "admin"]},
                    {"code": "payroll.employee-profiles", "name": "직원급여프로필관리", "path": "/payroll/employee-profiles", "icon": "Users", "sort_order": 507, "roles": ["payroll_mgr", "admin"]}
                ],
            },
            {
                "code": "payroll.process",
                "name": "급여실행관리",
                "path": None,
                "icon": "Wallet",
                "sort_order": 510,
                "roles": ["payroll_mgr", "admin"],
                "children": [
                    {"code": "payroll.variable-inputs", "name": "월변동입력관리", "path": "/payroll/variable-inputs", "icon": "NotebookPen", "sort_order": 511, "roles": ["payroll_mgr", "admin"]},
                    {"code": "payroll.runs", "name": "월급여Run관리", "path": "/payroll/runs", "icon": "PlayCircle", "sort_order": 512, "roles": ["payroll_mgr", "admin"]}
                ],
            },
        ],
    },
    {
        "code": "tra",
        "name": "교육",
        "path": None,
        "icon": "FileText",
        "sort_order": 600,
        "roles": ["employee", "hr_manager", "admin"],
        "children": [
            {"code": "tra.course-events", "name": "과정/차수 관리", "path": "/tra/course-events", "icon": "ListOrdered", "sort_order": 601, "roles": ["employee", "hr_manager", "admin"]},
            {"code": "tra.applications", "name": "교육신청 관리", "path": "/tra/applications", "icon": "ListOrdered", "sort_order": 602, "roles": ["employee", "hr_manager", "admin"]},
            {"code": "tra.required-standards", "name": "필수교육 기준", "path": "/tra/required-standards", "icon": "ListOrdered", "sort_order": 603, "roles": ["employee", "hr_manager", "admin"]},
            {"code": "tra.required-targets", "name": "필수교육 대상", "path": "/tra/required-targets", "icon": "ListOrdered", "sort_order": 604, "roles": ["employee", "hr_manager", "admin"]},
            {"code": "tra.elearning-windows", "name": "이러닝 기간", "path": "/tra/elearning-windows", "icon": "ListOrdered", "sort_order": 605, "roles": ["employee", "hr_manager", "admin"]},
            {"code": "tra.histories", "name": "교육이력 관리", "path": "/tra/histories", "icon": "ListOrdered", "sort_order": 606, "roles": ["employee", "hr_manager", "admin"]},
            {"code": "tra.cyber-upload", "name": "사이버 업로드 반영", "path": "/tra/cyber-upload", "icon": "ListOrdered", "sort_order": 607, "roles": ["employee", "hr_manager", "admin"]},
        ],
    },
    {
        "code": "wel",
        "name": "복리후생",
        "path": None,
        "icon": "HeartHandshake",
        "sort_order": 650,
        "roles": ["hr_manager", "payroll_mgr", "admin"],
        "children": [
            {"code": "wel.benefit-types", "name": "복리후생 유형관리", "path": "/wel/benefit-types", "icon": "Gift", "sort_order": 651, "roles": ["hr_manager", "payroll_mgr", "admin"]},
        ],
    },
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
    },
    {
        "code": "settings",
        "name": "시스템",
        "path": None,
        "icon": "Settings",
        "sort_order": 900,
        "roles": ["admin"],
        "children": [
            {
                "code": "settings.base",
                "name": "시스템기준관리",
                "path": None,
                "icon": "Settings",
                "sort_order": 901,
                "roles": ["admin"],
                "children": [
                    {"code": "settings.menus", "name": "메뉴관리", "path": "/settings/menus", "icon": "PanelLeft", "sort_order": 902, "roles": ["admin"]},
                    {"code": "settings.common-codes", "name": "공통코드관리", "path": "/settings/common-codes", "icon": "ListOrdered", "sort_order": 903, "roles": ["admin"]},
                    {"code": "settings.icons", "name": "아이콘관리", "path": "/settings/icons", "icon": "ListPlus", "sort_order": 904, "roles": ["admin"]},
                    {"code": "settings.system", "name": "시스템기준관리", "path": "/settings/system", "icon": "Settings", "sort_order": 905, "roles": ["admin"]}
                ],
            },
            {
                "code": "settings.auth",
                "name": "권한",
                "path": None,
                "icon": "Shield",
                "sort_order": 910,
                "roles": ["admin"],
                "children": [
                    {"code": "settings.roles", "name": "권한관리", "path": "/settings/roles", "icon": "Shield", "sort_order": 911, "roles": ["admin"]},
                    {"code": "settings.permissions", "name": "메뉴권한관리", "path": "/settings/permissions", "icon": "Menu", "sort_order": 912, "roles": ["admin"]},
                    {"code": "settings.users", "name": "사용자관리", "path": "/settings/users", "icon": "UserRound", "sort_order": 913, "roles": ["admin"]}
                ],
            },
        ],
    },
]

STANDARD_MENU_ACTION_CODES: tuple[str, ...] = (
    "query",
    "create",
    "copy",
    "template_download",
    "upload",
    "save",
    "download",
)


COMMON_CODE_GROUP_SEEDS = [
    ("POSITION", "직위", "직위 구분", 1),
    ("RANK", "직급", "직급 구분", 2),
    ("JOB_GROUP", "직군", "직군 구분", 3),
    ("SALARY_TYPE", "연봉타입", "연봉 유형", 4),
    ("ORG_TYPE", "조직유형", "조직 유형 구분", 5),
    # ── MNG 관리 모듈 공통코드 ──
    ("MNG_DEV_STATUS", "개발진행상태", "추가개발 진행상태 구분", 100),
    ("MNG_PART", "파트구분", "개발 파트 구분", 101),
    ("MNG_APPROVAL_STATUS", "승인상태", "승인/반려 상태 구분", 102),
    ("MNG_ATTEND_TYPE", "외주근태종류", "외주인력 근태 종류", 103),
    ("MNG_ATTEND_STATUS", "외주근태상태", "외주인력 근태 상태", 104),
    ("MNG_INQUIRY_STATUS", "문의진행상태", "추가개발 문의 진행상태", 105),
    ("MNG_INSPECTION", "검수상태", "검수 완료 여부", 106),
    ("MNG_SERVICE_TYPE", "서비스구분", "인프라 서비스 구분", 107),
    ("HR_APPOINTMENT_CODE", "발령코드", "발령처리 코드", 120),
]

COMMON_CODE_ITEM_SEEDS = {
    "POSITION": [
        ("01", "사원", 1),
        ("02", "대리", 2),
        ("03", "과장", 3),
        ("04", "차장", 4),
        ("05", "부장", 5),
        ("06", "이사", 6),
    ],
    # ── MNG 관리 모듈 코드 항목 ──
    "MNG_DEV_STATUS": [
        ("접수", "접수", 1),
        ("검토", "검토", 2),
        ("진행", "진행중", 3),
        ("완료", "완료", 4),
        ("보류", "보류", 5),
        ("취소", "취소", 6),
    ],
    "MNG_PART": [
        ("SI", "SI파트", 1),
        ("SM", "SM파트", 2),
        ("SOL", "솔루션파트", 3),
        ("INFRA", "인프라파트", 4),
    ],
    "MNG_APPROVAL_STATUS": [
        ("신청", "신청", 1),
        ("승인", "승인", 2),
        ("반려", "반려", 3),
    ],
    "MNG_ATTEND_TYPE": [
        ("연차", "연차", 1),
        ("반차", "반차(오전)", 2),
        ("반차PM", "반차(오후)", 3),
        ("병가", "병가", 4),
        ("경조", "경조휴가", 5),
        ("기타", "기타", 6),
    ],
    "MNG_ATTEND_STATUS": [
        ("신청", "신청", 1),
        ("승인", "승인", 2),
        ("반려", "반려", 3),
    ],
    "MNG_INQUIRY_STATUS": [
        ("접수", "접수", 1),
        ("검토", "검토중", 2),
        ("견적", "견적진행", 3),
        ("확정", "확정", 4),
        ("보류", "보류", 5),
        ("취소", "취소", 6),
    ],
    "MNG_INSPECTION": [
        ("미검수", "미검수", 1),
        ("검수완료", "검수완료", 2),
    ],
    "MNG_SERVICE_TYPE": [
        ("ERP", "ERP", 1),
        ("MES", "MES", 2),
        ("WMS", "WMS", 3),
        ("GROUPWARE", "그룹웨어", 4),
        ("PORTAL", "포털", 5),
        ("ETC", "기타", 6),
    ],
    "HR_APPOINTMENT_CODE": [
        ("NEW_HIRE", "신규채용", 1),
        ("CAREER_HIRE", "경력채용", 2),
        ("RESIGNATION", "퇴사", 3),
        ("JOB_FAMILY_CHANGE", "직군변경", 4),
        ("DEPT_TRANSFER", "부서이동", 5),
        ("SUSPENSION", "정직", 6),
        ("LEAVE_OF_ABSENCE", "휴직", 7),
        ("PROMOTION", "승진", 8),
        ("DEMOTION", "강등", 9),
        ("REINSTATEMENT", "복직", 10),
    ],
}


def ensure_auth_user_login_id_schema(session: Session) -> None:
    columns = session.exec(
        text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'auth_users'
            """
        )
    ).all()
    column_names = {row[0] for row in columns}

    if "login_id" not in column_names:
        session.exec(text("ALTER TABLE auth_users ADD COLUMN login_id TEXT"))
        session.commit()

    session.exec(
        text(
            """
            UPDATE auth_users
            SET login_id = 'user-' || id
            WHERE login_id IS NULL OR TRIM(login_id) = ''
            """
        )
    )
    session.exec(
        text(
            """
            UPDATE auth_users
            SET login_id = 'admin-local'
            WHERE email = 'admin@vibe-hr.local'
            """
        )
    )
    session.exec(text("CREATE UNIQUE INDEX IF NOT EXISTS ux_auth_users_login_id ON auth_users (login_id)"))
    session.commit()


def ensure_roles(session: Session) -> None:
    role_map = {
        "admin": "\uAD00\uB9AC\uC790",
        "hr_manager": "\uC778\uC0AC\uB2F4\uB2F9\uC790",
        "payroll_mgr": "\uAE09\uC5EC\uB2F4\uB2F9\uC790",
        "employee": "\uC77C\uBC18\uC9C1\uC6D0",
    }
    for code, name in role_map.items():
        existing_role = session.exec(select(AuthRole).where(AuthRole.code == code)).first()
        if existing_role is None:
            session.add(AuthRole(code=code, name=name))
    session.commit()


def ensure_departments(session: Session) -> list[OrgDepartment]:
    departments: list[OrgDepartment] = []
    for seed in DEPARTMENT_SEEDS:
        code = seed["code"]
        department = session.exec(select(OrgDepartment).where(OrgDepartment.code == code)).first()
        if department is None:
            department = OrgDepartment(
                code=code,
                name=seed["name"],
                organization_type=seed["organization_type"],
                cost_center_code=seed["cost_center_code"],
                description=seed["description"],
                is_active=True,
            )
            session.add(department)
            session.commit()
            session.refresh(department)
        else:
            changed = False
            if department.name != seed["name"]:
                department.name = seed["name"]
                changed = True
            if department.organization_type != seed["organization_type"]:
                department.organization_type = seed["organization_type"]
                changed = True
            if department.cost_center_code != seed["cost_center_code"]:
                department.cost_center_code = seed["cost_center_code"]
                changed = True
            if department.description != seed["description"]:
                department.description = seed["description"]
                changed = True
            if not department.is_active:
                department.is_active = True
                changed = True
            if changed:
                session.add(department)
                session.commit()
                session.refresh(department)
        departments.append(department)
    return departments


def ensure_corporations(session: Session) -> list[OrgCorporation]:
    corporations: list[OrgCorporation] = []
    for seed in CORPORATION_SEEDS:
        corporation = session.exec(
            select(OrgCorporation).where(OrgCorporation.enter_cd == seed["enter_cd"])
        ).first()
        if corporation is None:
            corporation = OrgCorporation(**seed)
            session.add(corporation)
            session.commit()
            session.refresh(corporation)
        else:
            changed = False
            for key, value in seed.items():
                if getattr(corporation, key) != value:
                    setattr(corporation, key, value)
                    changed = True
            if changed:
                session.add(corporation)
                session.commit()
                session.refresh(corporation)
        corporations.append(corporation)
    return corporations


def ensure_department(session: Session) -> OrgDepartment:
    departments = ensure_departments(session)
    for department in departments:
        if department.code == PRIMARY_DEPARTMENT_CODE:
            return department
    return departments[0]


def ensure_user(
    session: Session,
    *,
    login_id: str,
    email: str,
    password: str,
    display_name: str,
    reset_password: bool = False,
) -> AuthUser:
    user = session.exec(select(AuthUser).where(AuthUser.login_id == login_id)).first()
    if user is None:
        user = AuthUser(
            login_id=login_id,
            email=email,
            password_hash=hash_password(password),
            display_name=display_name,
            is_active=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user

    changed = False
    if user.email != email:
        user.email = email
        changed = True
    if user.display_name != display_name:
        user.display_name = display_name
        changed = True
    if reset_password:
        user.password_hash = hash_password(password)
        changed = True
    if not user.is_active:
        user.is_active = True
        changed = True
    if changed:
        session.add(user)
        session.commit()
        session.refresh(user)

    return user


def ensure_user_roles(session: Session, user: AuthUser, role_codes: list[str]) -> None:
    roles = session.exec(select(AuthRole).where(AuthRole.code.in_(role_codes))).all()
    role_map = {role.code: role for role in roles}
    links = session.exec(select(AuthUserRole).where(AuthUserRole.user_id == user.id)).all()
    linked_role_ids = {link.role_id for link in links}

    for code in role_codes:
        role = role_map.get(code)
        if role and role.id not in linked_role_ids:
            session.add(AuthUserRole(user_id=user.id, role_id=role.id))
    session.commit()


def ensure_employee(
    session: Session,
    *,
    user: AuthUser,
    employee_no: str,
    department_id: int,
    position_title: str,
) -> HrEmployee:
    employee = session.exec(select(HrEmployee).where(HrEmployee.user_id == user.id)).first()
    if employee is None:
        employee = HrEmployee(
            user_id=user.id,
            employee_no=employee_no,
            department_id=department_id,
            position_title=position_title,
            hire_date=date(2024, 1, 1),
            employment_status="active",
        )
        session.add(employee)
        session.commit()
        session.refresh(employee)
    return employee


def _build_korean_name(index: int) -> str:
    rng = random.Random(20260219 + index * 97)
    surname = KOREAN_SURNAMES[rng.randrange(len(KOREAN_SURNAMES))]
    first = KOREAN_GIVEN_FIRST[rng.randrange(len(KOREAN_GIVEN_FIRST))]
    second = KOREAN_GIVEN_SECOND[rng.randrange(len(KOREAN_GIVEN_SECOND))]
    return f"{surname}{first}{second}"


def _build_dev_login_id(index: int) -> str:
    rng = random.Random(31000 + index * 173)
    chars = string.ascii_lowercase + string.digits
    token = "".join(rng.choice(chars) for _ in range(8))
    return f"{DEV_EMPLOYEE_LOGIN_PREFIX}{token}-{index:04d}"


def _build_position_title(index: int) -> str:
    return KOREAN_POSITION_TITLES[(index - 1) % len(KOREAN_POSITION_TITLES)]


def _build_department_distribution(
    *,
    total_employees: int,
    department_ids: list[int],
) -> list[int]:
    if not department_ids:
        return []

    min_per_department = 3
    counts = [min_per_department for _ in department_ids]
    remaining = total_employees - (min_per_department * len(department_ids))
    if remaining <= 0:
        counts[0] += max(remaining, 0)
        return counts

    # Guarantee a few high-density departments for load/perf verification scenarios.
    high_density_bonus = [140, 130, 120, 110, 100]
    for index, bonus in enumerate(high_density_bonus):
        if index >= len(counts):
            break
        add = min(remaining, bonus)
        counts[index] += add
        remaining -= add
        if remaining == 0:
            break

    if remaining > 0:
        base_add, extra = divmod(remaining, len(counts))
        for index in range(len(counts)):
            counts[index] += base_add + (1 if index < extra else 0)

    return counts


def ensure_bulk_korean_employees(
    session: Session,
    *,
    departments: list[OrgDepartment],
    total: int = DEV_EMPLOYEE_TOTAL,
) -> None:
    if not departments:
        return

    employee_role = session.exec(select(AuthRole).where(AuthRole.code == "employee")).first()
    if employee_role is None:
        return

    users = session.exec(
        select(AuthUser).where(AuthUser.login_id.like(f"{DEV_EMPLOYEE_LOGIN_PREFIX}%"))
    ).all()
    user_by_login = {user.login_id: user for user in users}

    employees = session.exec(select(HrEmployee)).all()
    employee_by_user_id = {employee.user_id: employee for employee in employees}

    employee_role_user_ids = set(
        session.exec(select(AuthUserRole.user_id).where(AuthUserRole.role_id == employee_role.id)).all()
    )

    sorted_departments = sorted(departments, key=lambda department: department.code)
    department_ids = [department.id for department in sorted_departments]
    distribution = _build_department_distribution(
        total_employees=total,
        department_ids=department_ids,
    )
    assignment: list[int] = []
    for department_id, count in zip(department_ids, distribution):
        assignment.extend([department_id] * count)
    if len(assignment) < total:
        assignment.extend([department_ids[0]] * (total - len(assignment)))
    elif len(assignment) > total:
        assignment = assignment[:total]

    for index in range(1, total + 1):
        login_id = _build_dev_login_id(index)
        email = f"{login_id}@vibe-hr.local"
        display_name = _build_korean_name(index)
        position_title = _build_position_title(index)

        user = user_by_login.get(login_id)
        assigned_department_id = assignment[index - 1]
        if user is None:
            user = AuthUser(
                login_id=login_id,
                email=email,
                password_hash=DEV_EMPLOYEE_PASSWORD_HASH,
                display_name=display_name,
                is_active=True,
            )
            session.add(user)
            session.flush()
            user_by_login[login_id] = user
        else:
            if user.email != email:
                user.email = email
            if user.display_name != display_name:
                user.display_name = display_name
            if not user.is_active:
                user.is_active = True
            if user.password_hash != DEV_EMPLOYEE_PASSWORD_HASH:
                user.password_hash = DEV_EMPLOYEE_PASSWORD_HASH
            session.add(user)

        employee = employee_by_user_id.get(user.id)
        if employee is None:
            hire_year = 2016 + (index % 10)
            hire_month = (index % 12) + 1
            hire_day = (index % 28) + 1
            employee = HrEmployee(
                user_id=user.id,
                employee_no=f"KR-{index:04d}",
                department_id=assigned_department_id,
                position_title=position_title,
                hire_date=date(hire_year, hire_month, hire_day),
                employment_status="active",
            )
            session.add(employee)
            employee_by_user_id[user.id] = employee
        else:
            changed = False
            if employee.department_id != assigned_department_id:
                employee.department_id = assigned_department_id
                changed = True
            if employee.position_title != position_title:
                employee.position_title = position_title
                changed = True
            if changed:
                session.add(employee)

        if user.id not in employee_role_user_ids:
            session.add(AuthUserRole(user_id=user.id, role_id=employee_role.id))
            employee_role_user_ids.add(user.id)

    session.commit()


def ensure_sample_records(session: Session, employee: HrEmployee) -> None:
    today = date.today()
    today_attendance = session.exec(
        select(HrAttendanceDaily).where(
            HrAttendanceDaily.employee_id == employee.id,
            HrAttendanceDaily.work_date == today,
        )
    ).first()
    if today_attendance is None:
        session.add(
            HrAttendanceDaily(
                employee_id=employee.id,
                work_date=today,
                attendance_status="present",
            )
        )

    pending_leave = session.exec(
        select(HrLeaveRequest).where(
            HrLeaveRequest.employee_id == employee.id,
            HrLeaveRequest.request_status == "pending",
        )
    ).first()
    if pending_leave is None:
        session.add(
            HrLeaveRequest(
                employee_id=employee.id,
                leave_type="annual",
                start_date=today,
                end_date=today,
                reason="\uC0D8\uD50C \uC5F0\uCC28 \uC2E0\uCCAD",
                request_status="pending",
            )
        )
    session.commit()


def _get_or_create_menu(
    session: Session,
    *,
    code: str,
    name: str,
    parent_id: int | None = None,
    path: str | None = None,
    icon: str | None = None,
    sort_order: int = 0,
) -> AppMenu:
    menu = session.exec(select(AppMenu).where(AppMenu.code == code)).first()
    if menu is None:
        menu = AppMenu(
            code=code,
            name=name,
            parent_id=parent_id,
            path=path,
            icon=icon,
            sort_order=sort_order,
        )
        session.add(menu)
        session.commit()
        session.refresh(menu)
        return menu

    changed = False
    if menu.name != name:
        menu.name = name
        changed = True
    if menu.parent_id != parent_id:
        menu.parent_id = parent_id
        changed = True
    if menu.path != path:
        menu.path = path
        changed = True
    if menu.icon != icon:
        menu.icon = icon
        changed = True
    if menu.sort_order != sort_order:
        menu.sort_order = sort_order
        changed = True
    if not menu.is_active:
        menu.is_active = True
        changed = True

    if changed:
        session.add(menu)
        session.commit()
        session.refresh(menu)

    return menu


def _link_menu_roles(session: Session, menu: AppMenu, role_codes: list[str]) -> None:
    roles = session.exec(select(AuthRole).where(AuthRole.code.in_(role_codes))).all()
    existing = session.exec(select(AppMenuRole).where(AppMenuRole.menu_id == menu.id)).all()
    existing_role_ids = {link.role_id for link in existing}

    for role in roles:
        if role.id not in existing_role_ids:
            session.add(AppMenuRole(menu_id=menu.id, role_id=role.id))
    session.commit()


def ensure_menus(session: Session) -> None:
    seeded_codes: set[str] = set()

    def _upsert(node: dict, parent_id: int | None = None) -> None:
        seeded_codes.add(node["code"])
        menu = _get_or_create_menu(
            session,
            code=node["code"],
            name=node["name"],
            parent_id=parent_id,
            path=node.get("path"),
            icon=node.get("icon"),
            sort_order=node.get("sort_order", 0),
        )
        _link_menu_roles(session, menu, node.get("roles", []))

        for child in node.get("children", []):
            _upsert(child, parent_id=menu.id)

    for top in MENU_TREE:
        _upsert(top)

    # Seed source-of-truth 기준으로 미사용 메뉴 비활성화
    all_menus = session.exec(select(AppMenu)).all()
    changed = False
    for menu in all_menus:
        if menu.code not in seeded_codes and menu.is_active:
            menu.is_active = False
            session.add(menu)
            changed = True
    if changed:
        session.commit()


def ensure_menu_actions(session: Session) -> None:
    menu_rows = session.exec(select(AppMenu).where(AppMenu.path.is_not(None), AppMenu.is_active == True)).all()
    existing_rows = session.exec(select(AppMenuAction)).all()
    existing_keys = {(row.menu_id, row.action_code) for row in existing_rows}
    now_utc = datetime.utcnow()
    changed = False

    for menu in menu_rows:
        if menu.id is None:
            continue
        for action_code in STANDARD_MENU_ACTION_CODES:
            key = (menu.id, action_code)
            if key in existing_keys:
                continue
            session.add(
                AppMenuAction(
                    menu_id=menu.id,
                    action_code=action_code,
                    enabled_default=True,
                    created_at=now_utc,
                    updated_at=now_utc,
                )
            )
            changed = True

    if changed:
        session.commit()


def ensure_system_settings(session: Session) -> None:
    defaults: list[tuple[str, str, str, str, str]] = [
        ("auth.session.access_ttl_min", "auth", "int", "120", "Access JWT 만료시간(분)"),
        ("auth.session.refresh_threshold_min", "auth", "int", "60", "갱신 임계치(분)"),
        ("auth.session.remember_enabled", "auth", "bool", "true", "Remember me 허용 여부"),
        ("auth.session.remember_ttl_min", "auth", "int", str(60 * 24 * 30), "Remember me 쿠키 만료(분)"),
        ("auth.session.show_countdown", "auth", "bool", "true", "상단 세션 카운트다운 표시 여부"),
    ]

    existing = set(session.exec(select(AppSystemSetting.key)).all())
    for key, category, value_type, value_text, description in defaults:
        if key in existing:
            continue
        session.add(
            AppSystemSetting(
                key=key,
                category=category,
                value_type=value_type,
                value_text=value_text,
                description=description,
                is_active=True,
            )
        )
    session.commit()


def ensure_common_codes(session: Session) -> None:
    group_map: dict[str, AppCodeGroup] = {}

    for code, name, description, sort_order in COMMON_CODE_GROUP_SEEDS:
        group = session.exec(select(AppCodeGroup).where(AppCodeGroup.code == code)).first()
        if group is None:
            group = AppCodeGroup(
                code=code,
                name=name,
                description=description,
                is_active=True,
                sort_order=sort_order,
            )
            session.add(group)
            session.commit()
            session.refresh(group)
        else:
            changed = False
            if group.name != name:
                group.name = name
                changed = True
            if group.description != description:
                group.description = description
                changed = True
            if group.sort_order != sort_order:
                group.sort_order = sort_order
                changed = True
            if not group.is_active:
                group.is_active = True
                changed = True
            if changed:
                session.add(group)
                session.commit()
                session.refresh(group)
        group_map[code] = group

    for group_code, items in COMMON_CODE_ITEM_SEEDS.items():
        group = group_map.get(group_code)
        if group is None:
            continue

        for code, name, sort_order in items:
            item = session.exec(
                select(AppCode).where(AppCode.group_id == group.id, AppCode.code == code)
            ).first()
            if item is None:
                item = AppCode(
                    group_id=group.id,
                    code=code,
                    name=name,
                    is_active=True,
                    sort_order=sort_order,
                )
                session.add(item)
                session.commit()
            else:
                changed = False
                if item.name != name:
                    item.name = name
                    changed = True
                if item.sort_order != sort_order:
                    item.sort_order = sort_order
                    changed = True
                if not item.is_active:
                    item.is_active = True
                    changed = True
                if changed:
                    session.add(item)
                    session.commit()


HR_BASIC_SEED_TARGET_PER_CATEGORY = DEV_EMPLOYEE_TOTAL
TIM_ATTENDANCE_SEED_DAYS = 5
TIM_LEAVE_REQUEST_SEED_TARGET = DEV_EMPLOYEE_TOTAL
PAY_PROFILE_SEED_TARGET = DEV_EMPLOYEE_TOTAL
HRI_BULK_REQUEST_TARGET = max(DEV_EMPLOYEE_TOTAL // 2, 3000)
WEL_BULK_REQUEST_TARGET = max(DEV_EMPLOYEE_TOTAL // 2, 3000)
TRA_EVENT_BATCH_PER_COURSE = 6
TRA_APPLICATION_TARGET = max(DEV_EMPLOYEE_TOTAL // 2, 3000)
TRA_REQUIRED_TARGET = max(DEV_EMPLOYEE_TOTAL // 3, 2000)
TRA_HISTORY_TARGET = max(DEV_EMPLOYEE_TOTAL // 4, 1500)
TRA_UPLOAD_TARGET = max(DEV_EMPLOYEE_TOTAL // 4, 1500)

HR_RECRUIT_PIPELINE_SEEDS = [
    {
        "candidate_no": "RC-SEED-0001",
        "full_name": "김채원",
        "resident_no_masked": "990215-2******",
        "birth_date": date(1999, 2, 15),
        "phone_mobile": "010-9100-0001",
        "email": "seed.recruit.0001@vibe-hr.local",
        "hire_type": "new",
        "career_years": 0,
        "login_id": None,
        "employee_no": None,
        "expected_join_date": date(2026, 3, 17),
        "status_code": "draft",
        "note": "통합 채용 파이프라인 시드 - 초안",
        "gender": "여성",
        "job_family": "인사",
        "education_name": "한성대학교 경영학과",
        "target_department_code": "HQ-HR",
        "target_position_title": "사원",
    },
    {
        "candidate_no": "RC-SEED-0002",
        "full_name": "박도윤",
        "resident_no_masked": "950918-1******",
        "birth_date": date(1995, 9, 18),
        "phone_mobile": "010-9100-0002",
        "email": "seed.recruit.0002@vibe-hr.local",
        "hire_type": "experienced",
        "career_years": 6,
        "login_id": "seedhire0002",
        "employee_no": "EMP-900002",
        "expected_join_date": date(2026, 3, 18),
        "status_code": "ready",
        "note": "통합 채용 파이프라인 시드 - 사번발급 완료",
        "gender": "남성",
        "job_family": "개발",
        "education_name": "한국공학대학교 컴퓨터공학과",
        "target_department_code": "HQ-ENG",
        "target_position_title": "과장",
    },
    {
        "candidate_no": "RC-SEED-0003",
        "full_name": "이하린",
        "resident_no_masked": "970604-2******",
        "birth_date": date(1997, 6, 4),
        "phone_mobile": "010-9100-0003",
        "email": "seed.recruit.0003@vibe-hr.local",
        "hire_type": "new",
        "career_years": 1,
        "login_id": "seedhire0003",
        "employee_no": "EMP-900003",
        "expected_join_date": date(2026, 3, 19),
        "status_code": "ready",
        "note": "통합 채용 파이프라인 시드 - 입사대기",
        "gender": "여성",
        "job_family": "영업",
        "education_name": "동해대학교 국제통상학과",
        "target_department_code": "HQ-SALES",
        "target_position_title": "사원",
    },
    {
        "candidate_no": "RC-SEED-0004",
        "full_name": "최서준",
        "resident_no_masked": "930111-1******",
        "birth_date": date(1993, 1, 11),
        "phone_mobile": "010-9100-0004",
        "email": "seed.recruit.0004@vibe-hr.local",
        "hire_type": "experienced",
        "career_years": 8,
        "login_id": "seedhire0004",
        "employee_no": "EMP-900004",
        "expected_join_date": date(2026, 3, 10),
        "status_code": "appointed",
        "note": "채용 확정 후 경력채용 발령 완료",
        "gender": "남성",
        "job_family": "재무",
        "education_name": "남서울대학교 회계학과",
        "target_department_code": "HQ-FIN",
        "target_position_title": "차장",
    },
    {
        "candidate_no": "RC-SEED-0005",
        "full_name": "정유진",
        "resident_no_masked": "980722-2******",
        "birth_date": date(1998, 7, 22),
        "phone_mobile": "010-9100-0005",
        "email": "seed.recruit.0005@vibe-hr.local",
        "hire_type": "new",
        "career_years": 1,
        "login_id": "seedhire0005",
        "employee_no": "EMP-900005",
        "expected_join_date": date(2026, 3, 11),
        "status_code": "appointed",
        "note": "신입 입사발령 완료",
        "gender": "여성",
        "job_family": "운영",
        "education_name": "미래대학교 산업경영학과",
        "target_department_code": "HQ-OPS",
        "target_position_title": "사원",
    },
    {
        "candidate_no": "RC-SEED-0006",
        "full_name": "강민재",
        "resident_no_masked": "940305-1******",
        "birth_date": date(1994, 3, 5),
        "phone_mobile": "010-9100-0006",
        "email": "seed.recruit.0006@vibe-hr.local",
        "hire_type": "experienced",
        "career_years": 5,
        "login_id": "seedhire0006",
        "employee_no": "EMP-900006",
        "expected_join_date": date(2026, 3, 12),
        "status_code": "appointed",
        "note": "경력직 채용 후 발령/인사기본정보 반영 완료",
        "gender": "남성",
        "job_family": "영업",
        "education_name": "서부대학교 경영정보학과",
        "target_department_code": "HQ-SALES",
        "target_position_title": "대리",
    },
]


def _count_rows(session: Session, model: type) -> int:
    count_result = session.exec(select(func.count(model.id))).one()
    return int(count_result[0] if isinstance(count_result, tuple) else count_result)


def _seed_record_date(serial: int) -> date:
    return date(2025, (serial % 12) + 1, min(28, (serial % 28) + 1))


def _recent_business_days(count: int) -> list[date]:
    days: list[date] = []
    cursor = date.today()
    while len(days) < count:
        if cursor.weekday() < 5:
            days.append(cursor)
        cursor -= timedelta(days=1)
    days.reverse()
    return days


def _build_legacy_hr_basic_seed_fields(category: str, serial: int) -> tuple[str, str, str | None, str | None, str]:
    if category == "education":
        return (
            f"학력-{serial:03d}",
            "학력",
            f"테스트대학교 {serial % 20 + 1}캠퍼스",
            f"학사-{serial % 10 + 1}",
            "자동 시드 학력 데이터",
        )
    return (
        f"평가-{serial:03d}",
        "평가",
        None,
        ["S", "A", "B", "C"][serial % 4],
        "자동 시드 평가 데이터",
    )


def ensure_hr_basic_domain_migration(session: Session) -> None:
    legacy_categories = ("thrm128", "thrm123", "thrm117", "thrm113", "thrm121")
    legacy_rows = session.exec(
        select(HrEmployeeInfoRecord).where(HrEmployeeInfoRecord.category.in_(legacy_categories))
    ).all()
    if not legacy_rows:
        return

    contact_keys = {
        (row.employee_id, row.record_date, row.contact_type, row.phone_mobile, row.email, row.addr1, row.note)
        for row in session.exec(select(HrContactPoint)).all()
    }
    career_keys = {
        (row.employee_id, row.record_date, row.career_scope, row.company_name, row.department_name, row.position_title, row.note)
        for row in session.exec(select(HrCareer)).all()
    }
    license_keys = {
        (row.employee_id, row.record_date, row.license_name, row.license_type, row.issued_org, row.license_no, row.note)
        for row in session.exec(select(HrLicense)).all()
    }
    military_keys = {
        (row.employee_id, row.record_date, row.military_type, row.branch, row.rank, row.discharge_type, row.note)
        for row in session.exec(select(HrMilitary)).all()
    }
    reward_keys = {
        (row.employee_id, row.action_date, row.reward_punish_type, row.title, row.office_name, row.reason, row.note)
        for row in session.exec(select(HrRewardPunish)).all()
    }

    changed = False
    for legacy in legacy_rows:
        if legacy.category == "thrm123":
            key = (
                legacy.employee_id,
                legacy.record_date,
                legacy.title,
                legacy.type,
                legacy.organization,
                legacy.value,
                legacy.note,
            )
            if key in contact_keys:
                continue
            session.add(
                HrContactPoint(
                    employee_id=legacy.employee_id,
                    contact_type=legacy.title,
                    phone_mobile=legacy.type,
                    email=legacy.organization,
                    addr1=legacy.value,
                    note=legacy.note,
                    record_date=legacy.record_date,
                )
            )
            contact_keys.add(key)
            changed = True
            continue

        if legacy.category == "thrm117":
            scope = (legacy.type or "EXTERNAL").upper()
            career_scope = "INTERNAL" if scope.startswith("IN") or "사내" in scope else "EXTERNAL"
            key = (
                legacy.employee_id,
                legacy.record_date,
                career_scope,
                legacy.title,
                legacy.organization,
                legacy.value,
                legacy.note,
            )
            if key in career_keys:
                continue
            session.add(
                HrCareer(
                    employee_id=legacy.employee_id,
                    career_scope=career_scope,
                    company_name=legacy.title,
                    department_name=legacy.organization,
                    position_title=legacy.value,
                    note=legacy.note,
                    record_date=legacy.record_date,
                )
            )
            career_keys.add(key)
            changed = True
            continue

        if legacy.category == "thrm113":
            key = (
                legacy.employee_id,
                legacy.record_date,
                legacy.title,
                legacy.type,
                legacy.organization,
                legacy.value,
                legacy.note,
            )
            if key in license_keys:
                continue
            session.add(
                HrLicense(
                    employee_id=legacy.employee_id,
                    license_name=legacy.title,
                    license_type=legacy.type,
                    issued_org=legacy.organization,
                    license_no=legacy.value,
                    note=legacy.note,
                    record_date=legacy.record_date,
                )
            )
            license_keys.add(key)
            changed = True
            continue

        if legacy.category == "thrm121":
            key = (
                legacy.employee_id,
                legacy.record_date,
                legacy.title,
                legacy.type,
                legacy.organization,
                legacy.value,
                legacy.note,
            )
            if key in military_keys:
                continue
            session.add(
                HrMilitary(
                    employee_id=legacy.employee_id,
                    military_type=legacy.title,
                    branch=legacy.type,
                    rank=legacy.organization,
                    discharge_type=legacy.value,
                    note=legacy.note,
                    record_date=legacy.record_date,
                )
            )
            military_keys.add(key)
            changed = True
            continue

        reward_type = (legacy.type or "REWARD").upper()
        normalized_reward_type = (
            "PUNISH"
            if reward_type.startswith(("PUN", "DIS")) or "징계" in reward_type or "벌" in reward_type
            else "REWARD"
        )
        key = (
            legacy.employee_id,
            legacy.record_date,
            normalized_reward_type,
            legacy.title,
            legacy.organization,
            legacy.value,
            legacy.note,
        )
        if key in reward_keys:
            continue
        session.add(
            HrRewardPunish(
                employee_id=legacy.employee_id,
                reward_punish_type=normalized_reward_type,
                title=legacy.title,
                office_name=legacy.organization,
                reason=legacy.value,
                note=legacy.note,
                action_date=legacy.record_date,
                status="CONFIRMED",
            )
        )
        reward_keys.add(key)
        changed = True

    if changed:
        session.commit()


def ensure_hr_basic_seed_data(session: Session) -> None:
    employees = session.exec(select(HrEmployee).order_by(HrEmployee.id)).all()
    if not employees:
        return

    target_employees = employees[: min(HR_BASIC_SEED_TARGET_PER_CATEGORY, len(employees))]
    target_employee_ids = [employee.id for employee in target_employees if employee.id is not None]
    existing_profile_employee_ids = set(
        session.exec(
            select(HrEmployeeBasicProfile.employee_id).where(HrEmployeeBasicProfile.employee_id.in_(target_employee_ids))
        ).all()
    )

    for index, employee in enumerate(target_employees, start=1):
        if employee.id in existing_profile_employee_ids:
            continue
        session.add(
            HrEmployeeBasicProfile(
                employee_id=employee.id,
                gender="여성" if index % 2 else "남성",
                resident_no_masked=f"90{(index % 12) + 1:02d}15-1******",
                blood_type=["A", "B", "O", "AB"][index % 4],
                marital_status="기혼" if index % 3 == 0 else "미혼",
                mbti=["ISTJ", "ENFP", "INTJ", "ESFJ"][index % 4],
                job_family=["경영지원", "개발", "영업", "운영"][index % 4],
                job_role=employee.position_title,
                grade=["사원", "대리", "과장", "차장", "부장"][index % 5],
            )
        )

    ensure_hr_basic_domain_migration(session)

    contact_existing = _count_rows(session, HrContactPoint)
    for serial in range(contact_existing + 1, HR_BASIC_SEED_TARGET_PER_CATEGORY + 1):
        employee = employees[(serial - 1) % len(employees)]
        session.add(
            HrContactPoint(
                employee_id=employee.id,
                seq=serial,
                contact_type="주소/연락처",
                record_date=_seed_record_date(serial),
                addr1=f"서울시 테스트로 {serial}",
                phone_mobile=f"010-2000-{serial % 10000:04d}",
                email=f"emp{serial:04d}@vibe-hr.local",
                note="자동 시드 주소/연락처 데이터",
            )
        )

    career_existing = _count_rows(session, HrCareer)
    for serial in range(career_existing + 1, HR_BASIC_SEED_TARGET_PER_CATEGORY + 1):
        employee = employees[(serial - 1) % len(employees)]
        is_internal = serial % 2 == 0
        session.add(
            HrCareer(
                employee_id=employee.id,
                seq=serial,
                career_scope="INTERNAL" if is_internal else "EXTERNAL",
                record_date=_seed_record_date(serial),
                company_name="VIBE-HR" if is_internal else f"외부회사-{(serial % 70) + 1}",
                department_name=f"경력부서{(serial % 20) + 1}",
                position_title=f"경력직무-{(serial % 15) + 1}",
                note="자동 시드 경력 데이터",
            )
        )

    license_existing = _count_rows(session, HrLicense)
    for serial in range(license_existing + 1, HR_BASIC_SEED_TARGET_PER_CATEGORY + 1):
        employee = employees[(serial - 1) % len(employees)]
        session.add(
            HrLicense(
                employee_id=employee.id,
                seq=serial,
                license_type="자격사항",
                license_name=f"자격-{serial:03d}",
                license_no=f"LIC-{serial:06d}",
                issued_org="한국산업인력공단",
                record_date=_seed_record_date(serial),
                issued_date=_seed_record_date(serial),
                note="자동 시드 자격사항 데이터",
            )
        )

    military_existing = _count_rows(session, HrMilitary)
    for serial in range(military_existing + 1, HR_BASIC_SEED_TARGET_PER_CATEGORY + 1):
        employee = employees[(serial - 1) % len(employees)]
        session.add(
            HrMilitary(
                employee_id=employee.id,
                seq=serial,
                military_type="병역",
                branch="대한민국육군",
                rank=["병장", "중사", "하사", "대위"][serial % 4],
                record_date=_seed_record_date(serial),
                discharge_type="만기전역",
                note="자동 시드 병역 데이터",
            )
        )

    reward_existing = _count_rows(session, HrRewardPunish)
    for serial in range(reward_existing + 1, HR_BASIC_SEED_TARGET_PER_CATEGORY + 1):
        employee = employees[(serial - 1) % len(employees)]
        is_reward = serial % 2 == 0
        session.add(
            HrRewardPunish(
                employee_id=employee.id,
                seq=serial,
                reward_punish_type="REWARD" if is_reward else "PUNISH",
                title=f"{'포상' if is_reward else '징계'}-{serial:03d}",
                office_name="인사위원회",
                reason=f"{'포상' if is_reward else '징계'} 사유 {serial:03d}",
                action_date=_seed_record_date(serial),
                status="CONFIRMED",
                note=f"자동 시드 {'포상' if is_reward else '징계'} 데이터",
            )
        )

    legacy_categories = ("education", "evaluation")
    for category in legacy_categories:
        count_result = session.exec(
            select(func.count(HrEmployeeInfoRecord.id)).where(HrEmployeeInfoRecord.category == category)
        ).one()
        existing_count = int(count_result[0] if isinstance(count_result, tuple) else count_result)
        for serial in range(existing_count + 1, HR_BASIC_SEED_TARGET_PER_CATEGORY + 1):
            employee = employees[(serial - 1) % len(employees)]
            title, type_value, org, value, note = _build_legacy_hr_basic_seed_fields(category, serial)
            session.add(
                HrEmployeeInfoRecord(
                    employee_id=employee.id,
                    category=category,
                    title=title,
                    type=type_value,
                    organization=org,
                    value=value,
                    note=note,
                    record_date=_seed_record_date(serial),
                )
            )

    session.commit()

def ensure_hr_retire_checklist_seed(session: Session) -> None:
    for code, title, is_required, sort_order, description in HR_RETIRE_CHECKLIST_SEEDS:
        row = session.exec(
            select(HrRetireChecklistItem).where(HrRetireChecklistItem.code == code)
        ).first()
        if row is None:
            session.add(
                HrRetireChecklistItem(
                    code=code,
                    title=title,
                    description=description,
                    is_required=is_required,
                    is_active=True,
                    sort_order=sort_order,
                )
            )
            continue

        changed = False
        if row.title != title:
            row.title = title
            changed = True
        if row.description != description:
            row.description = description
            changed = True
        if row.is_required != is_required:
            row.is_required = is_required
            changed = True
        if row.sort_order != sort_order:
            row.sort_order = sort_order
            changed = True
        if not row.is_active:
            row.is_active = True
            changed = True
        if changed:
            session.add(row)

    session.commit()


def ensure_remove_legacy_appointment_records(session: Session) -> None:
    # 발령처리 데이터는 전용 테이블로 분리하기 위한 정리 단계.
    # 기존 hr_employee_info_records(category='appointment') 데이터는 제거한다.
    session.exec(text("DELETE FROM hr_employee_info_records WHERE category = 'appointment'"))
    session.commit()


def ensure_hr_basic_category_mapping(session: Session) -> None:
    # Legacy categories are normalized to EHR legacy table keys.
    session.exec(
        text(
            """
            UPDATE hr_employee_info_records
            SET category = 'thrm128'
            WHERE lower(category) = 'reward_penalty'
            """
        )
    )
    session.exec(
        text(
            """
            UPDATE hr_employee_info_records
            SET category = 'thrm123'
            WHERE lower(category) = 'address'
            """
        )
    )
    session.exec(
        text(
            """
            UPDATE hr_employee_info_records
            SET category = 'thrm123'
            WHERE lower(category) = 'contact'
            """
        )
    )
    session.exec(
        text(
            """
            UPDATE hr_employee_info_records
            SET category = 'thrm123'
            WHERE lower(category) = 'thrm124'
            """
        )
    )
    session.exec(
        text(
            """
            UPDATE hr_employee_info_records
            SET category = 'thrm117'
            WHERE lower(category) = 'career'
            """
        )
    )
    session.exec(
        text(
            """
            UPDATE hr_employee_info_records
            SET category = 'thrm113'
            WHERE lower(category) = 'certificate'
            """
        )
    )
    session.exec(
        text(
            """
            UPDATE hr_employee_info_records
            SET category = 'thrm121'
            WHERE lower(category) = 'military'
            """
        )
    )
    session.commit()

ATTENDANCE_CODE_SEEDS = [
    # (code, name, category, unit, is_requestable, min_days, max_days, deduct_annual, sort_order)
    ("C01", "연차휴가", "leave", "day", True, 1.0, 25.0, True, 10),
    ("C01A", "오전반차", "leave", "am", True, 0.5, 0.5, True, 20),
    ("C01B", "오후반차", "leave", "pm", True, 0.5, 0.5, True, 30),
    ("C02", "하계휴가", "leave", "day", True, 1.0, 5.0, False, 40),
    ("C03", "대체휴가", "leave", "day", True, 1.0, 100.0, False, 50),
    ("C04", "병가", "leave", "day", True, 1.0, 90.0, False, 60),
    ("C05", "경조휴가", "leave", "day", True, 1.0, 5.0, False, 70),
    ("C06", "공가", "leave", "day", True, 1.0, 10.0, False, 80),
    ("C07", "교육", "leave", "day", True, 1.0, 30.0, False, 90),
    ("C08", "출산휴가", "leave", "day", True, 1.0, 120.0, False, 100),
    ("C09", "육아휴직", "leave", "day", True, 1.0, 365.0, False, 110),
    ("W01", "정상출근", "work", "day", False, None, None, False, 200),
    ("W02", "지각", "work", "day", False, None, None, False, 210),
    ("W03", "조퇴", "work", "day", False, None, None, False, 220),
    ("W04", "결근", "work", "day", False, None, None, False, 230),
    ("W05", "외출", "work", "hour", True, None, None, False, 240),
    ("W06", "출장", "work", "day", True, 1.0, 30.0, False, 250),
    ("W07", "재택근무", "work", "day", True, 1.0, 30.0, False, 260),
]

WORK_SCHEDULE_SEEDS = [
    # (code, name, work_start, work_end, break_min, is_overnight, work_hours, sort_order)
    ("WS01", "주간근무(표준)", "09:00", "18:00", 60, False, 8.0, 10),
    ("WS02", "주간근무(탄력)", "08:00", "17:00", 60, False, 8.0, 20),
    ("WS03", "시차출퇴근(A)", "07:00", "16:00", 60, False, 8.0, 30),
    ("WS04", "시차출퇴근(B)", "10:00", "19:00", 60, False, 8.0, 40),
    ("WS05", "야간근무", "22:00", "07:00", 60, True, 8.0, 50),
    ("WS06", "교대근무(주간)", "06:00", "14:00", 30, False, 7.5, 60),
    ("WS07", "교대근무(야간)", "14:00", "22:00", 30, False, 7.5, 70),
    ("WS08", "유연근무", "06:00", "22:00", 60, False, 8.0, 80),
]

HOLIDAY_SEEDS = [
    # 2025
    (date(2025, 1, 1), "신정", "legal"),
    (date(2025, 1, 28), "설날 전날", "legal"),
    (date(2025, 1, 29), "설날", "legal"),
    (date(2025, 1, 30), "설날 다음날", "legal"),
    (date(2025, 3, 1), "삼일절", "legal"),
    (date(2025, 5, 5), "어린이날", "legal"),
    (date(2025, 5, 6), "대체공휴일(석가탄신일)", "substitute"),
    (date(2025, 5, 15), "석가탄신일", "legal"),
    (date(2025, 6, 6), "현충일", "legal"),
    (date(2025, 8, 15), "광복절", "legal"),
    (date(2025, 10, 3), "개천절", "legal"),
    (date(2025, 10, 5), "추석 전날", "legal"),
    (date(2025, 10, 6), "추석", "legal"),
    (date(2025, 10, 7), "추석 다음날", "legal"),
    (date(2025, 10, 8), "대체공휴일(추석)", "substitute"),
    (date(2025, 10, 9), "한글날", "legal"),
    (date(2025, 12, 25), "크리스마스", "legal"),
    # 2026
    (date(2026, 1, 1), "신정", "legal"),
    (date(2026, 2, 16), "설날 전날", "legal"),
    (date(2026, 2, 17), "설날", "legal"),
    (date(2026, 2, 18), "설날 다음날", "legal"),
    (date(2026, 3, 1), "삼일절", "legal"),
    (date(2026, 3, 2), "대체공휴일(삼일절)", "substitute"),
    (date(2026, 5, 5), "어린이날", "legal"),
    (date(2026, 5, 24), "석가탄신일", "legal"),
    (date(2026, 5, 25), "대체공휴일(석가탄신일)", "substitute"),
    (date(2026, 6, 6), "현충일", "legal"),
    (date(2026, 8, 15), "광복절", "legal"),
    (date(2026, 9, 24), "추석 전날", "legal"),
    (date(2026, 9, 25), "추석", "legal"),
    (date(2026, 9, 26), "추석 다음날", "legal"),
    (date(2026, 10, 3), "개천절", "legal"),
    (date(2026, 10, 5), "대체공휴일(개천절)", "substitute"),
    (date(2026, 10, 9), "한글날", "legal"),
    (date(2026, 12, 25), "크리스마스", "legal"),
]


def ensure_attendance_codes(session: Session) -> None:
    for code, name, category, unit, is_requestable, min_days, max_days, deduct_annual, sort_order in ATTENDANCE_CODE_SEEDS:
        existing = session.exec(select(TimAttendanceCode).where(TimAttendanceCode.code == code)).first()
        if existing is None:
            session.add(TimAttendanceCode(
                code=code, name=name, category=category, unit=unit,
                is_requestable=is_requestable, min_days=min_days, max_days=max_days,
                deduct_annual=deduct_annual, sort_order=sort_order, is_active=True,
            ))
        else:
            changed = False
            if existing.name != name:
                existing.name = name
                changed = True
            if existing.category != category:
                existing.category = category
                changed = True
            if existing.sort_order != sort_order:
                existing.sort_order = sort_order
                changed = True
            if changed:
                session.add(existing)
    session.commit()


def ensure_work_schedule_codes(session: Session) -> None:
    for code, name, work_start, work_end, break_min, is_overnight, work_hours, sort_order in WORK_SCHEDULE_SEEDS:
        existing = session.exec(select(TimWorkScheduleCode).where(TimWorkScheduleCode.code == code)).first()
        if existing is None:
            session.add(TimWorkScheduleCode(
                code=code, name=name, work_start=work_start, work_end=work_end,
                break_minutes=break_min, is_overnight=is_overnight, work_hours=work_hours,
                sort_order=sort_order, is_active=True,
            ))
        else:
            changed = False
            if existing.name != name:
                existing.name = name
                changed = True
            if existing.sort_order != sort_order:
                existing.sort_order = sort_order
                changed = True
            if changed:
                session.add(existing)
    session.commit()


def ensure_schedule_foundations(session: Session) -> None:
    pattern = session.exec(select(TimSchedulePattern).where(TimSchedulePattern.code == "PTN_DEPT_STD")).first()
    if pattern is None:
        pattern = TimSchedulePattern(code="PTN_DEPT_STD", name="부서기본(월~금 09-18)", is_active=True)
        session.add(pattern)
        session.commit()
        session.refresh(pattern)

    day_map = {
        0: (True, "09:00", "18:00", 60, 480, False),
        1: (True, "09:00", "18:00", 60, 480, False),
        2: (True, "09:00", "18:00", 60, 480, False),
        3: (True, "09:00", "18:00", 60, 480, False),
        4: (True, "09:00", "18:00", 60, 480, False),
        5: (False, None, None, 0, 0, False),
        6: (False, None, None, 0, 0, False),
    }
    for weekday, (is_workday, start, end, break_min, expected, overnight) in day_map.items():
        existing = session.exec(
            select(TimSchedulePatternDay).where(
                TimSchedulePatternDay.pattern_id == pattern.id,
                TimSchedulePatternDay.weekday == weekday,
            )
        ).first()
        if existing is None:
            session.add(
                TimSchedulePatternDay(
                    pattern_id=pattern.id,
                    weekday=weekday,
                    is_workday=is_workday,
                    start_time=start,
                    end_time=end,
                    break_minutes=break_min,
                    expected_minutes=expected,
                    is_overnight=overnight,
                )
            )

    departments = session.exec(select(OrgDepartment)).all()
    for dept in departments:
        existing = session.exec(
            select(TimDepartmentScheduleAssignment).where(
                TimDepartmentScheduleAssignment.department_id == dept.id,
                TimDepartmentScheduleAssignment.is_active == True,
            )
        ).first()
        if existing is None:
            session.add(
                TimDepartmentScheduleAssignment(
                    department_id=dept.id,
                    pattern_id=pattern.id,
                    effective_from=date(2026, 1, 1),
                    effective_to=None,
                    priority=100,
                    is_active=True,
                )
            )

    session.commit()


def ensure_holidays(session: Session) -> None:
    for holiday_date, name, holiday_type in HOLIDAY_SEEDS:
        existing = session.exec(select(TimHoliday).where(TimHoliday.holiday_date == holiday_date)).first()
        if existing is None:
            session.add(TimHoliday(
                holiday_date=holiday_date, name=name, holiday_type=holiday_type, is_active=True,
            ))
        else:
            changed = False
            if existing.name != name:
                existing.name = name
                changed = True
            if existing.holiday_type != holiday_type:
                existing.holiday_type = holiday_type
                changed = True
            if changed:
                session.add(existing)
    session.commit()


def ensure_annual_leave_seed(session: Session) -> None:
    year = date.today().year
    employees = session.exec(select(HrEmployee).order_by(HrEmployee.id)).all()

    for employee in employees:
        exists = session.exec(
            select(HrAnnualLeave.id).where(HrAnnualLeave.employee_id == employee.id, HrAnnualLeave.year == year)
        ).first()
        if exists is not None:
            continue

        years = max(0, year - employee.hire_date.year)
        if years <= 0:
            granted = 11.0
        elif years < 3:
            granted = 15.0
        else:
            granted = float(min(15 + ((years - 1) // 2), 25))

        carry = 0.0
        prev = session.exec(
            select(HrAnnualLeave).where(HrAnnualLeave.employee_id == employee.id, HrAnnualLeave.year == year - 1)
        ).first()
        if prev is not None:
            carry = min(prev.remaining_days, 5.0)

        session.add(
            HrAnnualLeave(
                employee_id=employee.id,
                year=year,
                granted_days=granted,
                used_days=0.0,
                carried_over_days=carry,
                remaining_days=granted + carry,
                grant_type="auto",
            )
        )


def ensure_tim_transaction_samples(session: Session) -> None:
    employees = session.exec(
        select(HrEmployee)
        .where(HrEmployee.employment_status == "active")
        .order_by(HrEmployee.id)
    ).all()
    if not employees:
        return

    business_days = _recent_business_days(TIM_ATTENDANCE_SEED_DAYS)
    existing_attendance_keys = set(
        session.exec(
            select(HrAttendanceDaily.employee_id, HrAttendanceDaily.work_date).where(
                HrAttendanceDaily.work_date.in_(business_days)
            )
        ).all()
    )

    for index, employee in enumerate(employees, start=1):
        for day_index, work_date in enumerate(business_days):
            key = (employee.id, work_date)
            if key in existing_attendance_keys:
                continue

            status = "present"
            check_in_at = datetime(work_date.year, work_date.month, work_date.day, 8, 55)
            check_out_at = datetime(work_date.year, work_date.month, work_date.day, 18, 5)

            if (index + day_index) % 53 == 0:
                status = "absent"
                check_in_at = None
                check_out_at = None
            elif (index + day_index) % 29 == 0:
                status = "leave"
                check_in_at = None
                check_out_at = None
            elif (index + day_index) % 23 == 0:
                status = "remote"
                check_in_at = datetime(work_date.year, work_date.month, work_date.day, 9, 5)
                check_out_at = datetime(work_date.year, work_date.month, work_date.day, 18, 10)
            elif (index + day_index) % 17 == 0:
                status = "late"
                check_in_at = datetime(work_date.year, work_date.month, work_date.day, 9, 35)
                check_out_at = datetime(work_date.year, work_date.month, work_date.day, 18, 25)

            session.add(
                HrAttendanceDaily(
                    employee_id=employee.id,
                    work_date=work_date,
                    check_in_at=check_in_at,
                    check_out_at=check_out_at,
                    attendance_status=status,
                )
            )

    approver = session.exec(select(HrEmployee).where(HrEmployee.employee_no == "HR-0001")).first()
    existing_seed_leave_reasons = set(
        session.exec(
            select(HrLeaveRequest.reason).where(HrLeaveRequest.reason.like("SEED-TIM-LEAVE-%"))
        ).all()
    )
    leave_type_cycle = ("annual", "half_day", "sick", "other", "unpaid")
    status_cycle = ("pending", "approved", "rejected", "cancelled")
    target_employees = employees[: min(TIM_LEAVE_REQUEST_SEED_TARGET, len(employees))]

    for index, employee in enumerate(target_employees, start=1):
        reason = f"SEED-TIM-LEAVE-{index:05d}"
        if reason in existing_seed_leave_reasons:
            continue

        leave_type = leave_type_cycle[(index - 1) % len(leave_type_cycle)]
        status = status_cycle[(index - 1) % len(status_cycle)]
        start_date = business_days[(index - 1) % len(business_days)] + timedelta(days=(index % 45) + 1)
        end_date = start_date if leave_type != "annual" or index % 4 else start_date + timedelta(days=1)
        decided_at = None
        approved_at = None
        decision_comment = None
        decided_by = None
        approver_employee_id = approver.id if approver is not None else None

        if status != "pending":
            decided_at = datetime(start_date.year, start_date.month, start_date.day, 17, 0)
            approved_at = decided_at
            decided_by = approver_employee_id
            if status == "rejected":
                decision_comment = "증빙 보완 필요"
            elif status == "cancelled":
                decision_comment = "신청자 취소"
            else:
                decision_comment = "시드 승인 완료"

        session.add(
            HrLeaveRequest(
                employee_id=employee.id,
                leave_type=leave_type,
                start_date=start_date,
                end_date=end_date,
                reason=reason,
                request_status=status,
                approver_employee_id=approver_employee_id,
                approved_at=approved_at,
                decision_comment=decision_comment,
                decided_by=decided_by,
                decided_at=decided_at,
            )
        )

    session.commit()

PAY_PAYROLL_CODE_SEEDS = [
    # code, name, pay_type, payment_day, tax_deductible, social_ins_deductible
    ("P100", "정규급여", "급여", "25", True, True),
    ("P200", "정기상여", "상여", "25", True, True),
    ("P300", "연차수당", "수당", "당월말일", True, True),
]

PAY_TAX_RATE_SEEDS = [
    # year, rate_type, employee_rate, employer_rate, min_limit, max_limit
    (2025, "국민연금", 4.5, 4.5, 390000, 6170000),
    (2025, "건강보험", 3.545, 3.545, 279266, 110332300),
    (2025, "장기요양", 0.4591, 0.4591, None, None),
    (2025, "고용보험", 0.9, 1.15, None, None),
    (2026, "국민연금", 4.5, 4.5, 390000, 6170000),
    (2026, "건강보험", 3.545, 3.545, 279266, 110332300),
    (2026, "장기요양", 0.4591, 0.4591, None, None),
    (2026, "고용보험", 0.9, 1.15, None, None),
]

PAY_ALLOWANCE_DEDUCTION_SEEDS = [
    # code, name, type, tax_type, calculation_type, sort_order
    ("BSC", "기본급", "allowance", "taxable", "fixed", 10),
    ("MLA", "식대", "allowance", "non-taxable", "fixed", 20),
    ("OTX", "연장수당", "allowance", "taxable", "fixed", 30),
    ("NGT", "야간수당", "allowance", "taxable", "fixed", 40),
    ("POS", "직책수당", "allowance", "taxable", "fixed", 50),
    ("PEN", "국민연금", "deduction", "insurance", "formula", 110),
    ("HIN", "건강보험", "deduction", "insurance", "formula", 120),
    ("EMP", "고용보험", "deduction", "insurance", "formula", 125),
    ("LTC", "장기요양", "deduction", "insurance", "formula", 127),
    ("ITX", "소득세", "deduction", "tax", "formula", 130),
    ("LTX", "지방소득세", "deduction", "tax", "formula", 135),
]

PAY_ITEM_GROUP_SEEDS = [
    # code, name, description
    ("GR-OFFICE", "사무직 그룹", "사무직 급여 항목 기본 그룹"),
    ("GR-PROD", "생산직 그룹", "생산직 급여 항목 기본 그룹"),
]

HRI_FORM_TYPE_SEEDS = [
    # form_code, form_name_ko, module_code, requires_receive, default_priority
    ("LEAVE_REQUEST", "Leave request", "TIM", False, 25),
    ("WEL_BENEFIT_REQUEST", "Welfare benefit request", "WEL", True, 35),
    ("CERT_EMPLOYMENT", "재직증명서 신청", "HR", True, 10),
    ("TIM_CORRECTION", "근태 정정 신청", "TIM", False, 20),
    ("EXPENSE_COMMON", "공통 경비 신청", "CPN", True, 30),
]

HRI_FORM_TYPE_POLICY_SEEDS = {
    "CERT_EMPLOYMENT": [
        ("attachment_required", "false"),
        ("max_attachment_count", "3"),
    ],
    "TIM_CORRECTION": [
        ("attachment_required", "true"),
        ("max_attachment_count", "5"),
    ],
    "LEAVE_REQUEST": [
        ("attachment_required", "false"),
        ("max_attachment_count", "3"),
        ("allow_past_date", "false"),
        ("max_span_days", "31"),
        ("require_reason", "true"),
    ],
    "WEL_BENEFIT_REQUEST": [
        ("attachment_required", "false"),
        ("max_attachment_count", "5"),
        ("benefit_type_required", "true"),
        ("require_reason", "true"),
    ],
    "EXPENSE_COMMON": [
        ("attachment_required", "true"),
        ("max_attachment_count", "10"),
    ],
}

HRI_APPROVAL_ACTOR_RULE_SEEDS = [
    # role_code, resolve_method, fallback_rule, position_keywords (JSON)
    # TEAM_LEADER: 같은 부서 내 팀장 직함 보유자
    ("TEAM_LEADER", "ORG_CHAIN", "ESCALATE", '["팀장"]'),
    # DEPT_HEAD: 같은 부서 내 부서장/본부장/실장 직함 보유자
    ("DEPT_HEAD", "ORG_CHAIN", "ESCALATE", '["부서장","본부장","실장"]'),
    # CEO: 회사 전체에서 대표/CEO/사장 직함 보유자 (fallback: HR_ADMIN)
    ("CEO", "JOB_POSITION", "HR_ADMIN", '["대표","CEO","사장"]'),
    # HR_ADMIN: admin 역할 사용자 중 첫 번째 (고정 resolve)
    ("HR_ADMIN", "FIXED_USER", "HR_ADMIN", None),
]

HRI_APPROVAL_ACTOR_RULE_SEEDS = [
    (
        role_code,
        resolve_method,
        "HR_ADMIN" if role_code in {"TEAM_LEADER", "DEPT_HEAD"} else fallback_rule,
        position_keywords_json,
    )
    for role_code, resolve_method, fallback_rule, position_keywords_json in HRI_APPROVAL_ACTOR_RULE_SEEDS
]

HRI_APPROVAL_TEMPLATE_SEEDS = [
    {
        "template_code": "HRI_TMPL_CERT",
        "template_name": "증명서 기본 결재선",
        "scope_type": "GLOBAL",
        "scope_id": None,
        "is_default": False,
        "is_active": True,
        "priority": 120,
        "steps": [
            {"step_order": 1, "step_type": "APPROVAL", "actor_resolve_type": "ROLE_BASED", "actor_role_code": "TEAM_LEADER", "required_action": "APPROVE"},
            {"step_order": 2, "step_type": "APPROVAL", "actor_resolve_type": "ROLE_BASED", "actor_role_code": "DEPT_HEAD", "required_action": "APPROVE"},
            {"step_order": 3, "step_type": "APPROVAL", "actor_resolve_type": "ROLE_BASED", "actor_role_code": "CEO", "required_action": "APPROVE"},
            {"step_order": 4, "step_type": "RECEIVE", "actor_resolve_type": "ROLE_BASED", "actor_role_code": "HR_ADMIN", "required_action": "RECEIVE"},
        ],
    },
    {
        "template_code": "HRI_TMPL_TIM_SIMPLE",
        "template_name": "근태 기본 결재선",
        "scope_type": "GLOBAL",
        "scope_id": None,
        "is_default": False,
        "is_active": True,
        "priority": 110,
        "steps": [
            {"step_order": 1, "step_type": "APPROVAL", "actor_resolve_type": "ROLE_BASED", "actor_role_code": "TEAM_LEADER", "required_action": "APPROVE"},
            {"step_order": 2, "step_type": "APPROVAL", "actor_resolve_type": "ROLE_BASED", "actor_role_code": "DEPT_HEAD", "required_action": "APPROVE"},
        ],
    },
    {
        "template_code": "HRI_TMPL_WEL_RECEIVE",
        "template_name": "복리후생 기본 결재선",
        "scope_type": "GLOBAL",
        "scope_id": None,
        "is_default": False,
        "is_active": True,
        "priority": 115,
        "steps": [
            {"step_order": 1, "step_type": "APPROVAL", "actor_resolve_type": "ROLE_BASED", "actor_role_code": "TEAM_LEADER", "required_action": "APPROVE"},
            {"step_order": 2, "step_type": "APPROVAL", "actor_resolve_type": "ROLE_BASED", "actor_role_code": "DEPT_HEAD", "required_action": "APPROVE"},
            {"step_order": 3, "step_type": "RECEIVE", "actor_resolve_type": "ROLE_BASED", "actor_role_code": "HR_ADMIN", "required_action": "RECEIVE"},
        ],
    },
    {
        "template_code": "HRI_TMPL_DEFAULT",
        "template_name": "공통 기본 결재선",
        "scope_type": "GLOBAL",
        "scope_id": None,
        "is_default": True,
        "is_active": True,
        "priority": 100,
        "steps": [
            {"step_order": 1, "step_type": "APPROVAL", "actor_resolve_type": "ROLE_BASED", "actor_role_code": "TEAM_LEADER", "required_action": "APPROVE"},
            {"step_order": 2, "step_type": "APPROVAL", "actor_resolve_type": "ROLE_BASED", "actor_role_code": "DEPT_HEAD", "required_action": "APPROVE"},
            {"step_order": 3, "step_type": "APPROVAL", "actor_resolve_type": "ROLE_BASED", "actor_role_code": "CEO", "required_action": "APPROVE"},
        ],
    },
]

HRI_FORM_TYPE_TEMPLATE_MAP_SEEDS = [
    # form_code, template_code
    ("CERT_EMPLOYMENT", "HRI_TMPL_CERT"),
    ("TIM_CORRECTION", "HRI_TMPL_TIM_SIMPLE"),
    ("LEAVE_REQUEST", "HRI_TMPL_TIM_SIMPLE"),
    ("WEL_BENEFIT_REQUEST", "HRI_TMPL_WEL_RECEIVE"),
    ("EXPENSE_COMMON", "HRI_TMPL_DEFAULT"),
]


PAP_FINAL_RESULT_SEEDS = [
    # result_code, result_name, score_grade, sort_order, description
    ("S", "Outstanding", 100.0, 10, "Top performance"),
    ("A", "Exceeds Expectations", 90.0, 20, "High performance"),
    ("B", "Meets Expectations", 80.0, 30, "Normal performance"),
    ("C", "Needs Improvement", 70.0, 40, "Improvement required"),
]

PAP_APPRAISAL_SEEDS = [
    # code, name, year, final_result_code, type, start, end, active, sort, description
    (
        "ANNUAL_2026",
        "2026 Annual Appraisal",
        2026,
        "A",
        "annual",
        "2026-01-01",
        "2026-12-31",
        True,
        10,
        "Temporary seed for PAP module",
    ),
    (
        "H1_2026",
        "2026 H1 Appraisal",
        2026,
        "B",
        "half_year",
        "2026-01-01",
        "2026-06-30",
        True,
        20,
        "Temporary seed for PAP module",
    ),
]


def ensure_pap_final_results(session: Session) -> None:
    for result_code, result_name, score_grade, sort_order, description in PAP_FINAL_RESULT_SEEDS:
        existing = session.exec(
            select(PapFinalResult).where(PapFinalResult.result_code == result_code),
        ).first()
        if existing is None:
            session.add(
                PapFinalResult(
                    result_code=result_code,
                    result_name=result_name,
                    score_grade=score_grade,
                    sort_order=sort_order,
                    is_active=True,
                    description=description,
                ),
            )
            continue

        changed = False
        if existing.result_name != result_name:
            existing.result_name = result_name
            changed = True
        if existing.score_grade != score_grade:
            existing.score_grade = score_grade
            changed = True
        if existing.sort_order != sort_order:
            existing.sort_order = sort_order
            changed = True
        if existing.description != description:
            existing.description = description
            changed = True
        if not existing.is_active:
            existing.is_active = True
            changed = True
        if changed:
            session.add(existing)
    session.commit()


def ensure_pap_appraisal_masters(session: Session) -> None:
    final_result_by_code = {
        row.result_code: row
        for row in session.exec(select(PapFinalResult).where(PapFinalResult.is_active)).all()
    }

    for (
        appraisal_code,
        appraisal_name,
        appraisal_year,
        final_result_code,
        appraisal_type,
        start_date_raw,
        end_date_raw,
        is_active,
        sort_order,
        description,
    ) in PAP_APPRAISAL_SEEDS:
        final_result = final_result_by_code.get(final_result_code)
        if final_result is None:
            continue

        start_date = date.fromisoformat(start_date_raw)
        end_date = date.fromisoformat(end_date_raw)
        existing = session.exec(
            select(PapAppraisalMaster).where(
                PapAppraisalMaster.appraisal_year == appraisal_year,
                PapAppraisalMaster.appraisal_code == appraisal_code,
            ),
        ).first()

        if existing is None:
            session.add(
                PapAppraisalMaster(
                    appraisal_code=appraisal_code,
                    appraisal_name=appraisal_name,
                    appraisal_year=appraisal_year,
                    final_result_id=final_result.id,
                    appraisal_type=appraisal_type,
                    start_date=start_date,
                    end_date=end_date,
                    is_active=is_active,
                    sort_order=sort_order,
                    description=description,
                ),
            )
            continue

        changed = False
        if existing.appraisal_name != appraisal_name:
            existing.appraisal_name = appraisal_name
            changed = True
        if existing.final_result_id != final_result.id:
            existing.final_result_id = final_result.id
            changed = True
        if existing.appraisal_type != appraisal_type:
            existing.appraisal_type = appraisal_type
            changed = True
        if existing.start_date != start_date:
            existing.start_date = start_date
            changed = True
        if existing.end_date != end_date:
            existing.end_date = end_date
            changed = True
        if existing.is_active != is_active:
            existing.is_active = is_active
            changed = True
        if existing.sort_order != sort_order:
            existing.sort_order = sort_order
            changed = True
        if existing.description != description:
            existing.description = description
            changed = True
        if changed:
            session.add(existing)
    session.commit()


def ensure_pay_payroll_codes(session: Session) -> None:
    for code, name, pay_type, payment_day, tax_ded, social_ded in PAY_PAYROLL_CODE_SEEDS:
        existing = session.exec(select(PayPayrollCode).where(PayPayrollCode.code == code)).first()
        if existing is None:
            session.add(PayPayrollCode(
                code=code, name=name, pay_type=pay_type, payment_day=payment_day,
                tax_deductible=tax_ded, social_ins_deductible=social_ded, is_active=True
            ))
        else:
            changed = False
            if existing.name != name:
                existing.name = name
                changed = True
            if existing.tax_deductible != tax_ded:
                existing.tax_deductible = tax_ded
                changed = True
            if changed:
                session.add(existing)
    session.commit()


def ensure_pay_allowance_deductions(session: Session) -> None:
    for code, name, item_type, tax_type, calc_type, sort_order in PAY_ALLOWANCE_DEDUCTION_SEEDS:
        existing = session.exec(select(PayAllowanceDeduction).where(PayAllowanceDeduction.code == code)).first()
        if existing is None:
            session.add(
                PayAllowanceDeduction(
                    code=code,
                    name=name,
                    type=item_type,
                    tax_type=tax_type,
                    calculation_type=calc_type,
                    is_active=True,
                    sort_order=sort_order,
                )
            )
        else:
            changed = False
            if existing.name != name:
                existing.name = name
                changed = True
            if existing.type != item_type:
                existing.type = item_type
                changed = True
            if existing.tax_type != tax_type:
                existing.tax_type = tax_type
                changed = True
            if existing.calculation_type != calc_type:
                existing.calculation_type = calc_type
                changed = True
            if existing.sort_order != sort_order:
                existing.sort_order = sort_order
                changed = True
            if not existing.is_active:
                existing.is_active = True
                changed = True
            if changed:
                session.add(existing)
    session.commit()


def ensure_pay_item_groups(session: Session) -> None:
    for code, name, description in PAY_ITEM_GROUP_SEEDS:
        existing = session.exec(select(PayItemGroup).where(PayItemGroup.code == code)).first()
        if existing is None:
            session.add(PayItemGroup(code=code, name=name, description=description, is_active=True))
        else:
            changed = False
            if existing.name != name:
                existing.name = name
                changed = True
            if existing.description != description:
                existing.description = description
                changed = True
            if not existing.is_active:
                existing.is_active = True
                changed = True
            if changed:
                session.add(existing)
    session.commit()


def ensure_pay_phase2_samples(session: Session) -> None:
    payroll_code = session.exec(select(PayPayrollCode).where(PayPayrollCode.code == "P100")).first()
    if payroll_code is None:
        return

    month_start = date.today().replace(day=1)
    year_month = month_start.strftime("%Y-%m")
    employees = session.exec(
        select(HrEmployee)
        .where(HrEmployee.employment_status == "active")
        .order_by(HrEmployee.id)
    ).all()
    if not employees:
        return

    target_employees = employees[: min(PAY_PROFILE_SEED_TARGET, len(employees))]
    target_employee_ids = [employee.id for employee in target_employees if employee.id is not None]
    item_groups = {
        row.code: row
        for row in session.exec(select(PayItemGroup).where(PayItemGroup.code.in_(["GR-OFFICE", "GR-PROD"]))).all()
    }
    existing_profiles = {
        row.employee_id: row
        for row in session.exec(
            select(PayEmployeeProfile).where(
                PayEmployeeProfile.employee_id.in_(target_employee_ids),
                PayEmployeeProfile.effective_from == month_start,
            )
        ).all()
    }
    existing_variable_inputs = {
        (row.employee_id, row.item_code): row
        for row in session.exec(
            select(PayVariableInput).where(
                PayVariableInput.year_month == year_month,
                PayVariableInput.employee_id.in_(target_employee_ids),
            )
        ).all()
    }

    for index, employee in enumerate(target_employees, start=1):
        item_group = item_groups.get("GR-PROD" if index % 5 == 0 else "GR-OFFICE")
        base_salary = float(3_100_000 + ((index - 1) % 28) * 95_000)
        if employee.position_title in {"차장", "부장"}:
            base_salary += 350_000
        elif employee.position_title == "과장":
            base_salary += 180_000

        existing_profile = existing_profiles.get(employee.id)
        if existing_profile is None:
            session.add(
                PayEmployeeProfile(
                    employee_id=employee.id,
                    payroll_code_id=payroll_code.id,
                    item_group_id=item_group.id if item_group else None,
                    base_salary=base_salary,
                    pay_type_code="regular",
                    payment_day_type="fixed_day",
                    payment_day_value=25,
                    holiday_adjustment="previous_business_day",
                    effective_from=month_start,
                    effective_to=None,
                    is_active=True,
                )
            )
        else:
            changed = False
            if existing_profile.payroll_code_id != payroll_code.id:
                existing_profile.payroll_code_id = payroll_code.id
                changed = True
            expected_item_group_id = item_group.id if item_group else None
            if existing_profile.item_group_id != expected_item_group_id:
                existing_profile.item_group_id = expected_item_group_id
                changed = True
            if existing_profile.base_salary != base_salary:
                existing_profile.base_salary = base_salary
                changed = True
            if existing_profile.pay_type_code != "regular":
                existing_profile.pay_type_code = "regular"
                changed = True
            if existing_profile.payment_day_type != "fixed_day":
                existing_profile.payment_day_type = "fixed_day"
                changed = True
            if existing_profile.payment_day_value != 25:
                existing_profile.payment_day_value = 25
                changed = True
            if existing_profile.holiday_adjustment != "previous_business_day":
                existing_profile.holiday_adjustment = "previous_business_day"
                changed = True
            if existing_profile.effective_to is not None:
                existing_profile.effective_to = None
                changed = True
            if not existing_profile.is_active:
                existing_profile.is_active = True
                changed = True
            if changed:
                session.add(existing_profile)

        variable_samples = [
            {
                "item_code": "MLA",
                "direction": "earning",
                "amount": float(120_000 + (index % 4) * 10_000),
                "memo": "bulk meal allowance",
            },
        ]
        if employee.position_title in {"과장", "차장", "부장"}:
            variable_samples.append(
                {
                    "item_code": "POS",
                    "direction": "earning",
                    "amount": float(150_000 + (index % 3) * 50_000),
                    "memo": "bulk position allowance",
                }
            )
        if index % 3 == 0:
            variable_samples.append(
                {
                    "item_code": "OTX",
                    "direction": "earning",
                    "amount": float(90_000 + (index % 5) * 35_000),
                    "memo": "bulk overtime allowance",
                }
            )
        if index % 8 == 0:
            variable_samples.append(
                {
                    "item_code": "NGT",
                    "direction": "earning",
                    "amount": float(70_000 + (index % 4) * 25_000),
                    "memo": "bulk night allowance",
                }
            )

        for variable_sample in variable_samples:
            key = (employee.id, variable_sample["item_code"])
            existing_variable = existing_variable_inputs.get(key)
            if existing_variable is None:
                session.add(
                    PayVariableInput(
                        year_month=year_month,
                        employee_id=employee.id,
                        item_code=str(variable_sample["item_code"]),
                        direction=str(variable_sample["direction"]),
                        amount=float(variable_sample["amount"]),
                        memo=str(variable_sample["memo"]),
                    )
                )
                continue

            changed = False
            if existing_variable.direction != variable_sample["direction"]:
                existing_variable.direction = str(variable_sample["direction"])
                changed = True
            if existing_variable.amount != variable_sample["amount"]:
                existing_variable.amount = float(variable_sample["amount"])
                changed = True
            if existing_variable.memo != variable_sample["memo"]:
                existing_variable.memo = str(variable_sample["memo"])
                changed = True
            if changed:
                session.add(existing_variable)

    session.commit()


def ensure_hri_form_types(session: Session) -> None:
    for form_code, form_name_ko, module_code, requires_receive, default_priority in HRI_FORM_TYPE_SEEDS:
        existing = session.exec(select(HriFormType).where(HriFormType.form_code == form_code)).first()
        if existing is None:
            session.add(
                HriFormType(
                    form_code=form_code,
                    form_name_ko=form_name_ko,
                    module_code=module_code,
                    requires_receive=requires_receive,
                    is_active=True,
                    allow_draft=True,
                    allow_withdraw=True,
                    default_priority=default_priority,
                )
            )
        else:
            changed = False
            if existing.form_name_ko != form_name_ko:
                existing.form_name_ko = form_name_ko
                changed = True
            if existing.module_code != module_code:
                existing.module_code = module_code
                changed = True
            if existing.requires_receive != requires_receive:
                existing.requires_receive = requires_receive
                changed = True
            if existing.default_priority != default_priority:
                existing.default_priority = default_priority
                changed = True
            if not existing.is_active:
                existing.is_active = True
                changed = True
            if changed:
                session.add(existing)
    session.commit()


def ensure_hri_form_type_policies(session: Session) -> None:
    base_effective = date(2026, 1, 1)
    for form_code, policy_rows in HRI_FORM_TYPE_POLICY_SEEDS.items():
        form_type = session.exec(select(HriFormType).where(HriFormType.form_code == form_code)).first()
        if form_type is None:
            continue
        for policy_key, policy_value in policy_rows:
            existing = session.exec(
                select(HriFormTypePolicy).where(
                    HriFormTypePolicy.form_type_id == form_type.id,
                    HriFormTypePolicy.policy_key == policy_key,
                    HriFormTypePolicy.effective_from == base_effective,
                )
            ).first()
            if existing is None:
                session.add(
                    HriFormTypePolicy(
                        form_type_id=form_type.id,
                        policy_key=policy_key,
                        policy_value=policy_value,
                        effective_from=base_effective,
                        effective_to=None,
                    )
                )
            else:
                if existing.policy_value != policy_value:
                    existing.policy_value = policy_value
                    session.add(existing)
    session.commit()


def ensure_hri_approval_actor_rules(session: Session) -> None:
    for role_code, resolve_method, fallback_rule, position_keywords_json in HRI_APPROVAL_ACTOR_RULE_SEEDS:
        existing = session.exec(select(HriApprovalActorRule).where(HriApprovalActorRule.role_code == role_code)).first()
        if existing is None:
            session.add(
                HriApprovalActorRule(
                    role_code=role_code,
                    resolve_method=resolve_method,
                    fallback_rule=fallback_rule,
                    position_keywords_json=position_keywords_json,
                    is_active=True,
                )
            )
        else:
            changed = False
            if existing.resolve_method != resolve_method:
                existing.resolve_method = resolve_method
                changed = True
            if existing.fallback_rule != fallback_rule:
                existing.fallback_rule = fallback_rule
                changed = True
            if existing.position_keywords_json != position_keywords_json:
                existing.position_keywords_json = position_keywords_json
                changed = True
            if not existing.is_active:
                existing.is_active = True
                changed = True
            if changed:
                session.add(existing)
    session.commit()


def ensure_hri_approval_templates(session: Session) -> None:
    for seed in HRI_APPROVAL_TEMPLATE_SEEDS:
        template = session.exec(
            select(HriApprovalLineTemplate).where(HriApprovalLineTemplate.template_code == seed["template_code"])
        ).first()
        if template is None:
            template = HriApprovalLineTemplate(
                template_code=seed["template_code"],
                template_name=seed["template_name"],
                scope_type=seed["scope_type"],
                scope_id=seed["scope_id"],
                is_default=seed["is_default"],
                is_active=seed["is_active"],
                priority=seed["priority"],
            )
            session.add(template)
            session.flush()
        else:
            template.template_name = seed["template_name"]
            template.scope_type = seed["scope_type"]
            template.scope_id = seed["scope_id"]
            template.is_default = seed["is_default"]
            template.is_active = seed["is_active"]
            template.priority = seed["priority"]
            session.add(template)
            session.flush()

        old_steps = session.exec(
            select(HriApprovalLineStep).where(HriApprovalLineStep.template_id == template.id)
        ).all()
        for old_step in old_steps:
            session.delete(old_step)
        session.flush()

        for step in seed["steps"]:
            session.add(
                HriApprovalLineStep(
                    template_id=template.id,
                    step_order=step["step_order"],
                    step_type=step["step_type"],
                    actor_resolve_type=step["actor_resolve_type"],
                    actor_role_code=step["actor_role_code"],
                    actor_user_id=None,
                    allow_delegate=True,
                    required_action=step["required_action"],
                )
            )

    session.commit()


def ensure_hri_form_type_template_maps(session: Session) -> None:
    effective_from = date(2026, 1, 1)
    for form_code, template_code in HRI_FORM_TYPE_TEMPLATE_MAP_SEEDS:
        form_type = session.exec(select(HriFormType).where(HriFormType.form_code == form_code)).first()
        template = session.exec(
            select(HriApprovalLineTemplate).where(HriApprovalLineTemplate.template_code == template_code)
        ).first()
        if form_type is None or template is None:
            continue

        existing = session.exec(
            select(HriFormTypeApprovalMap).where(
                HriFormTypeApprovalMap.form_type_id == form_type.id,
                HriFormTypeApprovalMap.template_id == template.id,
                HriFormTypeApprovalMap.effective_from == effective_from,
            )
        ).first()
        if existing is None:
            session.add(
                HriFormTypeApprovalMap(
                    form_type_id=form_type.id,
                    template_id=template.id,
                    is_active=True,
                    effective_from=effective_from,
                    effective_to=None,
                )
            )
        else:
            if not existing.is_active:
                existing.is_active = True
                session.add(existing)

    session.commit()


def ensure_hr_recruitment_cycle_seed(session: Session) -> None:
    from app.services.hr_appointment_record_service import confirm_appointment_order

    department_map = {
        row.code: row
        for row in session.exec(select(OrgDepartment).order_by(OrgDepartment.id)).all()
    }
    staging_department = department_map.get("HQ-HR")
    if staging_department is None:
        return

    appointment_codes = {
        row.code: row.id
        for row in session.exec(
            select(AppCode)
            .join(AppCodeGroup, AppCode.group_id == AppCodeGroup.id)
            .where(AppCodeGroup.code == "HR_APPOINTMENT_CODE")
        ).all()
    }
    admin_user = session.exec(select(AuthUser).where(AuthUser.login_id == "admin")).first()
    admin_user_id = admin_user.id if admin_user else None
    existing_finalists = {
        row.candidate_no: row
        for row in session.exec(select(HrRecruitFinalist)).all()
    }

    for seed in HR_RECRUIT_PIPELINE_SEEDS:
        finalist = existing_finalists.get(seed["candidate_no"])
        if finalist is None:
            finalist = HrRecruitFinalist(
                candidate_no=seed["candidate_no"],
                source_type="manual",
                external_key=seed["candidate_no"],
                full_name=seed["full_name"],
                resident_no_masked=seed["resident_no_masked"],
                birth_date=seed["birth_date"],
                phone_mobile=seed["phone_mobile"],
                email=seed["email"],
                hire_type=seed["hire_type"],
                career_years=seed["career_years"],
                login_id=seed["login_id"],
                employee_no=seed["employee_no"],
                expected_join_date=seed["expected_join_date"],
                status_code=seed["status_code"],
                note=seed["note"],
                is_active=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            session.add(finalist)
            session.commit()
            session.refresh(finalist)
            existing_finalists[seed["candidate_no"]] = finalist
        else:
            changed = False
            for field_name in (
                "full_name",
                "resident_no_masked",
                "birth_date",
                "phone_mobile",
                "email",
                "hire_type",
                "career_years",
                "login_id",
                "employee_no",
                "expected_join_date",
                "status_code",
                "note",
            ):
                next_value = seed[field_name]
                if getattr(finalist, field_name) != next_value:
                    setattr(finalist, field_name, next_value)
                    changed = True
            if finalist.source_type != "manual":
                finalist.source_type = "manual"
                changed = True
            if finalist.external_key != seed["candidate_no"]:
                finalist.external_key = seed["candidate_no"]
                changed = True
            if not finalist.is_active:
                finalist.is_active = True
                changed = True
            if changed:
                finalist.updated_at = datetime.utcnow()
                session.add(finalist)
                session.commit()
                session.refresh(finalist)

        if seed["status_code"] != "appointed":
            continue

        target_department = department_map.get(seed["target_department_code"])
        if target_department is None:
            continue

        login_id = str(seed["login_id"] or seed["candidate_no"].lower().replace("-", ""))
        employee_no = str(seed["employee_no"] or seed["candidate_no"].replace("RC-", "EMP-"))
        user = ensure_user(
            session,
            login_id=login_id,
            email=seed["email"],
            password="admin",
            display_name=seed["full_name"],
            reset_password=True,
        )
        ensure_user_roles(session, user, ["employee"])

        employee = session.exec(select(HrEmployee).where(HrEmployee.user_id == user.id)).first()
        if employee is None:
            employee = HrEmployee(
                user_id=user.id,
                employee_no=employee_no,
                department_id=staging_department.id,
                position_title="채용대기",
                hire_date=seed["expected_join_date"],
                employment_status="leave",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            session.add(employee)
            session.commit()
            session.refresh(employee)
        else:
            changed = False
            if employee.employee_no != employee_no:
                employee.employee_no = employee_no
                changed = True
            if employee.hire_date != seed["expected_join_date"]:
                employee.hire_date = seed["expected_join_date"]
                changed = True
            if changed:
                employee.updated_at = datetime.utcnow()
                session.add(employee)
                session.commit()
                session.refresh(employee)

        finalist.login_id = login_id
        finalist.employee_no = employee_no
        finalist.status_code = "appointed"
        finalist.updated_at = datetime.utcnow()
        session.add(finalist)
        session.commit()

        profile = session.exec(
            select(HrEmployeeBasicProfile).where(HrEmployeeBasicProfile.employee_id == employee.id)
        ).first()
        if profile is None:
            profile = HrEmployeeBasicProfile(
                employee_id=employee.id,
                gender=seed["gender"],
                resident_no_masked=seed["resident_no_masked"],
                birth_date=seed["birth_date"],
                probation_end_date=seed["expected_join_date"] + timedelta(days=90),
                job_family=seed["job_family"],
                job_role=seed["target_position_title"],
                grade=seed["target_position_title"],
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
        else:
            profile.gender = seed["gender"]
            profile.resident_no_masked = seed["resident_no_masked"]
            profile.birth_date = seed["birth_date"]
            profile.probation_end_date = seed["expected_join_date"] + timedelta(days=90)
            profile.job_family = seed["job_family"]
            profile.job_role = seed["target_position_title"]
            profile.grade = seed["target_position_title"]
            profile.updated_at = datetime.utcnow()
        session.add(profile)

        contact = session.exec(
            select(HrContactPoint)
            .where(HrContactPoint.employee_id == employee.id, HrContactPoint.contact_type == "채용연락처")
            .order_by(HrContactPoint.id.desc())
        ).first()
        if contact is None:
            contact = HrContactPoint(
                employee_id=employee.id,
                seq=1,
                contact_type="채용연락처",
                record_date=seed["expected_join_date"],
                phone_mobile=seed["phone_mobile"],
                email=seed["email"],
                is_primary=True,
                note="채용 시드 연락처",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
        else:
            contact.record_date = seed["expected_join_date"]
            contact.phone_mobile = seed["phone_mobile"]
            contact.email = seed["email"]
            contact.is_primary = True
            contact.note = "채용 시드 연락처"
            contact.updated_at = datetime.utcnow()
        session.add(contact)

        education = session.exec(
            select(HrEmployeeInfoRecord)
            .where(
                HrEmployeeInfoRecord.employee_id == employee.id,
                HrEmployeeInfoRecord.category == "education",
                HrEmployeeInfoRecord.title == seed["education_name"],
            )
            .order_by(HrEmployeeInfoRecord.id.desc())
        ).first()
        if education is None:
            education = HrEmployeeInfoRecord(
                employee_id=employee.id,
                category="education",
                title=seed["education_name"],
                type="학력",
                organization=seed["target_department_code"],
                value=seed["target_position_title"],
                note="채용 시드 학력",
                record_date=seed["expected_join_date"],
                created_at=datetime.utcnow(),
            )
        else:
            education.type = "학력"
            education.organization = seed["target_department_code"]
            education.value = seed["target_position_title"]
            education.note = "채용 시드 학력"
            education.record_date = seed["expected_join_date"]
        session.add(education)

        if int(seed["career_years"]) > 0:
            career = session.exec(
                select(HrCareer)
                .where(HrCareer.employee_id == employee.id, HrCareer.company_name == "이전직장")
                .order_by(HrCareer.id.desc())
            ).first()
            if career is None:
                career = HrCareer(
                    employee_id=employee.id,
                    seq=1,
                    career_scope="EXTERNAL",
                    company_name="이전직장",
                    department_name=seed["job_family"],
                    position_title=seed["target_position_title"],
                    start_date=seed["expected_join_date"] - timedelta(days=int(seed["career_years"]) * 365),
                    end_date=seed["expected_join_date"] - timedelta(days=1),
                    career_years=int(seed["career_years"]),
                    description="채용 시드 경력",
                    note="채용 시드 경력",
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
            else:
                career.department_name = seed["job_family"]
                career.position_title = seed["target_position_title"]
                career.start_date = seed["expected_join_date"] - timedelta(days=int(seed["career_years"]) * 365)
                career.end_date = seed["expected_join_date"] - timedelta(days=1)
                career.career_years = int(seed["career_years"])
                career.description = "채용 시드 경력"
                career.note = "채용 시드 경력"
                career.updated_at = datetime.utcnow()
            session.add(career)

        session.commit()

        appointment_no = f"APT-SEED-{seed['candidate_no'][-4:]}"
        order = session.exec(
            select(HrAppointmentOrder).where(HrAppointmentOrder.appointment_no == appointment_no)
        ).first()
        if order is None:
            order = HrAppointmentOrder(
                appointment_no=appointment_no,
                appointment_code_id=appointment_codes.get("CAREER_HIRE" if seed["hire_type"] == "experienced" else "NEW_HIRE"),
                title=f"{seed['full_name']} 입사발령",
                description="채용 파이프라인 시드 발령",
                effective_date=seed["expected_join_date"],
                status="draft",
                created_by=admin_user_id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            session.add(order)
            session.commit()
            session.refresh(order)

        item = session.exec(
            select(HrAppointmentOrderItem)
            .where(HrAppointmentOrderItem.order_id == order.id, HrAppointmentOrderItem.employee_id == employee.id)
        ).first()
        if item is None:
            item = HrAppointmentOrderItem(
                order_id=order.id,
                employee_id=employee.id,
                appointment_code_id=appointment_codes.get("CAREER_HIRE" if seed["hire_type"] == "experienced" else "NEW_HIRE"),
                appointment_kind="permanent",
                action_type="JOIN",
                start_date=seed["expected_join_date"],
                end_date=None,
                from_department_id=staging_department.id,
                to_department_id=target_department.id,
                from_position_title="채용대기",
                to_position_title=seed["target_position_title"],
                from_employment_status="leave",
                to_employment_status="active",
                apply_status="pending",
                note="채용 시드 입사발령",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            session.add(item)
            session.commit()
            session.refresh(item)

        if order.status == "draft" and admin_user_id is not None:
            confirm_appointment_order(session, order.id, admin_user_id)


def ensure_pay_welfare_allowance_definitions(session: Session) -> None:
    extra_items = [
        ("SCHOLARSHIP_GRANT", "학자금지원", "allowance", "taxable", "fixed", 210),
        ("CONDOLENCE_GRANT", "경조금", "allowance", "taxable", "fixed", 220),
        ("MEDICAL_GRANT", "의료비지원", "allowance", "taxable", "fixed", 230),
        ("LOAN_REPAY", "사내대출상환", "deduction", "tax", "fixed", 310),
        ("PENSION_DEDUCT", "개인연금공제", "deduction", "tax", "fixed", 320),
        ("CLUB_DEDUCT", "동호회공제", "deduction", "tax", "fixed", 330),
    ]

    for code, name, item_type, tax_type, calc_type, sort_order in extra_items:
        row = session.exec(select(PayAllowanceDeduction).where(PayAllowanceDeduction.code == code)).first()
        if row is None:
            session.add(
                PayAllowanceDeduction(
                    code=code,
                    name=name,
                    type=item_type,
                    tax_type=tax_type,
                    calculation_type=calc_type,
                    is_active=True,
                    sort_order=sort_order,
                )
            )
            continue

        changed = False
        if row.name != name:
            row.name = name
            changed = True
        if row.type != item_type:
            row.type = item_type
            changed = True
        if row.tax_type != tax_type:
            row.tax_type = tax_type
            changed = True
        if row.calculation_type != calc_type:
            row.calculation_type = calc_type
            changed = True
        if row.sort_order != sort_order:
            row.sort_order = sort_order
            changed = True
        if not row.is_active:
            row.is_active = True
            changed = True
        if changed:
            session.add(row)

    session.commit()


def ensure_schedule_operational_samples(session: Session) -> None:
    from app.schemas.tim_schedule import TimScheduleGenerateRequest
    from app.services.tim_schedule_service import generate_employee_daily_schedules

    pattern_configs = [
        {
            "code": "PTN_DEPT_STD",
            "name": "부서기본 근무(09-18)",
            "priority": 100,
            "selector": lambda index: True,
            "days": {
                0: (True, "09:00", "18:00", 60, 480, False),
                1: (True, "09:00", "18:00", 60, 480, False),
                2: (True, "09:00", "18:00", 60, 480, False),
                3: (True, "09:00", "18:00", 60, 480, False),
                4: (True, "09:00", "18:00", 60, 480, False),
                5: (False, None, None, 0, 0, False),
                6: (False, None, None, 0, 0, False),
            },
        },
        {
            "code": "PTN_FLEX_0830",
            "name": "유연근무(08:30-17:30)",
            "priority": 220,
            "selector": lambda index: index % 3 == 0,
            "days": {
                0: (True, "08:30", "17:30", 60, 480, False),
                1: (True, "08:30", "17:30", 60, 480, False),
                2: (True, "08:30", "17:30", 60, 480, False),
                3: (True, "08:30", "17:30", 60, 480, False),
                4: (True, "08:30", "17:30", 60, 480, False),
                5: (False, None, None, 0, 0, False),
                6: (False, None, None, 0, 0, False),
            },
        },
        {
            "code": "PTN_SHIFT_1300",
            "name": "후반조(13:00-22:00)",
            "priority": 240,
            "selector": lambda index: index % 5 == 0,
            "days": {
                0: (True, "13:00", "22:00", 60, 480, False),
                1: (True, "13:00", "22:00", 60, 480, False),
                2: (True, "13:00", "22:00", 60, 480, False),
                3: (True, "13:00", "22:00", 60, 480, False),
                4: (True, "13:00", "22:00", 60, 480, False),
                5: (False, None, None, 0, 0, False),
                6: (False, None, None, 0, 0, False),
            },
        },
    ]

    pattern_map: dict[str, TimSchedulePattern] = {}
    for config in pattern_configs:
        pattern = session.exec(select(TimSchedulePattern).where(TimSchedulePattern.code == config["code"])).first()
        if pattern is None:
            pattern = TimSchedulePattern(code=config["code"], name=config["name"], is_active=True)
        else:
            pattern.name = config["name"]
            pattern.is_active = True
        session.add(pattern)
        session.commit()
        session.refresh(pattern)
        pattern_map[config["code"]] = pattern

        for weekday, values in config["days"].items():
            is_workday, start_time, end_time, break_minutes, expected_minutes, is_overnight = values
            pattern_day = session.exec(
                select(TimSchedulePatternDay).where(
                    TimSchedulePatternDay.pattern_id == pattern.id,
                    TimSchedulePatternDay.weekday == weekday,
                )
            ).first()
            if pattern_day is None:
                pattern_day = TimSchedulePatternDay(
                    pattern_id=pattern.id,
                    weekday=weekday,
                    is_workday=is_workday,
                    start_time=start_time,
                    end_time=end_time,
                    break_minutes=break_minutes,
                    expected_minutes=expected_minutes,
                    is_overnight=is_overnight,
                )
            else:
                pattern_day.is_workday = is_workday
                pattern_day.start_time = start_time
                pattern_day.end_time = end_time
                pattern_day.break_minutes = break_minutes
                pattern_day.expected_minutes = expected_minutes
                pattern_day.is_overnight = is_overnight
            session.add(pattern_day)
        session.commit()

    departments = session.exec(select(OrgDepartment).order_by(OrgDepartment.code)).all()
    existing_assignments = {
        (row.department_id, row.pattern_id, row.effective_from, row.priority): row
        for row in session.exec(select(TimDepartmentScheduleAssignment)).all()
    }
    current_month_start = date.today().replace(day=1)
    for index, department in enumerate(departments, start=1):
        expected_pattern = pattern_map["PTN_DEPT_STD"]
        expected_priority = 100
        for config in pattern_configs[1:]:
            if config["selector"](index):
                expected_pattern = pattern_map[config["code"]]
                expected_priority = int(config["priority"])

        key = (department.id, expected_pattern.id, current_month_start, expected_priority)
        row = existing_assignments.get(key)
        if row is None:
            session.add(
                TimDepartmentScheduleAssignment(
                    department_id=department.id,
                    pattern_id=expected_pattern.id,
                    effective_from=current_month_start,
                    effective_to=None,
                    priority=expected_priority,
                    is_active=True,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
            )
        else:
            if not row.is_active:
                row.is_active = True
                row.updated_at = datetime.utcnow()
                session.add(row)
    session.commit()

    employees = session.exec(
        select(HrEmployee)
        .where(HrEmployee.employment_status == "active")
        .order_by(HrEmployee.id)
    ).all()
    existing_exception_map = {
        row.reason: row
        for row in session.exec(select(TimEmployeeScheduleException)).all()
        if row.reason
    }
    pattern_cycle = [pattern_map["PTN_FLEX_0830"], pattern_map["PTN_SHIFT_1300"]]
    for index, employee in enumerate(employees[: min(180, len(employees))], start=1):
        reason = f"SEED-TIM-EXCEPTION-{index:04d}"
        pattern = pattern_cycle[(index - 1) % len(pattern_cycle)]
        row = existing_exception_map.get(reason)
        if row is None:
            session.add(
                TimEmployeeScheduleException(
                    employee_id=employee.id,
                    pattern_id=pattern.id,
                    effective_from=current_month_start + timedelta(days=(index - 1) % 7),
                    effective_to=current_month_start + timedelta(days=14 + ((index - 1) % 5)),
                    reason=reason,
                    priority=1000 + index,
                    is_active=True,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
            )
            continue

        row.employee_id = employee.id
        row.pattern_id = pattern.id
        row.effective_from = current_month_start + timedelta(days=(index - 1) % 7)
        row.effective_to = current_month_start + timedelta(days=14 + ((index - 1) % 5))
        row.priority = 1000 + index
        row.is_active = True
        row.updated_at = datetime.utcnow()
        session.add(row)
    session.commit()

    generate_employee_daily_schedules(
        session,
        TimScheduleGenerateRequest(
            target="all",
            date_from=current_month_start,
            date_to=(current_month_start + timedelta(days=31)).replace(day=1) - timedelta(days=1),
            mode="overwrite",
        ),
    )


def ensure_payroll_run_result_samples(session: Session) -> None:
    from app.schemas.payroll_phase2 import PayPayrollRunCreateRequest
    from app.services.payroll_phase2_service import (
        calculate_payroll_run,
        close_payroll_run,
        create_payroll_run,
        mark_payroll_run_paid,
    )

    payroll_code = session.exec(select(PayPayrollCode).where(PayPayrollCode.code == "P100")).first()
    if payroll_code is None:
        return

    month_start = date.today().replace(day=1)
    previous_month_start = (month_start - timedelta(days=1)).replace(day=1)
    run_specs = [
        {"year_month": previous_month_start.strftime("%Y-%m"), "run_name": "시드 정기급여 마감본", "target_status": "paid"},
        {"year_month": month_start.strftime("%Y-%m"), "run_name": "시드 정기급여 계산본", "target_status": "calculated"},
    ]

    for spec in run_specs:
        run = session.exec(
            select(PayPayrollRun).where(
                PayPayrollRun.year_month == spec["year_month"],
                PayPayrollRun.payroll_code_id == payroll_code.id,
            )
        ).first()

        if run is None:
            created = create_payroll_run(
                session,
                PayPayrollRunCreateRequest(
                    year_month=spec["year_month"],
                    payroll_code_id=payroll_code.id,
                    run_name=spec["run_name"],
                ),
            )
            run = session.get(PayPayrollRun, created.run.id)

        if run is None:
            continue

        if run.run_name != spec["run_name"]:
            run.run_name = spec["run_name"]
            run.updated_at = datetime.utcnow()
            session.add(run)
            session.commit()
            session.refresh(run)

        if run.status in {"closed", "paid"} and spec["target_status"] == "calculated":
            continue

        if run.status in {"draft", "calculated"}:
            calculate_payroll_run(session, run.id)
            run = session.get(PayPayrollRun, run.id)

        if run is None:
            continue

        if spec["target_status"] == "paid":
            if run.status == "calculated":
                close_payroll_run(session, run.id)
                run = session.get(PayPayrollRun, run.id)
            if run is not None and run.status == "closed":
                mark_payroll_run_paid(session, run.id)

def _serialize_seed_content(content: dict[str, object]) -> str:
    return json.dumps(content, ensure_ascii=False, separators=(",", ":"))


def _upsert_hri_request_sample(
    session: Session,
    *,
    request_no: str,
    form_type_id: int,
    requester_id: int,
    requester_org_id: int | None,
    title: str,
    status_code: str,
    content: dict[str, object],
    current_step_order: int | None,
    submitted_at: datetime | None,
    completed_at: datetime | None,
    created_at: datetime,
    updated_at: datetime,
    steps: list[dict[str, object]],
) -> HriRequestMaster:
    row = session.exec(
        select(HriRequestMaster).where(HriRequestMaster.request_no == request_no)
    ).first()
    if row is None:
        row = HriRequestMaster(
            request_no=request_no,
            form_type_id=form_type_id,
            requester_id=requester_id,
            requester_org_id=requester_org_id,
            title=title,
            content_json=_serialize_seed_content(content),
            status_code=status_code,
            current_step_order=current_step_order,
            submitted_at=submitted_at,
            completed_at=completed_at,
            created_at=created_at,
            updated_at=updated_at,
        )
        session.add(row)
        session.flush()
    else:
        row.form_type_id = form_type_id
        row.requester_id = requester_id
        row.requester_org_id = requester_org_id
        row.title = title
        row.content_json = _serialize_seed_content(content)
        row.status_code = status_code
        row.current_step_order = current_step_order
        row.submitted_at = submitted_at
        row.completed_at = completed_at
        row.created_at = created_at
        row.updated_at = updated_at
        session.add(row)
        session.flush()

    existing_steps = session.exec(
        select(HriRequestStepSnapshot).where(HriRequestStepSnapshot.request_id == row.id)
    ).all()
    for existing_step in existing_steps:
        session.delete(existing_step)
    session.flush()

    for step in steps:
        session.add(
            HriRequestStepSnapshot(
                request_id=row.id,
                step_order=int(step["step_order"]),
                step_type=str(step["step_type"]),
                actor_user_id=int(step["actor_user_id"]),
                actor_name=str(step["actor_name"]),
                actor_org_id=step.get("actor_org_id"),
                actor_role_code=step.get("actor_role_code"),
                action_status=str(step["action_status"]),
                acted_at=step.get("acted_at"),
                comment=step.get("comment"),
                created_at=created_at,
                updated_at=updated_at,
            )
        )

    return row


def ensure_hri_request_samples(session: Session) -> None:
    requester_user = session.exec(
        select(AuthUser).where(AuthUser.login_id == "admin")
    ).first()
    if requester_user is None:
        return

    requester_employee = session.exec(
        select(HrEmployee).where(HrEmployee.user_id == requester_user.id)
    ).first()
    if requester_employee is None:
        return

    actor_user = requester_user
    actor_employee = requester_employee

    form_types = {
        row.form_code: row
        for row in session.exec(
            select(HriFormType).where(
                HriFormType.form_code.in_(["LEAVE_REQUEST", "WEL_BENEFIT_REQUEST"])
            )
        ).all()
    }
    leave_form = form_types.get("LEAVE_REQUEST")
    welfare_form = form_types.get("WEL_BENEFIT_REQUEST")
    if leave_form is None or welfare_form is None:
        return

    benefit_type = session.exec(
        select(WelBenefitType)
        .where(WelBenefitType.is_active == True)  # noqa: E712
        .order_by(WelBenefitType.sort_order, WelBenefitType.id)
    ).first()
    if benefit_type is None:
        return

    actor_org_id = actor_employee.department_id if actor_employee else requester_employee.department_id
    actor_name = actor_user.display_name
    base_created_at = datetime(2026, 3, 13, 9, 0, 0)

    samples = [
        {
            "request_no": "HRI-LEAVE-260313-01",
            "form_type": leave_form,
            "title": "3월 연차 임시저장",
            "status_code": "DRAFT",
            "current_step_order": None,
            "submitted_at": None,
            "completed_at": None,
            "content": {
                "leave_type_code": "ANNUAL",
                "start_date": "2026-03-20",
                "end_date": "2026-03-20",
                "start_time": None,
                "end_time": None,
                "applied_minutes": 480,
                "reason": "가족 일정",
            },
            "steps": [],
            "created_at": base_created_at,
        },
        {
            "request_no": "HRI-LEAVE-260313-02",
            "form_type": leave_form,
            "title": "3월 반차 승인대기",
            "status_code": "APPROVAL_IN_PROGRESS",
            "current_step_order": 1,
            "submitted_at": base_created_at + timedelta(minutes=10),
            "completed_at": None,
            "content": {
                "leave_type_code": "HALF_AM",
                "start_date": "2026-03-24",
                "end_date": "2026-03-24",
                "start_time": "09:00",
                "end_time": "13:00",
                "applied_minutes": 240,
                "reason": "병원 진료",
            },
            "steps": [
                {
                    "step_order": 1,
                    "step_type": "APPROVAL",
                    "actor_user_id": actor_user.id,
                    "actor_name": actor_name,
                    "actor_org_id": actor_org_id,
                    "actor_role_code": "TEAM_LEADER",
                    "action_status": "WAITING",
                    "acted_at": None,
                    "comment": None,
                }
            ],
            "created_at": base_created_at + timedelta(minutes=5),
        },
        {
            "request_no": "HRI-LEAVE-260313-03",
            "form_type": leave_form,
            "title": "3월 휴가 반려",
            "status_code": "APPROVAL_REJECTED",
            "current_step_order": None,
            "submitted_at": base_created_at + timedelta(minutes=20),
            "completed_at": None,
            "content": {
                "leave_type_code": "ANNUAL",
                "start_date": "2026-03-28",
                "end_date": "2026-03-28",
                "start_time": None,
                "end_time": None,
                "applied_minutes": 480,
                "reason": "개인 일정",
            },
            "steps": [
                {
                    "step_order": 1,
                    "step_type": "APPROVAL",
                    "actor_user_id": actor_user.id,
                    "actor_name": actor_name,
                    "actor_org_id": actor_org_id,
                    "actor_role_code": "TEAM_LEADER",
                    "action_status": "REJECTED",
                    "acted_at": base_created_at + timedelta(minutes=25),
                    "comment": "업무 일정과 중복",
                }
            ],
            "created_at": base_created_at + timedelta(minutes=15),
        },
        {
            "request_no": "HRI-LEAVE-260313-04",
            "form_type": leave_form,
            "title": "4월 연차 완료",
            "status_code": "COMPLETED",
            "current_step_order": None,
            "submitted_at": base_created_at + timedelta(minutes=30),
            "completed_at": base_created_at + timedelta(minutes=40),
            "content": {
                "leave_type_code": "ANNUAL",
                "start_date": "2026-04-03",
                "end_date": "2026-04-03",
                "start_time": None,
                "end_time": None,
                "applied_minutes": 480,
                "reason": "개인 정비",
            },
            "steps": [
                {
                    "step_order": 1,
                    "step_type": "APPROVAL",
                    "actor_user_id": actor_user.id,
                    "actor_name": actor_name,
                    "actor_org_id": actor_org_id,
                    "actor_role_code": "TEAM_LEADER",
                    "action_status": "APPROVED",
                    "acted_at": base_created_at + timedelta(minutes=40),
                    "comment": "승인",
                }
            ],
            "created_at": base_created_at + timedelta(minutes=25),
        },
        {
            "request_no": "HRI-WEL-260313-01",
            "form_type": welfare_form,
            "title": "복리후생 초안 샘플",
            "status_code": "DRAFT",
            "current_step_order": None,
            "submitted_at": None,
            "completed_at": None,
            "content": {
                "benefit_type_code": benefit_type.code,
                "benefit_type_name": benefit_type.name,
                "requested_amount": 120000,
                "description": "복리후생 신청 초안",
                "reason": "샘플 데이터",
            },
            "steps": [],
            "created_at": base_created_at + timedelta(minutes=45),
        },
        {
            "request_no": "HRI-WEL-260313-02",
            "form_type": welfare_form,
            "title": "복리후생 승인대기",
            "status_code": "APPROVAL_IN_PROGRESS",
            "current_step_order": 1,
            "submitted_at": base_created_at + timedelta(minutes=55),
            "completed_at": None,
            "content": {
                "benefit_type_code": benefit_type.code,
                "benefit_type_name": benefit_type.name,
                "requested_amount": 180000,
                "description": "복리후생 지원금 신청",
                "reason": "복지 포인트 사용",
            },
            "steps": [
                {
                    "step_order": 1,
                    "step_type": "APPROVAL",
                    "actor_user_id": actor_user.id,
                    "actor_name": actor_name,
                    "actor_org_id": actor_org_id,
                    "actor_role_code": "TEAM_LEADER",
                    "action_status": "WAITING",
                    "acted_at": None,
                    "comment": None,
                }
            ],
            "created_at": base_created_at + timedelta(minutes=50),
        },
        {
            "request_no": "HRI-WEL-260313-05",
            "form_type": welfare_form,
            "title": "복리후생 수신대기",
            "status_code": "RECEIVE_IN_PROGRESS",
            "current_step_order": 3,
            "submitted_at": base_created_at + timedelta(minutes=62),
            "completed_at": None,
            "content": {
                "benefit_type_code": benefit_type.code,
                "benefit_type_name": benefit_type.name,
                "requested_amount": 210000,
                "description": "복리후생 수신 처리 대기",
                "reason": "정산 반영 전 대기",
            },
            "steps": [
                {
                    "step_order": 1,
                    "step_type": "APPROVAL",
                    "actor_user_id": actor_user.id,
                    "actor_name": actor_name,
                    "actor_org_id": actor_org_id,
                    "actor_role_code": "TEAM_LEADER",
                    "action_status": "APPROVED",
                    "acted_at": base_created_at + timedelta(minutes=64),
                    "comment": "승인",
                },
                {
                    "step_order": 2,
                    "step_type": "APPROVAL",
                    "actor_user_id": actor_user.id,
                    "actor_name": actor_name,
                    "actor_org_id": actor_org_id,
                    "actor_role_code": "DEPT_HEAD",
                    "action_status": "APPROVED",
                    "acted_at": base_created_at + timedelta(minutes=66),
                    "comment": "승인",
                },
                {
                    "step_order": 3,
                    "step_type": "RECEIVE",
                    "actor_user_id": actor_user.id,
                    "actor_name": actor_name,
                    "actor_org_id": actor_org_id,
                    "actor_role_code": "HR_ADMIN",
                    "action_status": "WAITING",
                    "acted_at": None,
                    "comment": None,
                },
            ],
            "created_at": base_created_at + timedelta(minutes=58),
        },
        {
            "request_no": "HRI-WEL-260313-03",
            "form_type": welfare_form,
            "title": "복리후생 수신반려",
            "status_code": "RECEIVE_REJECTED",
            "current_step_order": None,
            "submitted_at": base_created_at + timedelta(minutes=65),
            "completed_at": None,
            "content": {
                "benefit_type_code": benefit_type.code,
                "benefit_type_name": benefit_type.name,
                "requested_amount": 240000,
                "description": "복리후생 반영 실패 예시",
                "reason": "증빙 누락",
            },
            "steps": [
                {
                    "step_order": 1,
                    "step_type": "APPROVAL",
                    "actor_user_id": actor_user.id,
                    "actor_name": actor_name,
                    "actor_org_id": actor_org_id,
                    "actor_role_code": "TEAM_LEADER",
                    "action_status": "APPROVED",
                    "acted_at": base_created_at + timedelta(minutes=70),
                    "comment": "승인",
                },
                {
                    "step_order": 2,
                    "step_type": "APPROVAL",
                    "actor_user_id": actor_user.id,
                    "actor_name": actor_name,
                    "actor_org_id": actor_org_id,
                    "actor_role_code": "DEPT_HEAD",
                    "action_status": "APPROVED",
                    "acted_at": base_created_at + timedelta(minutes=75),
                    "comment": "승인",
                },
                {
                    "step_order": 3,
                    "step_type": "RECEIVE",
                    "actor_user_id": actor_user.id,
                    "actor_name": actor_name,
                    "actor_org_id": actor_org_id,
                    "actor_role_code": "HR_ADMIN",
                    "action_status": "REJECTED",
                    "acted_at": base_created_at + timedelta(minutes=80),
                    "comment": "증빙 보완 필요",
                },
            ],
            "created_at": base_created_at + timedelta(minutes=60),
        },
        {
            "request_no": "HRI-WEL-260313-04",
            "form_type": welfare_form,
            "title": "복리후생 완료",
            "status_code": "COMPLETED",
            "current_step_order": None,
            "submitted_at": base_created_at + timedelta(minutes=85),
            "completed_at": base_created_at + timedelta(minutes=100),
            "content": {
                "benefit_type_code": benefit_type.code,
                "benefit_type_name": benefit_type.name,
                "requested_amount": 300000,
                "description": "복리후생 반영 완료 예시",
                "reason": "정상 반영",
            },
            "steps": [
                {
                    "step_order": 1,
                    "step_type": "APPROVAL",
                    "actor_user_id": actor_user.id,
                    "actor_name": actor_name,
                    "actor_org_id": actor_org_id,
                    "actor_role_code": "TEAM_LEADER",
                    "action_status": "APPROVED",
                    "acted_at": base_created_at + timedelta(minutes=90),
                    "comment": "승인",
                },
                {
                    "step_order": 2,
                    "step_type": "APPROVAL",
                    "actor_user_id": actor_user.id,
                    "actor_name": actor_name,
                    "actor_org_id": actor_org_id,
                    "actor_role_code": "DEPT_HEAD",
                    "action_status": "APPROVED",
                    "acted_at": base_created_at + timedelta(minutes=95),
                    "comment": "승인",
                },
                {
                    "step_order": 3,
                    "step_type": "RECEIVE",
                    "actor_user_id": actor_user.id,
                    "actor_name": actor_name,
                    "actor_org_id": actor_org_id,
                    "actor_role_code": "HR_ADMIN",
                    "action_status": "RECEIVED",
                    "acted_at": base_created_at + timedelta(minutes=100),
                    "comment": "반영 완료",
                },
            ],
            "created_at": base_created_at + timedelta(minutes=82),
        },
    ]

    for sample in samples:
        request = _upsert_hri_request_sample(
            session,
            request_no=str(sample["request_no"]),
            form_type_id=sample["form_type"].id,
            requester_id=requester_user.id,
            requester_org_id=requester_employee.department_id,
            title=str(sample["title"]),
            status_code=str(sample["status_code"]),
            content=sample["content"],
            current_step_order=sample["current_step_order"],
            submitted_at=sample["submitted_at"],
            completed_at=sample["completed_at"],
            created_at=sample["created_at"],
            updated_at=sample["completed_at"] or sample["submitted_at"] or sample["created_at"],
            steps=sample["steps"],
        )

        if sample["form_type"].form_code != "LEAVE_REQUEST":
            continue

        detail = session.exec(
            select(HriReqLeave).where(HriReqLeave.request_id == request.id)
        ).first()
        content = sample["content"]
        if detail is None:
            detail = HriReqLeave(
                request_id=request.id,
                leave_type_code=str(content["leave_type_code"]),
                start_date=date.fromisoformat(str(content["start_date"])),
                end_date=date.fromisoformat(str(content["end_date"])),
                start_time=content.get("start_time"),
                end_time=content.get("end_time"),
                applied_minutes=int(content["applied_minutes"]),
                reason=str(content["reason"]),
                created_at=sample["created_at"],
                updated_at=sample["completed_at"] or sample["submitted_at"] or sample["created_at"],
            )
        else:
            detail.leave_type_code = str(content["leave_type_code"])
            detail.start_date = date.fromisoformat(str(content["start_date"]))
            detail.end_date = date.fromisoformat(str(content["end_date"]))
            detail.start_time = content.get("start_time")
            detail.end_time = content.get("end_time")
            detail.applied_minutes = int(content["applied_minutes"])
            detail.reason = str(content["reason"])
            detail.created_at = sample["created_at"]
            detail.updated_at = sample["completed_at"] or sample["submitted_at"] or sample["created_at"]
        session.add(detail)

    benefit_types = session.exec(
        select(WelBenefitType)
        .where(WelBenefitType.is_active == True)  # noqa: E712
        .order_by(WelBenefitType.sort_order, WelBenefitType.id)
    ).all()
    active_employees = session.exec(
        select(HrEmployee)
        .where(HrEmployee.employment_status == "active")
        .order_by(HrEmployee.id)
    ).all()
    user_by_id = {
        row.id: row
        for row in session.exec(
            select(AuthUser).where(AuthUser.id.in_([employee.user_id for employee in active_employees]))
        ).all()
    }

    for index, employee in enumerate(active_employees[: min(HRI_BULK_REQUEST_TARGET, len(active_employees))], start=1):
        requester = user_by_id.get(employee.user_id)
        if requester is None:
            continue

        created_at = base_created_at - timedelta(days=index % 45) + timedelta(minutes=index % 60)
        submitted_at = created_at + timedelta(minutes=12)
        completed_at = submitted_at + timedelta(minutes=18)
        is_leave_request = index % 2 == 1

        if is_leave_request:
            form_type = leave_form
            request_no = f"HRI-BULK-LEAVE-{index:05d}"
            leave_type_code = ["ANNUAL", "HALF_AM", "SICK", "ANNUAL"][index % 4]
            start_date = (base_created_at.date() + timedelta(days=(index % 35) + 3)).isoformat()
            end_date = start_date
            status_code = ("DRAFT", "APPROVAL_IN_PROGRESS", "APPROVAL_REJECTED", "COMPLETED")[(index - 1) % 4]
            content = {
                "leave_type_code": leave_type_code,
                "start_date": start_date,
                "end_date": end_date,
                "start_time": "09:00" if leave_type_code == "HALF_AM" else None,
                "end_time": "13:00" if leave_type_code == "HALF_AM" else None,
                "applied_minutes": 240 if leave_type_code == "HALF_AM" else 480,
                "reason": f"SEED-HRI-LEAVE-{index:05d}",
            }
            if status_code == "DRAFT":
                current_step_order = None
                submitted_value = None
                completed_value = None
                steps: list[dict[str, object]] = []
            elif status_code == "APPROVAL_IN_PROGRESS":
                current_step_order = 1
                submitted_value = submitted_at
                completed_value = None
                steps = [
                    {
                        "step_order": 1,
                        "step_type": "APPROVAL",
                        "actor_user_id": actor_user.id,
                        "actor_name": actor_name,
                        "actor_org_id": actor_org_id,
                        "actor_role_code": "TEAM_LEADER",
                        "action_status": "WAITING",
                        "acted_at": None,
                        "comment": None,
                    }
                ]
            elif status_code == "APPROVAL_REJECTED":
                current_step_order = None
                submitted_value = submitted_at
                completed_value = None
                steps = [
                    {
                        "step_order": 1,
                        "step_type": "APPROVAL",
                        "actor_user_id": actor_user.id,
                        "actor_name": actor_name,
                        "actor_org_id": actor_org_id,
                        "actor_role_code": "TEAM_LEADER",
                        "action_status": "REJECTED",
                        "acted_at": completed_at,
                        "comment": "시드 반려",
                    }
                ]
            else:
                current_step_order = None
                submitted_value = submitted_at
                completed_value = completed_at
                steps = [
                    {
                        "step_order": 1,
                        "step_type": "APPROVAL",
                        "actor_user_id": actor_user.id,
                        "actor_name": actor_name,
                        "actor_org_id": actor_org_id,
                        "actor_role_code": "TEAM_LEADER",
                        "action_status": "APPROVED",
                        "acted_at": completed_at,
                        "comment": "시드 승인",
                    }
                ]
            title = f"통합신청 연차 시드 {index:05d}"
        else:
            form_type = welfare_form
            request_no = f"HRI-BULK-WEL-{index:05d}"
            benefit_row = benefit_types[(index - 1) % len(benefit_types)] if benefit_types else benefit_type
            status_code = (
                "DRAFT",
                "APPROVAL_IN_PROGRESS",
                "RECEIVE_IN_PROGRESS",
                "RECEIVE_REJECTED",
                "COMPLETED",
            )[(index - 1) % 5]
            content = {
                "benefit_type_code": benefit_row.code,
                "benefit_type_name": benefit_row.name,
                "requested_amount": 80_000 + ((index - 1) % 15) * 45_000,
                "description": f"SEED-HRI-WEL-{index:05d}",
                "reason": "bulk welfare request",
            }
            if status_code == "DRAFT":
                current_step_order = None
                submitted_value = None
                completed_value = None
                steps = []
            elif status_code == "APPROVAL_IN_PROGRESS":
                current_step_order = 1
                submitted_value = submitted_at
                completed_value = None
                steps = [
                    {
                        "step_order": 1,
                        "step_type": "APPROVAL",
                        "actor_user_id": actor_user.id,
                        "actor_name": actor_name,
                        "actor_org_id": actor_org_id,
                        "actor_role_code": "TEAM_LEADER",
                        "action_status": "WAITING",
                        "acted_at": None,
                        "comment": None,
                    }
                ]
            elif status_code == "RECEIVE_IN_PROGRESS":
                current_step_order = 3
                submitted_value = submitted_at
                completed_value = None
                steps = [
                    {
                        "step_order": 1,
                        "step_type": "APPROVAL",
                        "actor_user_id": actor_user.id,
                        "actor_name": actor_name,
                        "actor_org_id": actor_org_id,
                        "actor_role_code": "TEAM_LEADER",
                        "action_status": "APPROVED",
                        "acted_at": submitted_at + timedelta(minutes=5),
                        "comment": "시드 승인",
                    },
                    {
                        "step_order": 2,
                        "step_type": "APPROVAL",
                        "actor_user_id": actor_user.id,
                        "actor_name": actor_name,
                        "actor_org_id": actor_org_id,
                        "actor_role_code": "DEPT_HEAD",
                        "action_status": "APPROVED",
                        "acted_at": submitted_at + timedelta(minutes=10),
                        "comment": "시드 승인",
                    },
                    {
                        "step_order": 3,
                        "step_type": "RECEIVE",
                        "actor_user_id": actor_user.id,
                        "actor_name": actor_name,
                        "actor_org_id": actor_org_id,
                        "actor_role_code": "HR_ADMIN",
                        "action_status": "WAITING",
                        "acted_at": None,
                        "comment": None,
                    },
                ]
            elif status_code == "RECEIVE_REJECTED":
                current_step_order = None
                submitted_value = submitted_at
                completed_value = None
                steps = [
                    {
                        "step_order": 1,
                        "step_type": "APPROVAL",
                        "actor_user_id": actor_user.id,
                        "actor_name": actor_name,
                        "actor_org_id": actor_org_id,
                        "actor_role_code": "TEAM_LEADER",
                        "action_status": "APPROVED",
                        "acted_at": submitted_at + timedelta(minutes=5),
                        "comment": "시드 승인",
                    },
                    {
                        "step_order": 2,
                        "step_type": "APPROVAL",
                        "actor_user_id": actor_user.id,
                        "actor_name": actor_name,
                        "actor_org_id": actor_org_id,
                        "actor_role_code": "DEPT_HEAD",
                        "action_status": "APPROVED",
                        "acted_at": submitted_at + timedelta(minutes=10),
                        "comment": "시드 승인",
                    },
                    {
                        "step_order": 3,
                        "step_type": "RECEIVE",
                        "actor_user_id": actor_user.id,
                        "actor_name": actor_name,
                        "actor_org_id": actor_org_id,
                        "actor_role_code": "HR_ADMIN",
                        "action_status": "REJECTED",
                        "acted_at": completed_at,
                        "comment": "시드 반려",
                    },
                ]
            else:
                current_step_order = None
                submitted_value = submitted_at
                completed_value = completed_at
                steps = [
                    {
                        "step_order": 1,
                        "step_type": "APPROVAL",
                        "actor_user_id": actor_user.id,
                        "actor_name": actor_name,
                        "actor_org_id": actor_org_id,
                        "actor_role_code": "TEAM_LEADER",
                        "action_status": "APPROVED",
                        "acted_at": submitted_at + timedelta(minutes=5),
                        "comment": "시드 승인",
                    },
                    {
                        "step_order": 2,
                        "step_type": "APPROVAL",
                        "actor_user_id": actor_user.id,
                        "actor_name": actor_name,
                        "actor_org_id": actor_org_id,
                        "actor_role_code": "DEPT_HEAD",
                        "action_status": "APPROVED",
                        "acted_at": submitted_at + timedelta(minutes=10),
                        "comment": "시드 승인",
                    },
                    {
                        "step_order": 3,
                        "step_type": "RECEIVE",
                        "actor_user_id": actor_user.id,
                        "actor_name": actor_name,
                        "actor_org_id": actor_org_id,
                        "actor_role_code": "HR_ADMIN",
                        "action_status": "RECEIVED",
                        "acted_at": completed_at,
                        "comment": "시드 수신 완료",
                    },
                ]
            title = f"통합신청 복리후생 시드 {index:05d}"

        request = _upsert_hri_request_sample(
            session,
            request_no=request_no,
            form_type_id=form_type.id,
            requester_id=requester.id,
            requester_org_id=employee.department_id,
            title=title,
            status_code=status_code,
            content=content,
            current_step_order=current_step_order,
            submitted_at=submitted_value,
            completed_at=completed_value,
            created_at=created_at,
            updated_at=completed_value or submitted_value or created_at,
            steps=steps,
        )

        if not is_leave_request:
            continue

        leave_detail = session.exec(
            select(HriReqLeave).where(HriReqLeave.request_id == request.id)
        ).first()
        if leave_detail is None:
            leave_detail = HriReqLeave(
                request_id=request.id,
                leave_type_code=str(content["leave_type_code"]),
                start_date=date.fromisoformat(str(content["start_date"])),
                end_date=date.fromisoformat(str(content["end_date"])),
                start_time=content.get("start_time"),
                end_time=content.get("end_time"),
                applied_minutes=int(content["applied_minutes"]),
                reason=str(content["reason"]),
                created_at=created_at,
                updated_at=completed_value or submitted_value or created_at,
            )
        else:
            leave_detail.leave_type_code = str(content["leave_type_code"])
            leave_detail.start_date = date.fromisoformat(str(content["start_date"]))
            leave_detail.end_date = date.fromisoformat(str(content["end_date"]))
            leave_detail.start_time = content.get("start_time")
            leave_detail.end_time = content.get("end_time")
            leave_detail.applied_minutes = int(content["applied_minutes"])
            leave_detail.reason = str(content["reason"])
            leave_detail.created_at = created_at
            leave_detail.updated_at = completed_value or submitted_value or created_at
        session.add(leave_detail)

    session.commit()


def ensure_pay_tax_rates(session: Session) -> None:
    for year, rate_type, emp_rate, empl_rate, min_l, max_l in PAY_TAX_RATE_SEEDS:
        existing = session.exec(select(PayTaxRate).where(
            PayTaxRate.year == year, PayTaxRate.rate_type == rate_type
        )).first()
        if existing is None:
            session.add(PayTaxRate(
                year=year, rate_type=rate_type, employee_rate=emp_rate, employer_rate=empl_rate,
                min_limit=min_l, max_limit=max_l
            ))
        else:
            changed = False
            if existing.employee_rate != emp_rate:
                existing.employee_rate = emp_rate
                changed = True
            if changed:
                session.add(existing)
    session.commit()


def ensure_wel_benefit_types(session: Session) -> None:
    existing = {
        row.code: row
        for row in session.exec(select(WelBenefitType)).all()
    }

    for seed in WEL_BENEFIT_TYPE_SEEDS:
        row = existing.get(seed["code"])
        if row is None:
            session.add(
                WelBenefitType(
                    code=seed["code"],
                    name=seed["name"],
                    module_path=seed["module_path"],
                    is_deduction=seed["is_deduction"],
                    pay_item_code=seed["pay_item_code"],
                    is_active=True,
                    sort_order=seed["sort_order"],
                )
            )
            continue

        changed = False
        for key in ("name", "module_path", "is_deduction", "pay_item_code", "sort_order"):
            value = seed[key]
            if getattr(row, key) != value:
                setattr(row, key, value)
                changed = True

        if not row.is_active:
            row.is_active = True
            changed = True

        if changed:
            session.add(row)

    session.commit()


def ensure_wel_benefit_requests(session: Session) -> None:
    existing = {
        row.request_no: row
        for row in session.exec(select(WelBenefitRequest)).all()
    }
    departments = {
        row.id: row.name
        for row in session.exec(select(OrgDepartment)).all()
    }
    users = {
        row.id: row
        for row in session.exec(select(AuthUser)).all()
    }
    employees = session.exec(
        select(HrEmployee)
        .where(HrEmployee.employment_status == "active")
        .order_by(HrEmployee.id)
    ).all()
    benefit_types = session.exec(
        select(WelBenefitType)
        .where(WelBenefitType.is_active == True)  # noqa: E712
        .order_by(WelBenefitType.sort_order, WelBenefitType.id)
    ).all()

    seed_rows = list(WEL_BENEFIT_REQUEST_SEEDS)
    status_cycle = ("draft", "submitted", "approved", "rejected", "payroll_reflected")
    base_requested_at = datetime(2026, 3, 1, 9, 0, 0)
    payroll_label = f"{date.today():%Y-%m} 정기급여"

    for index, employee in enumerate(employees[: min(WEL_BULK_REQUEST_TARGET, len(employees))], start=1):
        benefit_row = benefit_types[(index - 1) % len(benefit_types)] if benefit_types else None
        user = users.get(employee.user_id)
        if benefit_row is None or user is None:
            continue

        status_code = status_cycle[(index - 1) % len(status_cycle)]
        requested_amount = int(80_000 + ((index - 1) % 16) * 55_000)
        approved_amount = requested_amount if status_code in {"approved", "payroll_reflected"} else None
        approved_at = (
            base_requested_at + timedelta(days=index % 28, hours=6)
            if status_code in {"approved", "rejected", "payroll_reflected"}
            else None
        )
        seed_rows.append(
            {
                "request_no": f"WEL-BULK-{date.today():%Y%m}-{index:05d}",
                "benefit_type_code": benefit_row.code,
                "benefit_type_name": benefit_row.name,
                "employee_no": employee.employee_no,
                "employee_name": user.display_name,
                "department_name": departments.get(employee.department_id, ""),
                "status_code": status_code,
                "requested_amount": requested_amount,
                "approved_amount": approved_amount,
                "payroll_run_label": payroll_label if status_code == "payroll_reflected" else None,
                "description": f"bulk welfare seed {benefit_row.code.lower()} #{index:05d}",
                "requested_at": base_requested_at + timedelta(days=index % 28, minutes=index % 60),
                "approved_at": approved_at,
            }
        )

    for seed in seed_rows:
        row = existing.get(seed["request_no"])
        if row is None:
            session.add(WelBenefitRequest(**seed))
            continue

        changed = False
        for key, value in seed.items():
            if getattr(row, key) != value:
                setattr(row, key, value)
                changed = True

        if changed:
            row.updated_at = datetime.utcnow()
            session.add(row)

    session.commit()


def ensure_welfare_menu_overrides(session: Session) -> None:
    role_codes = ["hr_manager", "payroll_mgr", "admin"]
    role_map = {
        row.code: row
        for row in session.exec(select(AuthRole).where(AuthRole.code.in_(role_codes))).all()
    }

    menu_specs = [
        {
            "code": "wel",
            "parent_code": None,
            "name": "\uBCF5\uB9AC\uD6C4\uC0DD",
            "path": None,
            "icon": "HeartHandshake",
            "sort_order": 650,
        },
        {
            "code": "wel.requests",
            "parent_code": "wel",
            "name": "\uBCF5\uB9AC\uD6C4\uC0DD \uC2E0\uCCAD\uD604\uD669",
            "path": "/wel/requests",
            "icon": "ListOrdered",
            "sort_order": 651,
        },
        {
            "code": "wel.benefit-types",
            "parent_code": "wel",
            "name": "\uBCF5\uB9AC\uD6C4\uC0DD \uC720\uD615\uAD00\uB9AC",
            "path": "/wel/benefit-types",
            "icon": "Gift",
            "sort_order": 652,
        },
    ]

    menus = {
        row.code: row
        for row in session.exec(select(AppMenu).where(AppMenu.code.in_([item["code"] for item in menu_specs]))).all()
    }

    for spec in menu_specs:
        parent_id = None
        if spec["parent_code"] is not None:
            parent = menus.get(spec["parent_code"])
            if parent is None:
                continue
            parent_id = parent.id

        row = menus.get(spec["code"])
        if row is None:
            row = AppMenu(
                code=spec["code"],
                name=spec["name"],
                parent_id=parent_id,
                path=spec["path"],
                icon=spec["icon"],
                sort_order=spec["sort_order"],
                is_active=True,
            )
            session.add(row)
            session.commit()
            session.refresh(row)
            menus[row.code] = row
        else:
            changed = False
            for key in ("name", "path", "icon", "sort_order"):
                value = spec[key]
                if getattr(row, key) != value:
                    setattr(row, key, value)
                    changed = True
            if row.parent_id != parent_id:
                row.parent_id = parent_id
                changed = True
            if not row.is_active:
                row.is_active = True
                changed = True
            if changed:
                session.add(row)
                session.commit()
                session.refresh(row)
            menus[row.code] = row

        target_role_ids = {
            role_map[role_code].id
            for role_code in role_codes
            if role_code in role_map
        }
        existing_roles = {
            row.role_id: row
            for row in session.exec(select(AppMenuRole).where(AppMenuRole.menu_id == row.id)).all()
        }
        for role_id in target_role_ids - set(existing_roles):
            session.add(AppMenuRole(menu_id=row.id, role_id=role_id))
        for role_id in set(existing_roles) - target_role_ids:
            session.delete(existing_roles[role_id])
        session.commit()


def ensure_tra_seed_data(session: Session) -> None:
    now_utc = datetime.utcnow()

    organizations = {
        row.code: row
        for row in session.exec(select(TraOrganization)).all()
    }
    for seed in TRA_ORGANIZATION_SEEDS:
        row = organizations.get(seed["code"])
        if row is None:
            session.add(
                TraOrganization(
                    code=seed["code"],
                    name=seed["name"],
                    business_no=seed["business_no"],
                    is_active=True,
                    created_at=now_utc,
                    updated_at=now_utc,
                )
            )
            continue

        changed = False
        for key in ("name", "business_no"):
            value = seed[key]
            if getattr(row, key) != value:
                setattr(row, key, value)
                changed = True
        if not row.is_active:
            row.is_active = True
            changed = True
        if changed:
            row.updated_at = now_utc
            session.add(row)
    session.commit()

    organizations = {
        row.code: row
        for row in session.exec(select(TraOrganization)).all()
    }
    courses = {
        row.course_code: row
        for row in session.exec(select(TraCourse)).all()
    }
    for seed in TRA_COURSE_SEEDS:
        row = courses.get(seed["course_code"])
        organization_code = seed.get("organization_code")
        organization = organizations.get(organization_code) if organization_code else None
        organization_id = organization.id if organization is not None else None

        if row is None:
            session.add(
                TraCourse(
                    course_code=seed["course_code"],
                    course_name=seed["course_name"],
                    in_out_type=seed["in_out_type"],
                    method_code=seed["method_code"],
                    status_code=seed["status_code"],
                    organization_id=organization_id,
                    mandatory_yn=seed["mandatory_yn"],
                    edu_level=seed["edu_level"],
                    is_active=True,
                    created_at=now_utc,
                    updated_at=now_utc,
                )
            )
            continue

        changed = False
        for key in ("course_name", "in_out_type", "method_code", "status_code", "mandatory_yn", "edu_level"):
            value = seed[key]
            if getattr(row, key) != value:
                setattr(row, key, value)
                changed = True
        if row.organization_id != organization_id:
            row.organization_id = organization_id
            changed = True
        if not row.is_active:
            row.is_active = True
            changed = True
        if changed:
            row.updated_at = now_utc
            session.add(row)
    session.commit()

    course_rows = session.exec(select(TraCourse).order_by(TraCourse.id)).all()
    if not course_rows:
        return

    current_year = date.today().year
    for course in course_rows:
        if course.id is None:
            continue
        for batch in range(1, TRA_EVENT_BATCH_PER_COURSE + 1):
            event_code = f"{current_year}{batch:02d}A"
            start_month = ((batch - 1) % 12) + 1
            start_date = date(current_year, start_month, min(24, 6 + ((course.id + batch) % 16)))
            end_date = start_date + timedelta(days=1 if course.method_code != "ONLINE" else 0)
            appl_start_date = start_date - timedelta(days=21)
            appl_end_date = start_date - timedelta(days=2)
            max_person = 120 if course.method_code == "ONLINE" else 48
            expected_name = f"{course.course_name} {batch}차"
            expected_place = "VIBE Campus" if course.method_code != "ONLINE" else "Cyber Campus"

            row = session.exec(
                select(TraEvent).where(
                    TraEvent.course_id == course.id,
                    TraEvent.event_code == event_code,
                )
            ).first()

            if row is None:
                session.add(
                    TraEvent(
                        course_id=course.id,
                        event_code=event_code,
                        event_name=expected_name,
                        status_code="open",
                        organization_id=course.organization_id,
                        place=expected_place,
                        start_date=start_date,
                        end_date=end_date,
                        appl_start_date=appl_start_date,
                        appl_end_date=appl_end_date,
                        edu_day=2 if course.method_code != "ONLINE" else 5,
                        edu_hour=8.0 if course.method_code != "ONLINE" else 16.0,
                        max_person=max_person,
                        is_active=True,
                        created_at=now_utc,
                        updated_at=now_utc,
                    )
                )
                continue

            changed = False
            if row.event_name != expected_name:
                row.event_name = expected_name
                changed = True
            if row.status_code != "open":
                row.status_code = "open"
                changed = True
            if row.organization_id != course.organization_id:
                row.organization_id = course.organization_id
                changed = True
            if row.place != expected_place:
                row.place = expected_place
                changed = True
            if row.start_date != start_date:
                row.start_date = start_date
                changed = True
            if row.end_date != end_date:
                row.end_date = end_date
                changed = True
            if row.appl_start_date != appl_start_date:
                row.appl_start_date = appl_start_date
                changed = True
            if row.appl_end_date != appl_end_date:
                row.appl_end_date = appl_end_date
                changed = True
            if row.edu_day != (2 if course.method_code != "ONLINE" else 5):
                row.edu_day = 2 if course.method_code != "ONLINE" else 5
                changed = True
            if row.edu_hour != (8.0 if course.method_code != "ONLINE" else 16.0):
                row.edu_hour = 8.0 if course.method_code != "ONLINE" else 16.0
                changed = True
            if row.max_person != max_person:
                row.max_person = max_person
                changed = True
            if not row.is_active:
                row.is_active = True
                changed = True
            if changed:
                row.updated_at = now_utc
                session.add(row)
    session.commit()

    mandatory_courses = [course for course in course_rows if course.id is not None and course.mandatory_yn]
    for order_seq, course in enumerate(mandatory_courses, start=1):
        if course.id is None:
            continue
        row = session.exec(
            select(TraRequiredRule).where(
                TraRequiredRule.year == current_year,
                TraRequiredRule.rule_code == "MANDATORY",
                TraRequiredRule.order_seq == order_seq,
                TraRequiredRule.course_id == course.id,
            )
        ).first()
        if row is None:
            session.add(
                TraRequiredRule(
                    year=current_year,
                    rule_code="MANDATORY",
                    order_seq=order_seq,
                    start_month=1,
                    end_month=12,
                    entry_month=1,
                    course_id=course.id,
                    edu_level=course.edu_level,
                    is_active=True,
                    created_at=now_utc,
                    updated_at=now_utc,
                )
            )
            continue

        changed = False
        if row.start_month != 1:
            row.start_month = 1
            changed = True
        if row.end_month != 12:
            row.end_month = 12
            changed = True
        if row.entry_month != 1:
            row.entry_month = 1
            changed = True
        if row.edu_level != course.edu_level:
            row.edu_level = course.edu_level
            changed = True
        if not row.is_active:
            row.is_active = True
            changed = True
        if changed:
            row.updated_at = now_utc
            session.add(row)
    session.commit()

    event_rows = session.exec(
        select(TraEvent).order_by(TraEvent.course_id, TraEvent.start_date, TraEvent.id)
    ).all()
    events_by_course: dict[int, list[TraEvent]] = {}
    for event in event_rows:
        events_by_course.setdefault(event.course_id, []).append(event)

    employees = session.exec(
        select(HrEmployee)
        .where(HrEmployee.employment_status == "active")
        .order_by(HrEmployee.id)
    ).all()
    if not employees:
        return

    for month in range(1, TRA_EVENT_BATCH_PER_COURSE + 1):
        year_month = f"{current_year}{month:02d}"
        start_date = date(current_year, month, 1)
        while start_date.weekday() != 0:
            start_date += timedelta(days=1)
        end_date = start_date + timedelta(days=4)
        window = session.exec(
            select(TraElearningWindow).where(TraElearningWindow.year_month == year_month)
        ).first()
        if window is None:
            session.add(
                TraElearningWindow(
                    year_month=year_month,
                    start_date=start_date,
                    end_date=end_date,
                    app_count=2,
                    note="Seed e-learning window",
                    created_at=now_utc,
                    updated_at=now_utc,
                )
            )
            continue

        changed = False
        if window.start_date != start_date:
            window.start_date = start_date
            changed = True
        if window.end_date != end_date:
            window.end_date = end_date
            changed = True
        if window.app_count != 2:
            window.app_count = 2
            changed = True
        if changed:
            window.updated_at = now_utc
            session.add(window)

    session.commit()

    target_employees = employees[: min(TRA_APPLICATION_TARGET, len(employees))]
    seed_application_prefix = f"TRA-SEED-{current_year}-"
    existing_applications = {
        row.application_no: row
        for row in session.exec(
            select(TraApplication).where(TraApplication.application_no.like(f"{seed_application_prefix}%"))
        ).all()
    }
    course_cycle = [course for course in course_rows if course.id is not None]
    if not course_cycle:
        return

    for index, employee in enumerate(target_employees, start=1):
        course = course_cycle[(index - 1) % len(course_cycle)]
        course_events = events_by_course.get(course.id, [])
        event = course_events[(index - 1) % len(course_events)] if course_events else None
        application_no = f"{seed_application_prefix}{index:05d}"
        status = ("approved", "submitted", "rejected", "canceled")[(index - 1) % 4]
        note = f"bulk tra seed application {index:05d}"
        row = existing_applications.get(application_no)

        if row is None:
            session.add(
                TraApplication(
                    application_no=application_no,
                    employee_id=employee.id,
                    course_id=course.id,
                    event_id=event.id if event else None,
                    in_out_type=course.in_out_type,
                    year_plan_yn=index % 2 == 0,
                    note=note,
                    status=status,
                    created_at=now_utc,
                    updated_at=now_utc,
                )
            )
            continue

        changed = False
        if row.employee_id != employee.id:
            row.employee_id = employee.id
            changed = True
        if row.course_id != course.id:
            row.course_id = course.id
            changed = True
        expected_event_id = event.id if event else None
        if row.event_id != expected_event_id:
            row.event_id = expected_event_id
            changed = True
        if row.in_out_type != course.in_out_type:
            row.in_out_type = course.in_out_type
            changed = True
        if row.year_plan_yn != (index % 2 == 0):
            row.year_plan_yn = index % 2 == 0
            changed = True
        if row.status != status:
            row.status = status
            changed = True
        if row.note != note:
            row.note = note
            changed = True
        if changed:
            row.updated_at = now_utc
            session.add(row)
    session.commit()

    seed_applications = session.exec(
        select(TraApplication).where(TraApplication.application_no.like(f"{seed_application_prefix}%"))
    ).all()
    application_by_employee_course = {
        (row.employee_id, row.course_id): row
        for row in seed_applications
    }
    required_rule_rows = session.exec(
        select(TraRequiredRule).where(TraRequiredRule.year == current_year)
    ).all()
    required_rule_by_course = {row.course_id: row for row in required_rule_rows}
    required_seed_employees = employees[: min(TRA_REQUIRED_TARGET, len(employees))]
    existing_targets = {
        (row.employee_id, row.course_id, row.edu_month): row
        for row in session.exec(
            select(TraRequiredTarget).where(TraRequiredTarget.year == current_year)
        ).all()
    }
    mandatory_course_cycle = mandatory_courses or course_cycle

    for index, employee in enumerate(required_seed_employees, start=1):
        course = mandatory_course_cycle[(index - 1) % len(mandatory_course_cycle)]
        rule = required_rule_by_course.get(course.id)
        if rule is None:
            continue
        course_events = events_by_course.get(course.id, [])
        event = course_events[(index - 1) % len(course_events)] if course_events else None
        edu_month = f"{current_year}{((index - 1) % TRA_EVENT_BATCH_PER_COURSE) + 1:02d}"
        completion_status = ("pending", "completed", "exempt")[(index - 1) % 3]
        completed_count = 1 if completion_status == "completed" else 0
        application = application_by_employee_course.get((employee.id, course.id))
        key = (employee.id, course.id, edu_month)
        row = existing_targets.get(key)

        if row is None:
            session.add(
                TraRequiredTarget(
                    year=current_year,
                    employee_id=employee.id,
                    rule_code=rule.rule_code,
                    course_id=course.id,
                    edu_month=edu_month,
                    event_id=event.id if event else None,
                    application_id=application.id if application else None,
                    standard_rule_id=rule.id,
                    edu_level=rule.edu_level,
                    completion_status=completion_status,
                    completed_count=completed_count,
                    note=f"bulk tra seed target {index:05d}",
                    created_at=now_utc,
                    updated_at=now_utc,
                )
            )
            continue

        changed = False
        if row.rule_code != rule.rule_code:
            row.rule_code = rule.rule_code
            changed = True
        expected_event_id = event.id if event else None
        if row.event_id != expected_event_id:
            row.event_id = expected_event_id
            changed = True
        expected_application_id = application.id if application else None
        if row.application_id != expected_application_id:
            row.application_id = expected_application_id
            changed = True
        if row.standard_rule_id != rule.id:
            row.standard_rule_id = rule.id
            changed = True
        if row.edu_level != rule.edu_level:
            row.edu_level = rule.edu_level
            changed = True
        if row.completion_status != completion_status:
            row.completion_status = completion_status
            changed = True
        if row.completed_count != completed_count:
            row.completed_count = completed_count
            changed = True
        if changed:
            row.updated_at = now_utc
            session.add(row)
    session.commit()

    approved_seed_applications = [row for row in seed_applications if row.status == "approved"]
    history_candidates = approved_seed_applications[: min(TRA_HISTORY_TARGET, len(approved_seed_applications))]
    event_by_id = {row.id: row for row in event_rows if row.id is not None}
    existing_histories = {
        (row.employee_id, row.course_id, row.event_id): row
        for row in session.exec(select(TraHistory)).all()
    }
    for index, application in enumerate(history_candidates, start=1):
        event = event_by_id.get(application.event_id) if application.event_id is not None else None
        key = (application.employee_id, application.course_id, application.event_id)
        confirm_type = "0" if index % 7 == 0 else "1"
        note = f"bulk tra seed history {index:05d}"
        row = existing_histories.get(key)

        if row is None:
            session.add(
                TraHistory(
                    employee_id=application.employee_id,
                    course_id=application.course_id,
                    event_id=application.event_id,
                    application_id=application.id,
                    confirm_type=confirm_type,
                    unconfirm_reason="seed pending confirm" if confirm_type == "0" else None,
                    app_point=8.0 if confirm_type == "1" else None,
                    note=note,
                    completed_at=event.end_date if event else None,
                    created_at=now_utc,
                    updated_at=now_utc,
                )
            )
            continue

        changed = False
        if row.application_id != application.id:
            row.application_id = application.id
            changed = True
        if row.confirm_type != confirm_type:
            row.confirm_type = confirm_type
            changed = True
        expected_reason = "seed pending confirm" if confirm_type == "0" else None
        if row.unconfirm_reason != expected_reason:
            row.unconfirm_reason = expected_reason
            changed = True
        expected_point = 8.0 if confirm_type == "1" else None
        if row.app_point != expected_point:
            row.app_point = expected_point
            changed = True
        if row.note != note:
            row.note = note
            changed = True
        if row.completed_at != (event.end_date if event else None):
            row.completed_at = event.end_date if event else None
            changed = True
        if changed:
            row.updated_at = now_utc
            session.add(row)
    session.commit()

    organization_by_id = {row.id: row for row in session.exec(select(TraOrganization)).all()}
    course_by_id = {row.id: row for row in course_rows if row.id is not None}
    employee_by_id = {row.id: row for row in employees if row.id is not None}
    history_rows = session.exec(select(TraHistory).order_by(TraHistory.id)).all()
    history_candidates = history_rows[: min(TRA_UPLOAD_TARGET, len(history_rows))]
    existing_uploads = {
        (row.upload_ym, row.employee_no, row.course_name): row
        for row in session.exec(select(TraCyberUpload)).all()
    }

    for index, history in enumerate(history_candidates, start=1):
        employee = employee_by_id.get(history.employee_id)
        course = course_by_id.get(history.course_id)
        event = event_by_id.get(history.event_id) if history.event_id is not None else None
        organization = organization_by_id.get(course.organization_id) if course is not None else None
        if employee is None or course is None:
            continue

        upload_ym = (event.start_date.strftime("%Y%m") if event and event.start_date else f"{current_year}01")
        key = (upload_ym, employee.employee_no, course.course_name)
        row = existing_uploads.get(key)
        confirm_type = history.confirm_type or "1"

        if row is None:
            session.add(
                TraCyberUpload(
                    upload_ym=upload_ym,
                    employee_no=employee.employee_no,
                    employee_id=employee.id,
                    course_name=course.course_name,
                    start_date=event.start_date if event else None,
                    end_date=event.end_date if event else None,
                    reward_hour=8.0 if confirm_type == "1" else 0.0,
                    edu_hour=8.0 if confirm_type == "1" else 0.0,
                    labor_apply_yn=False,
                    labor_amount=0.0,
                    per_expense_amount=0.0,
                    real_expense_amount=0.0,
                    confirm_type=confirm_type,
                    unconfirm_reason=history.unconfirm_reason,
                    in_out_type=course.in_out_type,
                    method_code=course.method_code,
                    organization_name=organization.name if organization else None,
                    business_no=organization.business_no if organization else None,
                    mandatory_yn=course.mandatory_yn,
                    edu_level=course.edu_level,
                    event_name=event.event_name if event else None,
                    place=event.place if event else None,
                    close_yn=False,
                    applied_course_id=course.id,
                    applied_event_id=event.id if event else None,
                    applied_history_id=history.id,
                    note=f"bulk tra seed upload {index:05d}",
                    created_at=now_utc,
                    updated_at=now_utc,
                )
            )
            continue

        changed = False
        if row.employee_id != employee.id:
            row.employee_id = employee.id
            changed = True
        if row.start_date != (event.start_date if event else None):
            row.start_date = event.start_date if event else None
            changed = True
        if row.end_date != (event.end_date if event else None):
            row.end_date = event.end_date if event else None
            changed = True
        if row.reward_hour != (8.0 if confirm_type == "1" else 0.0):
            row.reward_hour = 8.0 if confirm_type == "1" else 0.0
            changed = True
        if row.edu_hour != (8.0 if confirm_type == "1" else 0.0):
            row.edu_hour = 8.0 if confirm_type == "1" else 0.0
            changed = True
        if row.confirm_type != confirm_type:
            row.confirm_type = confirm_type
            changed = True
        if row.unconfirm_reason != history.unconfirm_reason:
            row.unconfirm_reason = history.unconfirm_reason
            changed = True
        if row.in_out_type != course.in_out_type:
            row.in_out_type = course.in_out_type
            changed = True
        if row.method_code != course.method_code:
            row.method_code = course.method_code
            changed = True
        if row.organization_name != (organization.name if organization else None):
            row.organization_name = organization.name if organization else None
            changed = True
        if row.business_no != (organization.business_no if organization else None):
            row.business_no = organization.business_no if organization else None
            changed = True
        if row.mandatory_yn != course.mandatory_yn:
            row.mandatory_yn = course.mandatory_yn
            changed = True
        if row.edu_level != course.edu_level:
            row.edu_level = course.edu_level
            changed = True
        if row.event_name != (event.event_name if event else None):
            row.event_name = event.event_name if event else None
            changed = True
        if row.place != (event.place if event else None):
            row.place = event.place if event else None
            changed = True
        if row.applied_course_id != course.id:
            row.applied_course_id = course.id
            changed = True
        if row.applied_event_id != (event.id if event else None):
            row.applied_event_id = event.id if event else None
            changed = True
        if row.applied_history_id != history.id:
            row.applied_history_id = history.id
            changed = True
        if row.close_yn:
            row.close_yn = False
            changed = True
        if changed:
            row.updated_at = now_utc
            session.add(row)

    session.commit()


def ensure_tim_leave_schema(session: Session) -> None:
    # SQLModel create_all은 기존 테이블 컬럼 추가를 보장하지 않으므로, 배포 시 스키마 보정
    session.exec(text("ALTER TABLE tim_leave_requests ADD COLUMN IF NOT EXISTS decision_comment VARCHAR(1000)"))
    session.exec(text("ALTER TABLE tim_leave_requests ADD COLUMN IF NOT EXISTS decided_by INTEGER"))
    session.exec(text("ALTER TABLE tim_leave_requests ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ"))
    session.commit()


def ensure_hri_schema(session: Session) -> None:
    session.exec(text("ALTER TABLE hri_approval_actor_rules ADD COLUMN IF NOT EXISTS position_keywords_json TEXT"))
    session.commit()


def ensure_hr_appointment_schema(session: Session) -> None:
    # THRM191 + THRM221 통합 리팩터링:
    # - hr_appointment_order_items에 임시발령 식별 컬럼 추가
    # - legacy hr_temporary_appointments 데이터 병합 후 테이블 제거
    session.exec(
        text(
            """
            DO $$
            BEGIN
                IF to_regclass('hr_appointment_order_items') IS NOT NULL THEN
                    ALTER TABLE hr_appointment_order_items ADD COLUMN IF NOT EXISTS appointment_kind VARCHAR(20);
                    ALTER TABLE hr_appointment_order_items ADD COLUMN IF NOT EXISTS temporary_reason VARCHAR(500);
                    UPDATE hr_appointment_order_items
                    SET appointment_kind = 'permanent'
                    WHERE appointment_kind IS NULL OR TRIM(appointment_kind) = '';
                    CREATE INDEX IF NOT EXISTS ix_hr_appointment_order_items_kind
                        ON hr_appointment_order_items (appointment_kind);
                END IF;
            END $$;
            """
        )
    )
    session.exec(
        text(
            """
            DO $$
            BEGIN
                IF to_regclass('hr_temporary_appointments') IS NOT NULL
                   AND to_regclass('hr_appointment_order_items') IS NOT NULL THEN
                    UPDATE hr_appointment_order_items oi
                    SET appointment_kind = 'temporary',
                        end_date = COALESCE(ta.end_date, oi.end_date),
                        temporary_reason = COALESCE(ta.reason, oi.temporary_reason)
                    FROM hr_temporary_appointments ta
                    WHERE ta.source_item_id = oi.id;
                END IF;
            END $$;
            """
        )
    )
    session.exec(text("DROP TABLE IF EXISTS hr_temporary_appointments"))
    session.commit()


def seed_initial_data(session: Session) -> None:
    ensure_auth_user_login_id_schema(session)
    ensure_tim_leave_schema(session)
    ensure_hri_schema(session)
    ensure_hr_appointment_schema(session)
    ensure_roles(session)
    ensure_corporations(session)
    departments = ensure_departments(session)
    department = next((item for item in departments if item.code == "HQ-HR"), departments[0])

    admin_local_user = ensure_user(
        session,
        login_id="admin-local",
        email="admin@vibe-hr.local",
        password="admin",
        display_name="Admin",
        reset_password=True,
    )
    quick_admin_user = ensure_user(
        session,
        login_id="admin",
        email="admin2@vibe-hr.local",
        password="admin",
        display_name="Admin",
        reset_password=True,
    )

    ensure_user_roles(session, admin_local_user, ["admin", "employee"])
    ensure_user_roles(session, quick_admin_user, ["admin", "employee"])

    admin_local_employee = ensure_employee(
        session,
        user=admin_local_user,
        employee_no="HR-0001",
        department_id=department.id,
        position_title="\uC778\uC0AC\uCD1D\uAD04",
    )
    ensure_employee(
        session,
        user=quick_admin_user,
        employee_no="HR-0002",
        department_id=department.id,
        position_title="\uC778\uC0AC\uB9E4\uB2C8\uC800",
    )

    ensure_bulk_korean_employees(session, departments=departments, total=DEV_EMPLOYEE_TOTAL)
    ensure_hr_recruitment_cycle_seed(session)
    ensure_sample_records(session, admin_local_employee)
    ensure_menus(session)
    ensure_welfare_menu_overrides(session)
    ensure_menu_actions(session)
    ensure_system_settings(session)
    ensure_common_codes(session)
    ensure_pap_final_results(session)
    ensure_pap_appraisal_masters(session)
    ensure_remove_legacy_appointment_records(session)
    ensure_hr_basic_category_mapping(session)
    ensure_hr_basic_seed_data(session)
    ensure_hr_retire_checklist_seed(session)
    ensure_attendance_codes(session)
    ensure_work_schedule_codes(session)
    ensure_schedule_foundations(session)
    ensure_holidays(session)
    ensure_annual_leave_seed(session)
    ensure_tim_transaction_samples(session)
    ensure_schedule_operational_samples(session)
    ensure_pay_payroll_codes(session)
    ensure_pay_tax_rates(session)
    ensure_pay_allowance_deductions(session)
    ensure_pay_welfare_allowance_definitions(session)
    ensure_pay_item_groups(session)
    ensure_pay_phase2_samples(session)
    ensure_hri_form_types(session)
    ensure_hri_form_type_policies(session)
    ensure_hri_approval_actor_rules(session)
    ensure_hri_approval_templates(session)
    ensure_hri_form_type_template_maps(session)
    ensure_wel_benefit_types(session)
    ensure_hri_request_samples(session)
    ensure_wel_benefit_requests(session)
    ensure_payroll_run_result_samples(session)
    ensure_tra_seed_data(session)

