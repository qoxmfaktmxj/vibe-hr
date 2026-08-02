package com.vibehr.payroll;

import jakarta.persistence.EntityManager;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** A4 Korean payslip renderer matching the FastAPI payslip content contract. */
@Service
public class PayslipPdfService {
    private static final String FONT_PROPERTY = "vibehr.payroll.payslip-font-path";
    private static final String FONT_ENV = "VIBEHR_PAYSLIP_FONT_PATH";
    private static final DateTimeFormatter GENERATED_AT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final PayrollService payrollService;
    private final PayrollProjectionMapper projections;

    public PayslipPdfService(PayrollService payrollService, PayrollProjectionMapper projections) {
        this.payrollService = payrollService;
        this.projections = projections;
    }

    @Transactional(readOnly = true)
    public byte[] generate(int runId, int employeeId) {
        PayrollContracts.MyPayslipDetailResponse payslip = payrollService.myPayslipDetail(employeeId, runId);
        PayrollProjectionMapper.PayslipIdentityProjection identity = projections.findPayslipIdentity(employeeId);
        Path fontPath = resolveKoreanFontPath();
        try (PDDocument document = new PDDocument()) {
            PDType0Font font = PDType0Font.load(document, fontPath.toFile());
            try (PdfRenderer renderer = new PdfRenderer(document, font)) {
                renderer.header(payslip.summary().yearMonth());
                renderer.identity(identity);
                renderer.items("수당 내역", payslip.items().stream().filter(item -> "earning".equals(item.direction())).toList(), true);
                renderer.total("지급합계", payslip.summary().grossPay(), false);
                renderer.items("공제 내역", payslip.items().stream().filter(item -> "deduction".equals(item.direction())).toList(), false);
                renderer.total("공제합계", payslip.summary().totalDeductions(), false);
                renderer.total("실수령액", payslip.summary().netPay(), true);
                renderer.footer();
            }
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            document.save(output);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("Could not generate payslip PDF", exception);
        }
    }

