use super::*;
use axum::http::header::{CONTENT_DISPOSITION, CONTENT_TYPE};
use axum::response::{IntoResponse, Response};
use printpdf::{
    IndirectFontRef, Line, Mm, PdfDocument, PdfDocumentReference, PdfLayerReference, Point, Pt,
};
use ttf_parser::Face;

fn failure() -> ApiError {
    ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
}

fn font_bytes() -> Result<Vec<u8>, ApiError> {
    let paths = std::env::var_os("VIBEHR_PAYSLIP_FONT_PATH")
        .into_iter()
        .map(std::path::PathBuf::from)
        .chain(
            [
                "C:/Windows/Fonts/malgun.ttf",
                "C:/Windows/Fonts/NanumGothic.ttf",
                "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
                "/usr/share/fonts/nanum-fonts/NanumGothic.ttf",
                "/usr/share/fonts/truetype/noto/NotoSansKR-Regular.ttf",
                "/usr/share/fonts/opentype/noto/NotoSansCJKkr-Regular.otf",
            ]
            .into_iter()
            .map(std::path::PathBuf::from),
        );
    let path = paths
        .into_iter()
        .find(|p| p.is_file())
        .ok_or_else(failure)?;
    std::fs::read(path).map_err(|_| failure())
}

fn won(amount: f64) -> String {
    let rounded = calculation::whole_won(amount);
    let digits = format!("{:.0}", rounded.abs());
    let mut value = String::new();
    if rounded < 0.0 {
        value.push('-');
    }
    for (i, c) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i).is_multiple_of(3) {
            value.push(',');
        }
        value.push(c);
    }
    value
}

const MARGIN: f32 = 42.;
const HEIGHT: f32 = 841.8898;
const WIDTH: f32 = 595.2756;
const TABLE: [f32; 4] = [75., 220., 90., 125.];
const ROW: f32 = 20.;

struct Layout<'a> {
    doc: PdfDocumentReference,
    layer: PdfLayerReference,
    font: IndirectFontRef,
    metrics: Face<'a>,
    page: usize,
    y: f32,
}

