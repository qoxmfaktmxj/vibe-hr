use super::*;
use axum::http::header::{CONTENT_DISPOSITION, CONTENT_TYPE};
use axum::response::{IntoResponse, Response};
use serde::Serialize;

#[derive(Deserialize)]
pub(super) struct Format {
    format: Option<String>,
}

#[derive(Serialize)]
struct Line {
    voucher_no: String,
    voucher_date: String,
    line_no: i32,
    gl_account_code: String,
    gl_account_name: String,
    cost_center_code: String,
    debit: f64,
    credit: f64,
    summary: String,
}

#[derive(Serialize)]
struct Export {
    voucher_no: String,
    voucher_date: String,
    voucher_type: String,
    lines: Vec<Line>,
}

fn csv_text(mut text: String) -> String {
    // Spring scans UTF-16 chars, skipping Character.FORMAT, whitespace and ISO controls.
    let literal=text.chars().find_map(|ch|{
        if matches!(ch,'='|'+'|'-'|'@'|'\t'|'\r'){return Some(true);}
        let format=matches!(ch as u32,0xad|0x600..=0x605|0x61c|0x6dd|0x70f|0x890..=0x891|0x8e2|0x180e|
            0x200b..=0x200f|0x202a..=0x202e|0x2060..=0x2064|0x2066..=0x206f|0xfeff|0xfff9..=0xfffb);
        let whitespace=ch.is_whitespace() && !matches!(ch,'\u{a0}'|'\u{2007}'|'\u{202f}');
        if format || whitespace || ch.is_control() {None}else{Some(false)}
    }).unwrap_or(false);
    if literal {
        text.insert(0, '\'');
    }
    if text.contains([',', '\n', '\r', '"']) {
        format!("\"{}\"", text.replace('"', "\"\""))
    } else {
        text
    }
}

fn double_string(value: f64) -> String {
    if value != 0.0 && !(0.001..10_000_000.0).contains(&value.abs()) {
        let scientific = format!("{value:e}");
        let (mantissa, exponent) = scientific.split_once('e').expect("scientific notation");
        format!(
            "{}{suffix}E{exponent}",
            mantissa,
            suffix = if mantissa.contains('.') { "" } else { ".0" }
        )
    } else {
        format!("{value:?}")
    }
}

impl Export {
    fn csv(self) -> String {
        let mut body = String::from(
            "\u{feff}voucher_no,voucher_date,line_no,gl_account_code,gl_account_name,cost_center_code,debit,credit,summary\r\n",
        );
        for row in self.lines {
            body.push_str(
                &[
                    csv_text(row.voucher_no),
                    csv_text(row.voucher_date),
                    row.line_no.to_string(),
                    csv_text(row.gl_account_code),
                    csv_text(row.gl_account_name),
                    csv_text(row.cost_center_code),
                    double_string(row.debit),
                    double_string(row.credit),
                    csv_text(row.summary),
                ]
                .join(","),
            );
            body.push_str("\r\n");
        }
        body
    }
}

pub(super) async fn voucher(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<i32>,
    Query(query): Query<Format>,
) -> Result<Response, ApiError> {
    let format = query
        .format
        .as_deref()
        .filter(|v| !v.is_empty())
        .unwrap_or("csv");
    if !matches!(format, "csv" | "json") {
        return Err(ApiError::with_detail(
            StatusCode::UNPROCESSABLE_ENTITY,
            json!([{"type":"validation_error","loc":["request"],
            "msg":"exportVoucher.format: must match \"^(csv|json)$\"","input":null}]),
        ));
    }
    require_role(&user, false)?;
    let record = read::voucher_item(&state.pool, id).await?;
    if record["status"] != "confirmed" {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "Only confirmed voucher can be exported.",
        ));
    }
    let no = record["voucher_no"].as_str().unwrap().to_owned();
    let date = record["voucher_date"].as_str().unwrap().to_owned();
    let kind = record["voucher_type"].as_str().unwrap().to_owned();
    let raw=sqlx::query("SELECT l.line_no,l.gl_account_code,coalesce(a.name,'') AS account,
        coalesce(l.cost_center_code,'') AS center,l.debit_amount,l.credit_amount,coalesce(l.summary,'') AS summary
        FROM pay_voucher_lines l LEFT JOIN gl_accounts a ON a.code=l.gl_account_code WHERE l.voucher_id=$1 ORDER BY l.line_no")
        .bind(id).fetch_all(&state.pool).await?;
    use sqlx::Row;
    let lines = raw
        .iter()
        .map(|r| {
            Ok(Line {
                voucher_no: no.clone(),
                voucher_date: date.clone(),
                line_no: r.try_get("line_no")?,
                gl_account_code: r.try_get("gl_account_code")?,
                gl_account_name: r.try_get("account")?,
                cost_center_code: r.try_get("center")?,
                debit: r.try_get("debit_amount")?,
                credit: r.try_get("credit_amount")?,
                summary: r.try_get("summary")?,
            })
        })
        .collect::<Result<_, sqlx::Error>>()?;
    let attachment = format!("attachment; filename=\"{no}.{format}\"");
    let export = Export {
        voucher_no: no,
        voucher_date: date,
        voucher_type: kind,
        lines,
    };
    let mut response = if format == "csv" {
        ([(CONTENT_TYPE, "text/csv;charset=utf-8")], export.csv()).into_response()
    } else {
        Json(export).into_response()
    };
    response.headers_mut().insert(
        CONTENT_DISPOSITION,
        attachment.parse().map_err(|_| {
            ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
        })?,
    );
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn csv_text_and_double_columns_match_java_export() {
        for (input, expected) in [
            ("=formula", "'=formula"),
            (" +formula", "' +formula"),
            ("\u{feff}@x", "'\u{feff}@x"),
            ("\rfoo", "\"'\rfoo\""),
            (" \tapp", "' \tapp"),
            ("A,B", "\"A,B\""),
            ("a\r\nb\"c", "\"a\r\nb\"\"c\""),
        ] {
            assert_eq!(csv_text(input.into()), expected);
        }
        assert_eq!(double_string(-125.50), "-125.5");
        assert_eq!(double_string(0.), "0.0");
        assert_eq!(double_string(10_000_000.), "1.0E7");
    }
}
