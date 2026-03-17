"""급여명세서 PDF 생성 서비스.

fpdf2를 사용하여 급여명세서 PDF를 생성한다.
한글 지원을 위해 시스템에 설치된 맑은 고딕 (malgun.ttf) 폰트를 사용한다.
"""
from __future__ import annotations

import io
import os
from datetime import datetime

from fastapi import HTTPException, status
from fpdf import FPDF
from sqlmodel import Session, select

from app.models import AuthUser, HrEmployee, OrgDepartment
from app.models.entities import PayPayrollRun, PayPayrollRunEmployee, PayPayrollRunItem


def _find_korean_font() -> str | None:
    """시스템에 설치된 한글 폰트 경로를 반환한다."""
    candidates = [
        # Windows
        "C:/Windows/Fonts/malgun.ttf",
        "C:/Windows/Fonts/NanumGothic.ttf",
        # Linux
        "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
        "/usr/share/fonts/nanum-fonts/NanumGothic.ttf",
        # macOS
        "/System/Library/Fonts/AppleSDGothicNeo.ttc",
    ]
    for path in candidates:
        if os.path.isfile(path):
            return path
    return None


class PayslipPDF(FPDF):
    """급여명세서 전용 PDF 클래스."""

    _company_name: str = "Vibe HR"
    _year_month: str = ""

    def header(self) -> None:
        self.set_font("Korean", "B", 14)
        self.cell(0, 10, f"{self._company_name}  급여명세서", align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Korean", "", 10)
        if self._year_month:
            ym = self._year_month
            self.cell(0, 6, f"귀속년월: {ym[:4]}년 {int(ym[5:7])}월", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(4)

    def footer(self) -> None:
        self.set_y(-15)
        self.set_font("Korean", "", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"생성일시: {datetime.now().strftime('%Y-%m-%d %H:%M')}  |  Page {self.page_no()}", align="C")


def generate_payslip_pdf(
    session: Session,
    run_id: int,
    employee_id: int,
) -> bytes:
    """급여명세서 PDF를 생성하여 bytes로 반환한다."""

    # 데이터 조회
    run = session.get(PayPayrollRun, run_id)
    if run is None or run.status not in ("closed", "paid"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="급여 정보를 찾을 수 없습니다.")

    re = session.exec(
        select(PayPayrollRunEmployee).where(
            PayPayrollRunEmployee.run_id == run_id,
            PayPayrollRunEmployee.employee_id == employee_id,
        )
    ).first()
    if re is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="급여 정보를 찾을 수 없습니다.")

    # 직원 정보
    emp = session.get(HrEmployee, employee_id)
    user = session.get(AuthUser, emp.user_id) if emp else None
    dept = session.get(OrgDepartment, emp.department_id) if emp else None

    items = session.exec(
        select(PayPayrollRunItem).where(PayPayrollRunItem.run_employee_id == re.id).order_by(PayPayrollRunItem.id)
    ).all()

    earnings = [i for i in items if i.direction == "earning"]
    deductions = [i for i in items if i.direction == "deduction"]

    # PDF 생성
    pdf = PayslipPDF(orientation="P", unit="mm", format="A4")
    pdf._year_month = run.year_month

    # 한글 폰트 설정
    font_path = _find_korean_font()
    if font_path:
        pdf.add_font("Korean", "", font_path, uni=True)
        pdf.add_font("Korean", "B", font_path, uni=True)
    else:
        # 폰트 없으면 기본 Helvetica 사용 (한글 깨질 수 있음)
        pdf.add_font("Korean", "", "Helvetica")
        pdf.add_font("Korean", "B", "Helvetica")

    pdf.add_page()
    w = pdf.w - pdf.l_margin - pdf.r_margin  # 가용 너비

    # ── 직원 정보 ──
    pdf.set_font("Korean", "B", 10)
    pdf.cell(0, 8, "직원 정보", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Korean", "", 9)

    info_items = [
        ("사번", emp.employee_no if emp else "-"),
        ("성명", user.display_name if user else "-"),
        ("부서", dept.name if dept else "-"),
    ]
    col_w = w / 3
    for label, value in info_items:
        pdf.cell(col_w / 2, 7, label, border=1)
        pdf.cell(col_w / 2, 7, str(value), border=1)
    pdf.ln()
    pdf.ln(4)

    # ── 수당 내역 ──
    pdf.set_font("Korean", "B", 10)
    pdf.cell(0, 8, "수당 내역", new_x="LMARGIN", new_y="NEXT")
    _draw_items_table(pdf, earnings, w, is_earning=True)
    pdf.ln(2)

    # 수당 합계
    pdf.set_font("Korean", "B", 9)
    pdf.cell(w * 0.6, 7, "지급합계", border=1, align="R")
    pdf.cell(w * 0.4, 7, f"{re.gross_pay:,.0f}", border=1, align="R")
    pdf.ln()
    pdf.ln(4)

    # ── 공제 내역 ──
    pdf.set_font("Korean", "B", 10)
    pdf.cell(0, 8, "공제 내역", new_x="LMARGIN", new_y="NEXT")
    _draw_items_table(pdf, deductions, w, is_earning=False)
    pdf.ln(2)

    # 공제 합계
    pdf.set_font("Korean", "B", 9)
    pdf.cell(w * 0.6, 7, "공제합계", border=1, align="R")
    pdf.cell(w * 0.4, 7, f"{re.total_deductions:,.0f}", border=1, align="R")
    pdf.ln()
    pdf.ln(6)

    # ── 실수령액 ──
    pdf.set_font("Korean", "B", 12)
    pdf.set_fill_color(240, 248, 255)
    pdf.cell(w * 0.6, 10, "실수령액", border=1, align="R", fill=True)
    pdf.cell(w * 0.4, 10, f"{re.net_pay:,.0f} 원", border=1, align="R", fill=True)
    pdf.ln()

    # 출력
    buf = io.BytesIO()
    pdf.output(buf)
    return buf.getvalue()


def _draw_items_table(pdf: PayslipPDF, items: list, w: float, is_earning: bool) -> None:
    """수당/공제 항목 테이블을 그린다."""
    col_widths = [w * 0.15, w * 0.35, w * 0.2, w * 0.3]
    headers = ["코드", "항목명", "구분", "금액"]

    pdf.set_font("Korean", "B", 9)
    pdf.set_fill_color(245, 245, 245)
    for i, h in enumerate(headers):
        pdf.cell(col_widths[i], 7, h, border=1, align="C", fill=True)
    pdf.ln()

    pdf.set_font("Korean", "", 9)
    for item in items:
        tax_label = ""
        if is_earning:
            tax_label = "과세" if item.tax_type == "taxable" else "비과세"
        else:
            if item.tax_type == "insurance":
                tax_label = "보험"
            elif item.tax_type == "tax":
                tax_label = "세금"
            else:
                tax_label = item.tax_type

        pdf.cell(col_widths[0], 7, item.item_code, border=1)
        pdf.cell(col_widths[1], 7, item.item_name, border=1)
        pdf.cell(col_widths[2], 7, tax_label, border=1, align="C")
        pdf.cell(col_widths[3], 7, f"{item.amount:,.0f}", border=1, align="R")
        pdf.ln()