impl<'a> Layout<'a> {
    fn new(data: &'a [u8]) -> Result<Self, ApiError> {
        let (doc, page, layer) =
            PdfDocument::new("Vibe HR 급여명세서", Mm(210.), Mm(297.), "Payslip");
        let layer = doc.get_page(page).get_layer(layer);
        let metrics = Face::parse(data, 0).map_err(|_| failure())?;
        let font = doc.add_external_font(data).map_err(|_| failure())?;
        Ok(Self {
            doc,
            layer,
            font,
            metrics,
            page: 1,
            y: HEIGHT - MARGIN,
        })
    }
    fn text(&self, s: &str, x: f32, y: f32, size: f32) {
        self.layer
            .use_text(s, size, Pt(x).into(), Pt(y).into(), &self.font);
    }
    fn width(&self, s: &str, size: f32) -> f32 {
        s.chars()
            .filter_map(|c| self.metrics.glyph_index(c))
            .filter_map(|id| self.metrics.glyph_hor_advance(id))
            .map(f32::from)
            .sum::<f32>()
            * size
            / f32::from(self.metrics.units_per_em())
    }
    fn centered(&self, s: &str, size: f32) {
        self.text(s, (WIDTH - self.width(s, size)) / 2., self.y, size);
    }
    fn ensure(&mut self, required: f32) {
        if self.y - required < 48. {
            let (page, layer) = self.doc.add_page(Mm(210.), Mm(297.), "Payslip");
            self.layer = self.doc.get_page(page).get_layer(layer);
            self.page += 1;
            self.y = HEIGHT - MARGIN;
        }
    }
    fn cell(&self, x: f32, width: f32, height: f32, s: &str, size: f32, center: bool) {
        let point = |a, b| (Point::new(Pt(a).into(), Pt(b).into()), false);
        self.layer.add_line(Line {
            points: vec![
                point(x, self.y),
                point(x + width, self.y),
                point(x + width, self.y - height),
                point(x, self.y - height),
            ],
            is_closed: true,
        });
        let mut label = s.to_owned();
        if self.width(s, size) > width - 8. {
            while !label.is_empty()
                && self.width(&label, size) + self.width("...", size) > width - 8.
            {
                label.pop();
            }
            label.push_str("...");
        }
        let text_width = self.width(&label, size);
        let numeric = label.ends_with(" 원")
            || (!label.is_empty()
                && label
                    .bytes()
                    .all(|b| b.is_ascii_digit() || matches!(b, b'-' | b',' | b'.')));
        let inset = if center {
            ((width - text_width) / 2.).max(4.)
        } else if numeric && text_width <= width * 0.55 {
            width - text_width - 4.
        } else {
            4.
        };
        self.text(&label, x + inset, self.y - height + 6., size);
    }
    fn table_row(&mut self, labels: [&str; 4], header: bool) {
        let mut x = MARGIN;
        for (index, (width, label)) in TABLE.into_iter().zip(labels).enumerate() {
            self.cell(x, width, ROW, label, 9., header || index == 2);
            x += width;
        }
        self.y -= ROW;
    }
    fn items(&mut self, title: &str, items: &[Value], earning: bool) {
        self.ensure(58.);
        self.text(title, MARGIN, self.y, 11.);
        self.y -= 20.;
        self.table_row(["코드", "항목명", "구분", "금액"], true);
        for item in items
            .iter()
            .filter(|i| i["direction"] == if earning { "earning" } else { "deduction" })
        {
            let page = self.page;
            self.ensure(ROW + 25.);
            if page != self.page {
                self.table_row(["코드", "항목명", "구분", "금액"], true);
            }
            let tax = item["tax_type"].as_str().unwrap_or_default();
            let class = match (earning, tax) {
                (true, "taxable") => "과세",
                (true, _) => "비과세",
                (false, "insurance") => "보험",
                (false, "tax") => "세금",
                _ => tax,
            };
            self.table_row(
                [
                    item["item_code"].as_str().unwrap_or(""),
                    item["item_name"].as_str().unwrap_or(""),
                    class,
                    &won(item["amount"].as_f64().unwrap_or(0.)),
                ],
                false,
            );
        }
        self.y -= 10.;
    }
    fn total(&mut self, label: &str, amount: f64, highlight: bool) {
        self.ensure(42.);
        let width = WIDTH - 2. * MARGIN;
        let (height, size) = if highlight { (28., 12.) } else { (22., 10.) };
        self.cell(MARGIN, width * 0.6, height, label, size, true);
        self.cell(
            MARGIN + width * 0.6,
            width * 0.4,
            height,
            &format!("{}{}", won(amount), if highlight { " 원" } else { "" }),
            size,
            false,
        );
        self.y -= height + if highlight { 0. } else { 18. };
    }
}

fn render(data: &Value, identity: [String; 3]) -> Result<Vec<u8>, ApiError> {
    let bytes = font_bytes()?;
    let mut layout = Layout::new(&bytes)?;
    let summary = &data["summary"];
    let month = summary["year_month"].as_str().ok_or_else(failure)?;
    let period = snapshots::Period::parse(month)?;
    layout.centered("Vibe HR  급여명세서", 16.);
    layout.y -= 24.;
    layout.centered(
        &format!("귀속년월: {}", period.start.format("%Y년 %-m월")),
        10.,
    );
    layout.y -= 34.;
    layout.text("직원 정보", MARGIN, layout.y, 11.);
    layout.y -= 20.;
    let width = (WIDTH - 2. * MARGIN) / 6.;
    for (i, label) in [
        "사번",
        &identity[0],
        "성명",
        &identity[1],
        "부서",
        &identity[2],
    ]
    .into_iter()
    .enumerate()
    {
        layout.cell(MARGIN + i as f32 * width, width, ROW, label, 9., i % 2 == 0);
    }
    layout.y -= 34.;
    let items = data["items"].as_array().ok_or_else(failure)?;
    layout.items("수당 내역", items, true);
    layout.total(
        "지급합계",
        summary["gross_pay"].as_f64().ok_or_else(failure)?,
        false,
    );
    layout.items("공제 내역", items, false);
    layout.total(
        "공제합계",
        summary["total_deductions"].as_f64().ok_or_else(failure)?,
        false,
    );
    layout.total(
        "실수령액",
        summary["net_pay"].as_f64().ok_or_else(failure)?,
        true,
    );
    layout.text(
        &format!(
            "생성일시: {}  |  Page {}",
            chrono::Local::now().format("%Y-%m-%d %H:%M"),
            layout.page
        ),
        MARGIN,
        24.,
        8.,
    );
    layout.doc.save_to_bytes().map_err(|_| failure())
}

