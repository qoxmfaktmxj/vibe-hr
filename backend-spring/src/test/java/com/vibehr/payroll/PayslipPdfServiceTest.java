package com.vibehr.payroll;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

class PayslipPdfServiceTest {
    @Test
    void rendersA4KoreanPayslipIdentityItemsAndTotalsAsExtractableText() throws Exception {
        PayrollService payrollService = mock(PayrollService.class);
        PayrollProjectionMapper projections = mock(PayrollProjectionMapper.class);
        PayrollContracts.MyPayslipSummary summary = new PayrollContracts.MyPayslipSummary(
                7, 8, "2026-01", "1월 정기급여", "closed", 3_200_000, 3_000_000, 200_000, 135_000, 3_065_000, null);
        List<PayrollContracts.PayrollRunEmployeeDetailItem> items = List.of(
                new PayrollContracts.PayrollRunEmployeeDetailItem(1, 8, "BSC", "기본급", "earning", 3_000_000,
                        "taxable", "fixed", "snapshot", LocalDateTime.parse("2026-01-31T09:00:00")),
                new PayrollContracts.PayrollRunEmployeeDetailItem(2, 8, "MEAL", "식대", "earning", 200_000,
                        "non-taxable", "fixed", "welfare", LocalDateTime.parse("2026-01-31T09:00:00")),
                new PayrollContracts.PayrollRunEmployeeDetailItem(3, 8, "PEN", "국민연금", "deduction", 135_000,
                        "insurance", "formula", "system", LocalDateTime.parse("2026-01-31T09:00:00")));
        when(payrollService.myPayslipDetail(4, 7)).thenReturn(new PayrollContracts.MyPayslipDetailResponse(summary, items));
        PayrollProjectionMapper.PayslipIdentityProjection identity = new PayrollProjectionMapper.PayslipIdentityProjection();
        identity.setEmployeeNo("EMP-004"); identity.setEmployeeName("김급여"); identity.setDepartmentName("인사팀");
        when(projections.findPayslipIdentity(4)).thenReturn(identity);

        byte[] payload = new PayslipPdfService(payrollService, projections).generate(7, 4);

        try (PDDocument document = Loader.loadPDF(payload)) {
            assertThat(document.getNumberOfPages()).isOne();
            assertThat(document.getPage(0).getMediaBox().getWidth()).isEqualTo(PDRectangle.A4.getWidth());
            assertThat(document.getPage(0).getMediaBox().getHeight()).isEqualTo(PDRectangle.A4.getHeight());
            String text = new PDFTextStripper().getText(document);
            assertThat(text).contains(
                    "급여명세서", "귀속년월: 2026년 1월", "사번", "EMP-004", "성명", "김급여", "부서", "인사팀",
                    "수당 내역", "BSC", "기본급", "MEAL", "식대", "3,200,000",
                    "공제 내역", "PEN", "국민연금", "135,000", "실수령액", "3,065,000 원");
        }
    }

    @Test
    void resolvesAnInstalledKoreanFontWithoutBundlingAFontFile() {
        assertThat(PayslipPdfService.resolveKoreanFontPath()).isRegularFile();
    }
}