    static Path resolveKoreanFontPath() {
        List<String> candidates = new ArrayList<>();
        candidates.add(System.getProperty(FONT_PROPERTY));
        candidates.add(System.getenv(FONT_ENV));
        candidates.add("C:/Windows/Fonts/malgun.ttf");
        candidates.add("C:/Windows/Fonts/NanumGothic.ttf");
        candidates.add("/usr/share/fonts/truetype/nanum/NanumGothic.ttf");
        candidates.add("/usr/share/fonts/nanum-fonts/NanumGothic.ttf");
        candidates.add("/usr/share/fonts/truetype/noto/NotoSansKR-Regular.ttf");
        candidates.add("/usr/share/fonts/opentype/noto/NotoSansCJKkr-Regular.otf");
        return candidates.stream().filter(value -> value != null && !value.isBlank()).map(Path::of)
                .filter(Files::isRegularFile).findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "A Korean TrueType/OpenType font is required; set " + FONT_ENV + " or " + FONT_PROPERTY));
    }

    private static final class PdfRenderer implements AutoCloseable {
        private static final float MARGIN = 42;
        private static final float ROW_HEIGHT = 20;
        private static final float[] TABLE_WIDTHS = {75, 220, 90, 125};
        private final PDDocument document;
        private final PDType0Font font;
        private final DecimalFormat money;
        private PDPageContentStream content;
        private float y;

        private PdfRenderer(PDDocument document, PDType0Font font) throws IOException {
            this.document = document;
            this.font = font;
            this.money = new DecimalFormat("#,##0", DecimalFormatSymbols.getInstance(Locale.KOREA));
            this.money.setRoundingMode(java.math.RoundingMode.HALF_EVEN);
            addPage();
        }

        private void header(String yearMonth) throws IOException {
            centered("Vibe HR  급여명세서", 16, y);
            y -= 24;
            int month = Integer.parseInt(yearMonth.substring(5, 7));
            centered("귀속년월: " + yearMonth.substring(0, 4) + "년 " + month + "월", 10, y);
            y -= 34;
        }

        private void identity(PayrollProjectionMapper.PayslipIdentityProjection identity) throws IOException {
            text("직원 정보", MARGIN, y, 11);
            y -= 20;
            String employeeNo = identity == null || identity.employeeNo() == null ? "-" : identity.employeeNo();
            String employeeName = identity == null || identity.employeeName() == null ? "-" : identity.employeeName();
            String departmentName = identity == null || identity.departmentName() == null ? "-" : identity.departmentName();
            float cell = usableWidth() / 6;
            drawCell(MARGIN, y, cell, ROW_HEIGHT, "사번", 9, true);
            drawCell(MARGIN + cell, y, cell, ROW_HEIGHT, employeeNo, 9, false);
            drawCell(MARGIN + cell * 2, y, cell, ROW_HEIGHT, "성명", 9, true);
            drawCell(MARGIN + cell * 3, y, cell, ROW_HEIGHT, employeeName, 9, false);
            drawCell(MARGIN + cell * 4, y, cell, ROW_HEIGHT, "부서", 9, true);
            drawCell(MARGIN + cell * 5, y, cell, ROW_HEIGHT, departmentName, 9, false);
            y -= 34;
        }

        private void items(String title, List<PayrollContracts.PayrollRunEmployeeDetailItem> items, boolean earning) throws IOException {
            ensureSpace(58);
            text(title, MARGIN, y, 11);
            y -= 20;
            tableHeader();
            for (PayrollContracts.PayrollRunEmployeeDetailItem item : items) {
                ensureSpace(ROW_HEIGHT + 25);
                if (y > PDRectangle.A4.getHeight() - 80) tableHeader();
                String classification = earning ? ("taxable".equals(item.taxType()) ? "과세" : "비과세")
                        : "insurance".equals(item.taxType()) ? "보험" : "tax".equals(item.taxType()) ? "세금" : item.taxType();
                float x = MARGIN;
                drawCell(x, y, TABLE_WIDTHS[0], ROW_HEIGHT, item.itemCode(), 9, false); x += TABLE_WIDTHS[0];
                drawCell(x, y, TABLE_WIDTHS[1], ROW_HEIGHT, item.itemName(), 9, false); x += TABLE_WIDTHS[1];
                drawCell(x, y, TABLE_WIDTHS[2], ROW_HEIGHT, classification, 9, true); x += TABLE_WIDTHS[2];
                drawCell(x, y, TABLE_WIDTHS[3], ROW_HEIGHT, money.format(item.amount()), 9, false);
                y -= ROW_HEIGHT;
            }
            y -= 10;
        }

        private void tableHeader() throws IOException {
            float x = MARGIN;
            String[] headers = {"코드", "항목명", "구분", "금액"};
            for (int index = 0; index < headers.length; index++) {
                drawCell(x, y, TABLE_WIDTHS[index], ROW_HEIGHT, headers[index], 9, true);
                x += TABLE_WIDTHS[index];
            }
            y -= ROW_HEIGHT;
        }

        private void total(String label, double amount, boolean highlighted) throws IOException {
            ensureSpace(42);
            float labelWidth = usableWidth() * .6f;
            float height = highlighted ? 28 : 22;
            drawCell(MARGIN, y, labelWidth, height, label, highlighted ? 12 : 10, true);
            drawCell(MARGIN + labelWidth, y, usableWidth() - labelWidth, height,
                    money.format(amount) + (highlighted ? " 원" : ""), highlighted ? 12 : 10, false);
            y -= height + (highlighted ? 0 : 18);
        }

        private void footer() throws IOException {
            text("생성일시: " + LocalDateTime.now().format(GENERATED_AT) + "  |  Page " + document.getNumberOfPages(),
                    MARGIN, 24, 8);
        }

        private void ensureSpace(float required) throws IOException {
            if (y - required >= 48) return;
            content.close();
            addPage();
        }

        private void addPage() throws IOException {
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            content = new PDPageContentStream(document, page);
            y = PDRectangle.A4.getHeight() - MARGIN;
        }

        private void centered(String value, float size, float baseline) throws IOException {
            float width = font.getStringWidth(value) / 1000f * size;
            text(value, (PDRectangle.A4.getWidth() - width) / 2f, baseline, size);
        }

        private void drawCell(float x, float top, float width, float height, String value, float size, boolean centered) throws IOException {
            content.addRect(x, top - height, width, height);
            content.stroke();
            String fitted = fit(value == null ? "" : value, size, width - 8);
            float textWidth = font.getStringWidth(fitted) / 1000f * size;
            float textX = centered ? x + Math.max((width - textWidth) / 2f, 4) : x + (textWidth > width * .55f ? 4 : width - textWidth - 4);
            if (!centered && !isNumeric(fitted) && !fitted.endsWith(" 원")) textX = x + 4;
            text(fitted, textX, top - height + 6, size);
        }

        private String fit(String value, float size, float width) throws IOException {
            if (font.getStringWidth(value) / 1000f * size <= width) return value;
            String ellipsis = "...";
            int end = value.length();
            while (end > 0 && font.getStringWidth(value.substring(0, end) + ellipsis) / 1000f * size > width) end--;
            return value.substring(0, end) + ellipsis;
        }

        private void text(String value, float x, float baseline, float size) throws IOException {
            content.beginText();
            content.setFont(font, size);
            content.newLineAtOffset(x, baseline);
            content.showText(value);
            content.endText();
        }

        private float usableWidth() {
            return PDRectangle.A4.getWidth() - MARGIN * 2;
        }

        private boolean isNumeric(String value) {
            return value.matches("[-0-9,.]+(?: 원)?");
        }

        @Override
        public void close() throws IOException {
            if (content != null) content.close();
        }
    }
}