async fn payslip(
    pool: &PgPool,
    employee: i32,
    run: i32,
    name: String,
) -> Result<Response, ApiError> {
    let data = read::payslip_for(pool, employee, run).await?;
    let identity: Option<(Option<String>,Option<String>,Option<String>)>=sqlx::query_as("SELECT e.employee_no,u.display_name,d.name FROM hr_employees e
        LEFT JOIN auth_users u ON u.id=e.user_id LEFT JOIN org_departments d ON d.id=e.department_id WHERE e.id=$1")
        .bind(employee).fetch_optional(pool).await?;
    let (a, b, c) = identity.unwrap_or_default();
    let identity = [a, b, c].map(|s| s.unwrap_or_else(|| "-".into()));
    let pdf = tokio::task::spawn_blocking(move || render(&data, identity))
        .await
        .map_err(|_| failure())??;
    Ok((
        [
            (CONTENT_TYPE, "application/pdf".to_owned()),
            (CONTENT_DISPOSITION, format!("attachment; filename={name}")),
        ],
        pdf,
    )
        .into_response())
}

pub(super) async fn own(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(run): Path<i32>,
) -> Result<Response, ApiError> {
    let employee = read::employee_id(&state.pool, &user).await?;
    payslip(&state.pool, employee, run, format!("payslip-{run}.pdf")).await
}

pub(super) async fn admin(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path((run, employee)): Path<(i32, i32)>,
) -> Result<Response, ApiError> {
    require_role(&user, false)?;
    payslip(
        &state.pool,
        employee,
        run,
        format!("payslip-{run}-{employee}.pdf"),
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "requires installed Korean font and Poppler command-line tools"]
    fn extractable_korean_a4_single_and_multiple_page_payslips() {
        for rows in [1, 70] {
            let mut items = vec![
                json!({"item_code":"BSC","item_name":"기본급","direction":"earning","tax_type":"taxable","amount":3000000});
                rows
            ];
            items.push(json!({"item_code":"MEAL","item_name":"식대","direction":"earning","tax_type":"non-taxable","amount":200000}));
            items.push(json!({"item_code":"PEN","item_name":"국민연금","direction":"deduction","tax_type":"insurance","amount":135000}));
            let data = json!({"summary":{"year_month":"2026-01","gross_pay":3200000,"total_deductions":135000,"net_pay":3065000},"items":items});
            let bytes =
                render(&data, ["EMP-004".into(), "김급여".into(), "인사팀".into()]).unwrap();
            let path = std::env::temp_dir().join(format!(
                "vibehr-synthetic-{}-{rows}.pdf",
                std::process::id()
            ));
            std::fs::write(&path, bytes).unwrap();
            let extract = std::process::Command::new("pdftotext")
                .arg("-layout")
                .arg(&path)
                .arg("-")
                .output()
                .unwrap();
            assert!(extract.status.success());
            let text = String::from_utf8(extract.stdout).unwrap();
            for expected in [
                "급여명세서",
                "2026년 1월",
                "직원 정보",
                "EMP-004",
                "김급여",
                "인사팀",
                "수당 내역",
                "기본급",
                "식대",
                "3,200,000",
                "공제 내역",
                "국민연금",
                "135,000",
                "실수령액",
                "3,065,000 원",
            ] {
                assert!(text.contains(expected), "missing {expected}: {text}");
            }
            let page_count = text.matches('\u{c}').count();
            if rows == 1 {
                assert_eq!(page_count, 1);
            } else {
                assert!(page_count > 1);
            }
            let info = std::process::Command::new("pdfinfo")
                .arg(&path)
                .output()
                .unwrap();
            assert!(String::from_utf8(info.stdout).unwrap().contains("(A4)"));
            std::fs::remove_file(path).unwrap();
        }
    }
}
