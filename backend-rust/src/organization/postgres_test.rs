use super::*;
use crate::security::SecurityState;
use axum::{
    body::{Body, to_bytes},
    http::Request,
};
use tower::ServiceExt;

async fn call(app: &Router, method: &str, path: &str, payload: Value) -> (u16, Value) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(method)
                .uri(format!("/api/v1/org{path}"))
                .header("content-type", "application/json")
                .body(if payload.is_null() {
                    Body::empty()
                } else {
                    Body::from(payload.to_string())
                })
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status().as_u16();
    let bytes = to_bytes(response.into_body(), 5_000_000).await.unwrap();
    (
        status,
        if bytes.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&bytes).unwrap()
        },
    )
}
async fn expect(app: &Router, method: &str, path: &str, data: Value, wanted: u16) -> Value {
    let (status, payload) = call(app, method, path, data).await;
    assert_eq!(status, wanted, "{method} {path}: {payload}");
    payload
}
async fn suite() -> (PgPool, Router, Router) {
    let pool = PgPool::connect(&std::env::var("VIBEHR_ORGANIZATION_TEST_URL").unwrap())
        .await
        .unwrap();
    let name: String = sqlx::query_scalar("SELECT current_database()")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(name, "organization_test");
    let state = AppState {
        pool: pool.clone(),
        app_name: "Vibe-HR".into(),
        environment: "test".into(),
        security: SecurityState::new(
            pool.clone(),
            "a1".repeat(32),
            "b2".repeat(32),
            "fixture".into(),
            60,
        )
        .unwrap(),
    };
    let fixture = |login, roles: Vec<String>| {
        let pool = pool.clone();
        let state = state.clone();
        async move {
            let id = sqlx::query_scalar("SELECT id FROM auth_users WHERE login_id=$1")
                .bind(login)
                .fetch_one(&pool)
                .await
                .unwrap();
            routes()
                .layer(Extension(CurrentUser { id, roles }))
                .with_state(state)
        }
    };
    let admin = fixture("admin", vec!["admin".into()]).await;
    let employee = fixture("kr-0001", vec!["employee".into()]).await;
    (pool, admin, employee)
}
fn nonce() -> String {
    chrono::Utc::now()
        .timestamp_nanos_opt()
        .unwrap()
        .to_string()
}
#[tokio::test]
#[ignore = "requires isolated organization_test DB seeded with dev and employee fixtures"]
async fn directory_patch_history_and_checked_plan_application() {
    let (pool, admin, employee) = suite().await;
    let suffix = nonce();
    let code = format!("D{suffix}");
    let corp=expect(&admin,"POST","/corporations",json!({"enter_cd":code.to_lowercase(),"company_code":code,"corporation_name":" 법인 ","business_number":"01"}),201).await;
    assert_eq!(corp["corporation"]["enter_cd"], code);
    let corp_url = format!("/corporations/{}", corp["corporation"]["id"]);
    let rows = expect(
        &admin,
        "GET",
        &format!("/corporations?all=true&enter_cd={code}"),
        Value::Null,
        200,
    )
    .await;
    assert_eq!(rows["total_count"], 1);
    assert!(rows["page"].is_null());
    assert_eq!(
        expect(
            &admin,
            "PUT",
            &corp_url,
            json!({"business_number":" "}),
            200
        )
        .await["corporation"]["business_number"],
        Value::Null
    );
    expect(&admin, "DELETE", &corp_url, Value::Null, 204).await;
    assert_eq!(
        expect(&employee, "GET", "/corporations", Value::Null, 403).await["detail"],
        "Not enough permissions."
    );
    assert_eq!(
        expect(&employee, "GET", "/chart", Value::Null, 403).await["detail"],
        "Access denied."
    );
    let parent = expect(
        &admin,
        "POST",
        "/departments",
        json!({"code":code,"name":"상위부서"}),
        201,
    )
    .await["department"]["id"]
        .as_i64()
        .unwrap();
    let child = expect(
        &admin,
        "POST",
        "/departments",
        json!({"code":format!("X{suffix}"),"name":"변경 전","parent_id":parent}),
        201,
    )
    .await;
    assert!(child["department"]["parent_name"].is_null());
    let id = child["department"]["id"].as_i64().unwrap();
    let child_url = format!("/departments/{id}");
    assert_eq!(
        expect(&admin, "PUT", &child_url, json!({}), 200).await["department"]["parent_id"],
        parent
    );
    expect(
        &admin,
        "PUT",
        &format!("/departments/{parent}"),
        json!({"parent_id":id}),
        400,
    )
    .await;
    expect(
        &admin,
        "DELETE",
        &format!("/departments/{parent}"),
        Value::Null,
        409,
    )
    .await;
    assert!(expect(&admin,"PUT",&child_url,json!({"parent_id":null}),200).await["department"]["parent_id"].is_null());
    let history = expect(
        &admin,
        "GET",
        &format!("/dept-history?department_id={id}"),
        Value::Null,
        200,
    )
    .await;
    assert_eq!(history["items"][0]["after_value"], "None");
    let page = expect(
        &admin,
        "GET",
        &format!("/departments?code={suffix}&reference_date=2026-01-01&page=1&limit=1"),
        Value::Null,
        200,
    )
    .await;
    assert_eq!(page["total_count"], 2);
    assert_eq!(page["departments"].as_array().unwrap().len(), 1);
    assert_eq!(page["reference_date"], "2026-01-01");
    expect(&admin, "GET", "/chart", Value::Null, 200).await;
    let plan = expect(
        &admin,
        "POST",
        "/restructure/plans",
        json!({"title":"조직개편 검증"}),
        200,
    )
    .await["id"]
        .as_i64()
        .unwrap();
    let plan_url = format!("/restructure/plans/{plan}");
    let items_url = format!("{plan_url}/items");
    expect(
        &admin,
        "GET",
        "/restructure/plans?status=draft",
        Value::Null,
        200,
    )
    .await;
    expect(&admin, "PUT", &plan_url, json!({"status":"applied"}), 400).await;
    expect(&admin, "PUT", &plan_url, json!({"status":"reviewing"}), 200).await;
    let deleted = expect(
        &admin,
        "POST",
        &items_url,
        json!({"action_type":"deactivate","target_dept_id":id}),
        200,
    )
    .await;
    expect(
        &admin,
        "DELETE",
        &format!("{items_url}/{}", deleted["id"]),
        Value::Null,
        204,
    )
    .await;
    let item = expect(
        &admin,
        "POST",
        &items_url,
        json!({"action_type":"rename","target_dept_id":id,"new_name":"변경 후"}),
        200,
    )
    .await;
    expect(
        &admin,
        "PUT",
        &format!("{items_url}/{}", item["id"]),
        json!({"memo":"검토"}),
        200,
    )
    .await;
    expect(
        &admin,
        "POST",
        &items_url,
        json!({"action_type":"create","new_name":"코드누락","sort_order":1}),
        200,
    )
    .await;
    assert_eq!(
        expect(&admin, "GET", &items_url, Value::Null, 200).await["total_count"],
        2
    );
    let apply = format!("{plan_url}/apply");
    let (left, right) = tokio::join!(
        call(&admin, "POST", &apply, Value::Null),
        call(&admin, "POST", &apply, Value::Null)
    );
    let (ok, again) = if left.0 == 200 {
        (left, right)
    } else {
        (right, left)
    };
    assert_eq!(ok.0, 200);
    assert_eq!(again.0, 409);
    assert_eq!(again.1["detail"], "이미 적용된 개편안입니다.");
    assert_eq!(ok.1["applied_count"], 1);
    assert_eq!(ok.1["skipped_count"], 1);
    assert_eq!(ok.1["messages"][0], "[RENAME] 변경 전 → 변경 후");
    let n:i64=sqlx::query_scalar("SELECT count(*) FROM org_dept_change_histories WHERE department_id=$1 AND change_reason=$2 AND field_name='name'").bind(id as i32).bind(format!("조직개편 plan_id={plan}")).fetch_one(&pool).await.unwrap();
    assert_eq!(n, 1);
    expect(&admin, "DELETE", &plan_url, Value::Null, 409).await;
    let draft = expect(
        &admin,
        "POST",
        "/restructure/plans",
        json!({"title":"취소"}),
        200,
    )
    .await;
    expect(
        &admin,
        "DELETE",
        &format!("/restructure/plans/{}", draft["id"]),
        Value::Null,
        204,
    )
    .await;
    expect(
        &admin,
        "DELETE",
        &format!("/departments/{parent}"),
        Value::Null,
        204,
    )
    .await;
}
#[tokio::test]
#[ignore = "requires isolated organization_test DB seeded with dev and employee fixtures"]
async fn mapping_period_concurrency_upload_rollback_and_personal_lookup() {
    let (pool, admin, _) = suite().await;
    let code = format!("M{}", nonce());
    let department = expect(
        &admin,
        "POST",
        "/departments",
        json!({"code":code,"name":"매핑"}),
        201,
    )
    .await["department"]["id"]
        .as_i64()
        .unwrap();
    let item=expect(&admin,"POST","/mapping-type-items",json!({"type_code":"COST","item_code":code,"name":"항목","effective_from":"2025-01-01","effective_to":"2026-12-31","remark":"기존"}),201).await["item"]["id"].as_i64().unwrap();
    let item_url = format!("/mapping-type-items/{item}");
    assert_eq!(
        expect(&admin, "PUT", &item_url, json!({}), 200).await["item"]["effective_to"],
        "2026-12-31"
    );
    assert!(
        expect(
            &admin,
            "PUT",
            &item_url,
            json!({"effective_to":null,"remark":null}),
            200
        )
        .await["item"]["remark"]
            .is_null()
    );
    expect(
        &admin,
        "POST",
        "/mapping-type-items",
        json!({"type_code":"COST","item_code":code,"name":"겹침","effective_from":"2026-12-31"}),
        409,
    )
    .await;
    let assignment = json!({"department_id":department,"type_code":"COST","item_id":item,"effective_from":"2025-01-01","effective_to":"2025-12-31"});
    let (left, right) = tokio::join!(
        call(&admin, "POST", "/mapping-assignments", assignment.clone()),
        call(&admin, "POST", "/mapping-assignments", assignment)
    );
    let (created, duplicate) = if left.0 == 201 {
        (left, right)
    } else {
        (right, left)
    };
    assert_eq!(created.0, 201, "{}", created.1);
    assert_eq!(duplicate.0, 409, "{}", duplicate.1);
    let assignment_id = created.1["item"]["id"].as_i64().unwrap();
    let assignment_url = format!("/mapping-assignments/{assignment_id}");
    expect(
        &admin,
        "PUT",
        &assignment_url,
        json!({"effective_to":"2025-11-30"}),
        200,
    )
    .await;
    expect(&admin, "DELETE", &item_url, Value::Null, 409).await;
    let row = json!({"department_code":code,"type_code":"COST","item_code":code,"effective_from":"2026-01-01"});
    let invalid = json!({"mode":"atomic","rows":[row,{"department_code":"MISSING","type_code":"COST","item_code":code,"effective_from":"2026-01-01"}]});
    assert_eq!(
        expect(
            &admin,
            "POST",
            "/mapping-assignments/upload-preview",
            invalid.clone(),
            200
        )
        .await["invalid_count"],
        1
    );
    assert_eq!(
        expect(
            &admin,
            "POST",
            "/mapping-assignments/upload-confirm",
            invalid,
            422
        )
        .await["detail"]["valid_count"],
        1
    );
    let n: i64 =
        sqlx::query_scalar("SELECT count(*) FROM org_mapping_assignments WHERE department_id=$1")
            .bind(department as i32)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(n, 1);
    let valid = json!({"mode":"atomic","rows":[row]});
    assert_eq!(
        expect(
            &admin,
            "POST",
            "/mapping-assignments/upload-confirm",
            valid.clone(),
            200
        )
        .await["inserted_count"],
        1
    );
    assert_eq!(
        expect(
            &admin,
            "POST",
            "/mapping-assignments/upload-confirm",
            valid,
            200
        )
        .await["updated_count"],
        1
    );
    for path in [
        "/mapping-types",
        "/mapping-type-options",
        "/mapping-item-options?type_code=COST",
        "/department-options",
        "/mapping-type-items?reference_date=2026-01-01",
        "/mapping-assignments/upload-template",
        "/mapping-personal-status?reference_date=2026-12-31",
    ] {
        expect(&admin, "GET", path, Value::Null, 200).await;
    }
    let results = expect(
        &admin,
        "GET",
        &format!("/mapping-assignments?department_id={department}"),
        Value::Null,
        200,
    )
    .await;
    assert_eq!(results["total_count"], 2);
    for result in results["items"].as_array().unwrap() {
        expect(
            &admin,
            "DELETE",
            &format!("/mapping-assignments/{}", result["id"]),
            Value::Null,
            204,
        )
        .await;
    }
    expect(&admin, "DELETE", &item_url, Value::Null, 204).await;
    expect(
        &admin,
        "DELETE",
        &format!("/departments/{department}"),
        Value::Null,
        204,
    )
    .await;
}
