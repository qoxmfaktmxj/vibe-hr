"""Exercise payroll HTTP contracts on independent disposable Spring and Rust databases.

Use two databases named payroll_oracle and payroll_candidate inside the task-labeled,
loopback-only PostgreSQL container. Restore both from the identical Flyway + dev seed.
Pass a genuine local admin login token as VIBEHR_PARITY_TOKEN. Run with a new month
when retaining prior test evidence. PDF extraction requires pdftotext on PATH.
"""
import argparse
import datetime as dt
import decimal
import json
import os
import re
import subprocess
import urllib.error
import urllib.request
import uuid


def run(argv, data=None):
    return subprocess.run(argv, input=data, capture_output=True, check=True).stdout


def normalize(value, key=""):
    if isinstance(value, dict):
        return {k: normalize(v, k) for k, v in value.items()}
    if isinstance(value, list):
        return [normalize(v) for v in value]
    if value and key in {"created_at", "updated_at", "confirmed_at", "calculated_at", "closed_at", "paid_at",
                         "approved_at", "requested_at", "submitted_at", "completed_at","acted_at"}:
        timestamp = dt.datetime.fromisoformat(value)
        return timestamp
    return value


def difference(a, b, path=""):
    if isinstance(a, dict) and isinstance(b, dict):
        if a.keys() != b.keys():
            return f"{path} keys {sorted(a.keys() ^ b.keys())}"
        for k in a:
            if (d := difference(a[k], b[k], f"{path}.{k}")):
                return d
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return f"{path} lengths {len(a)}/{len(b)}"
        for i, (v, w) in enumerate(zip(a, b)):
            if (d := difference(v, w, f"{path}[{i}]")):
                return d
    elif isinstance(a, dt.datetime) and isinstance(b, dt.datetime):
        # Wall clocks of matching writes are independent. Check values are close,
        # including historical writes retained from earlier runs of this harness.
        if abs((a - b).total_seconds()) > 5:
            return f"{path} timestamp difference exceeds 5 seconds"
    elif a != b:
        return f"{path} value differs"
    return None


class Pair:
    databases = ("payroll_oracle", "payroll_candidate")

    def __init__(self, options):
        self.options = options
        self.count = 0
        self.covered = set()
        self.prefix = "/api/v1/pay"
        if options.reference == options.candidate:
            raise ValueError("two distinct loopback ports are required")
        inspect = json.loads(run(["docker", "inspect", options.container]))[0]
        ports = inspect["NetworkSettings"]["Ports"]["5432/tcp"]
        if not ports or any(p["HostIp"] not in {"127.0.0.1", "::1"} for p in ports):
            raise ValueError("expected a loopback-bound PostgreSQL container")
        if not inspect["Config"]["Labels"].get("codex.task", "").startswith("vibehr-rust-"):
            raise ValueError("expected an isolated Rust migration test container")
        self.token = os.environ["VIBEHR_PARITY_TOKEN"]
        self.ports = (options.reference, options.candidate)
        markers = ["paytest-" + uuid.uuid4().hex[:10] for _ in self.ports]
        for db, marker in zip(self.databases, markers):
            self.sql(db, f"""INSERT INTO pay_payroll_codes(code,name,pay_type,payment_day,tax_deductible,social_ins_deductible,is_active,created_at,updated_at)
                 VALUES('{marker}','Disposable DB guard','regular','25',true,true,true,now(),now())""")
        try:
            for i, port in enumerate(self.ports):
                status, _, identity = self.request(port, "GET", "/api/v1/auth/me")
                if status != 200 or identity.get("email") not in {"admin@vibe-hr.local", "admin2@vibe-hr.local"}:
                    raise ValueError("expected the authorized dev fixture admin")
                status, _, data = self.request(port, "GET", "/api/v1/pay/setup/codes")
                codes = {item["code"] for item in data["items"]}
                if status != 200 or markers[i] not in codes or markers[1 - i] in codes:
                    raise ValueError("HTTP origin did not match its disposable database")
        finally:
            for db, marker in zip(self.databases, markers):
                self.sql(db, f"DELETE FROM pay_payroll_codes WHERE code='{marker}'")

    def sql(self, db, sql):
        assert db in self.databases
        return run(["docker", "exec", "-i", self.options.container, "psql", "-XqAt", "-v", "ON_ERROR_STOP=1",
                    "-U", self.options.user, "-d", db], sql.encode()).decode().strip()

    def request(self, port, method, path, payload=None):
        assert port in self.ports
        request = urllib.request.Request(f"http://127.0.0.1:{port}{path}", method=method,
            data=None if payload is None else json.dumps(payload, ensure_ascii=False).encode(),
            headers={"Content-Type": "application/json", "Accept-Language": "en", "Authorization": "Bearer " + self.token})
        try:
            response = urllib.request.urlopen(request, timeout=20)
        except urllib.error.HTTPError as e:
            response = e
        with response:
            raw = response.read()
            mime = response.headers.get_content_type()
            if mime == "application/json":
                data = normalize(json.loads(raw, parse_float=decimal.Decimal))
            elif mime == "application/pdf":
                args = ["pdftotext", "-layout", "-", "-"]
                if self.options.pdf_container:
                    args = ["docker", "exec", "-i", self.options.pdf_container, *args]
                data = " ".join(run(args, raw).decode().split())
                if "급여명세서" not in data or "실수령액" not in data:
                    raise AssertionError("PDF missing payslip title or net total")
                data = re.sub(r"생성일시:\s*\d{4}-\d\d-\d\d \d\d:\d\d", "생성일시: [clock]", data)
            else:
                data = raw
            return response.status, (mime, response.headers.get("content-disposition")), data

    def check(self, path, body=None, status=200, method=None):
        method = method or ("POST" if body is not None else "GET")
        pair = [self.request(port, method, self.prefix + path, body) for port in self.ports]
        a, b = pair
        if a[0] != status or b[0] != status:
            raise AssertionError(f"{method} {path} expected {status}, got {a[0]}/{b[0]}; details {a[2] if a[0] >= 400 else ''} / {b[2] if b[0] >= 400 else ''}")
        if a[1] != b[1] or (d := difference(a[2], b[2])):
            raise AssertionError(f"{method} {path} differs: {a[1:2]} vs {b[1:2]}" if a[1] != b[1] else f"{method} {path}: {d}")
        self.count += 1
        if status < 300:
            self.covered.add((method, re.sub(r"/\d+(?=/|$)", "/{id}", (self.prefix+path).split("?")[0])))
        return a[2]

    def batch(self, path, fields):
        response = self.check(path + "/batch", {"items": [fields], "delete_ids": []})
        assert response["inserted_count"] == 1
        return next(r["id"] for r in response["items"] if all(r.get(k) == v for k, v in fields.items() if k != "details"))


def welfare(pair, month):
    pair.prefix="/api/v1/wel"
    pair.check("/benefit-types")
    pair.check("/requests")
    pair.check("/requests?limit=201",status=422)
    pair.check("/benefit-types?page=0",status=422)
    suffix=month.replace("-","")
    fields={"code":"WEL"+suffix,"name":"Synthetic benefit","module_path":"/test/welfare/"+suffix,"_status":"added"}
    assert pair.check("/benefit-types/batch",{"items":[fields]}) == {"created":1,"updated":0,"deleted":0}
    rows=pair.check("/benefit-types?limit=200")["items"]
    type_id=next(r["id"] for r in rows if r["code"]==fields["code"])
    update={**fields,"id":type_id,"_status":"updated","name":"Updated benefit"}
    pair.check("/benefit-types/batch",{"items":[update]})
    for action in ("approve","reject","withdraw"):
        request=pair.check("/requests",{"benefit_type_code":fields["code"],"requested_amount":180,"description":"Fixture"})
        base="/requests/"+str(request["item"]["id"])
        if action=="approve":
            pair.check(base+"/approve",{"approved_amount":200,"note":"Synthetic"})
            pair.check(base+"/approve",{"approved_amount":200},409)
            pair.check(base+"/withdraw",method="PUT",status=409)
        elif action=="reject":
            pair.check(base+"/reject",{"reason":"Synthetic"})
        else:
            pair.check(base+"/withdraw",method="PUT")
    pair.check("/my-requests")
    pair.check("/requests?page=1&limit=2")
    pair.check("/benefit-types/batch",{"items":[{**update,"_status":"deleted"}]})
    for table in ["wel_benefit_types","wel_benefit_requests"]:
        values=[normalize(json.loads(pair.sql(db,f"SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM {table} t"))) for db in pair.databases]
        if (d := difference(*values)):
            raise AssertionError(f"database comparison {table}: {d}")
    if len(pair.covered)!=8:
        raise AssertionError(f"only {len(pair.covered)} successful welfare contracts")
    print(f"{pair.count} HTTP pairs passed across 8 welfare contracts; 2 database tables matched")
    pair.prefix="/api/v1/pay"
    pair.covered.clear()
    pair.count=0


def hri(pair, month):
    pair.prefix="/api/v1/hri"
    suffix=month.replace("-","")
    forms=pair.check("/form-types")["items"]
    welfare=next(f["id"] for f in forms if f["form_code"]=="WEL_BENEFIT_REQUEST")
    pair.check("/form-types/batch",{"items":[{"form_code":"HT"+suffix,"form_name_ko":"Synthetic form"}]})
    pair.check("/approval-templates")
    who=pair.request(pair.ports[0],"GET","/api/v1/auth/me")[2]
    actor=int(pair.sql(pair.databases[0],f"SELECT id FROM auth_users WHERE email='{who['email']}'"))
    template={"template_code":"HT"+suffix,"template_name":"Parity receive chain","priority":int(suffix)+300000,
        "steps":[{"step_order":n,"step_type":kind,"actor_resolve_type":"USER_FIXED","actor_user_id":actor,
                  "required_action":"RECEIVE" if kind=="RECEIVE" else "APPROVE"}
                 for n,kind in [(1,"APPROVAL"),(2,"RECEIVE"),(3,"REFERENCE")]]}
    saved=pair.check("/approval-templates/batch",{"items":[template]})
    template_id=next(t["id"] for t in saved["items"] if t["template_code"]==template["template_code"])
    for db in pair.databases:
        pair.sql(db,f"""INSERT INTO hri_form_type_approval_maps(form_type_id,template_id,is_active,effective_from,created_at,updated_at)
            VALUES({welfare},{template_id},true,date '2020-01-01',now(),now())""")
    body={"form_type_id":welfare,"title":"Synthetic HRI benefit "+suffix,
          "content_json":{"benefit_type_code":"SCHOLARSHIP_GRANT","requested_amount":"120","description":"Fixture","reason":"Test"}}
    pair.check("/requests/submit",{**body,"content_json":{}},422)
    new=pair.check("/requests/draft",body)["request"]["id"]
    base=f"/requests/{new}"
    pair.check(base)
    pair.check(base+"/submit",method="POST")
    pair.check("/tasks/my-approvals")
    pair.check(base+"/reject",{"comment":"Revise"})
    pair.check("/requests/submit",{**body,"request_id":new,"content_json":{"reason":"missing fields"}},422)
    assert pair.check(base)["request"]["status_code"]=="APPROVAL_REJECTED"
    pair.check("/requests/submit",{**body,"request_id":new})
    pair.check(base+"/approve",{"comment":"Approved"})
    pair.check("/tasks/my-receives")
    pair.check(base+"/receive-reject",{"comment":"Revise receipt"})
    pair.check("/requests/submit",{**body,"request_id":new})
    pair.check(base+"/approve",{"comment":"Approved"})
    pair.check(base+"/receive-complete",{"comment":"Received"})
    pair.check(base)
    pair.check(base+"/receive-complete",{},409)
    second=pair.check("/requests/submit",body)["request_id"]
    pair.check(f"/requests/{second}/withdraw",method="POST")
    pair.check("/requests/my?limit=1")
    # Existing requests occupy sequence values for the welfare form. The current
    # Spring app counts per form but has a global unique request_no; assign
    # disjoint fixture sequence ranges for these additional policy scenarios.
    for form_code,index in [("TIM_CORRECTION",1),("CERT_EMPLOYMENT",2),("LEAVE_REQUEST",3)]:
        for db in pair.databases:
            pair.sql(db,f"""INSERT INTO hri_request_counters(counter_key,last_seq,updated_at)
                        VALUES(to_char(timezone('UTC',now()),'YYYYMM')||':{form_code}',{index*100000},timestamp '2001-01-01')
                        ON CONFLICT(counter_key) DO NOTHING""")
    def form_id(code):
        return next(f["id"] for f in forms if f["form_code"]==code)
    correction={"form_type_id":form_id("TIM_CORRECTION"),"title":"Attendance correction",
                "content_json":{"work_date":month+"-02","before_status":"absent","after_status":"late","reason":"Fixture"}}
    record=pair.check("/requests/draft",correction)["request"]["id"]
    pair.check("/requests/draft",{**correction,"request_id":record,"content_json":{"before_status":"absent","reason":"Edited"}})
    assert pair.check(f"/requests/{record}")["request"]["detail_data"]=={"before_status":"absent","reason":"Edited"}
    pair.check(f"/requests/{record}/submit",status=422,method="POST")
    pair.check("/requests/draft",{**correction,"request_id":record})
    pair.check(f"/requests/{record}/submit",status=422,method="POST")
    for db in pair.databases:
        pair.sql(db,f"""INSERT INTO hri_request_attachments(request_id,file_key,file_name,file_size,mime_type,uploaded_by,uploaded_at)
                   VALUES({record},'fixture/typed','fixture.pdf',10,'application/pdf',{actor},timestamp '2020-01-01')""")
    pair.check(f"/requests/{record}/submit",method="POST")
    assert pair.check(f"/requests/{record}")["request"]["detail_data"]["after_status"]=="late"
    cert={"form_type_id":form_id("CERT_EMPLOYMENT"),"title":"Employment certificate","content_json":{"purpose":"Bank","copies":"02","recipient":"Fixture"}}
    request=pair.check("/requests/submit",cert)["request_id"]
    assert pair.check(f"/requests/{request}")["request"]["detail_data"]["copies"]==2
    leave={"form_type_id":form_id("LEAVE_REQUEST"),"title":"Annual leave",
           "content_json":{"leave_type_code":"ANNUAL","start_date":month+"-01","end_date":month+"-01","applied_minutes":"480","reason":"Fixture"}}
    request=pair.check("/requests/submit",leave)["request_id"]
    assert pair.check(f"/requests/{request}")["request"]["detail_data"]["applied_minutes"]==480
    pair.check("/requests/submit",{**leave,"content_json":{**leave["content_json"],"end_date":"2001-01-01"}},422)
    tables=["hri_request_masters","hri_request_step_snapshots","hri_request_histories","hri_request_counters",
            "hri_form_types","hri_approval_line_templates","hri_approval_line_steps","hri_form_type_approval_maps","wel_benefit_requests",
            "hri_req_cert_employment","hri_req_leave","hri_req_tim_correction","hri_request_attachments"]
    for table in tables:
        key="counter_key" if table=="hri_request_counters" else "id"
        result=[]
        for db in pair.databases:
            values=json.loads(pair.sql(db,f"SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY {key}),'[]') FROM {table} t"))
            for row in values:
                for serialized in ("content_json","event_payload_json"):
                    if row.get(serialized) is not None:
                        row[serialized]=json.loads(row[serialized])
            result.append(normalize(values))
        if (d:=difference(*result)):
            raise AssertionError(f"database comparison {table}: {d}")
    assert len(pair.covered)==16,pair.covered
    print(f"{pair.count} HTTP pairs passed across 16 HRI contracts; {len(tables)} tables matched including resubmission history and welfare projections")
    pair.covered.clear()
    pair.count=0


def workflow(pair, month):
    hri(pair,month)
    welfare(pair,month)
    start = month + "-01"
    suffix = month.replace("-", "")
    employee = int(pair.sql(pair.databases[0], "SELECT e.id FROM hr_employees e JOIN auth_users u ON u.id=e.user_id WHERE u.login_id='admin-local'"))
    # Match the owner used for /my endpoints, whichever seed administrator logged in.
    who = pair.request(pair.ports[0], "GET", "/api/v1/auth/me")[2]
    if who["email"] == "admin2@vibe-hr.local":
        employee = int(pair.sql(pair.databases[0], "SELECT e.id FROM hr_employees e JOIN auth_users u ON u.id=e.user_id WHERE u.login_id='admin'"))
    masters = ["/setup/codes", "/setup/tax-rates", "/setup/income-tax-brackets", "/setup/allowance-deductions", "/setup/item-groups",
               "/gl-accounts", "/gl-mappings", "/severance-item-rules", "/employee-profiles", "/variable-inputs"]
    for route in masters:
        pair.check(route)
        pair.check(route + "/batch", {"items": [], "delete_ids": []})
    code_fields = {"code": "PAR" + suffix, "name": "Parity", "pay_type": "regular", "payment_day": "25"}
    pay_code = pair.batch(masters[0], code_fields)
    pair.check(masters[0] + "/batch", {"items": [code_fields], "delete_ids": []}, 409)
    pair.check(masters[0] + "/batch", {"items": [{**code_fields, "code": " "}], "delete_ids": []}, 422)
    pair.check(masters[0] + "/batch", {"items": []}, 422)
    pair.check(masters[0] + "/batch", {"items": [], "delete_ids": None}, 422)
    allowance = "TEST" + suffix
    item = pair.batch(masters[3], {"code": allowance, "name": "Parity deduction", "type": "deduction", "tax_type": "tax"})
    group = pair.batch(masters[4], {"code": "GRP" + suffix, "name": "Group", "details": [{"item_id": item, "type": "deduction"}]})
    rate = pair.batch(masters[1], {"year": int(month[:4]), "rate_type": "parity" + suffix, "employee_rate": 3})
    pair.check(masters[1]+"/batch", {"items": [],"delete_ids":[rate]})
    bracket = pair.batch(masters[2], {"year":int(month[:4]),"annual_taxable_from":0,"tax_rate":0,"quick_deduction":0})
    pair.check(masters[2]+"/batch", {"items":[],"delete_ids":[bracket]})
    account = "GL" + suffix
    pair.batch(masters[5], {"code": account, "name": "Synthetic account", "account_type": "liability"})
    mapping = pair.batch(masters[6], {"pay_item_code": allowance, "gl_account_code":account,"effective_from":start})
    pair.batch(masters[7], {"pay_item_code":allowance,"include_type":"exclude"})
    pair.batch(masters[8], {"employee_id":employee,"payroll_code_id":pay_code,"item_group_id":group,"base_salary":2090000,"effective_from":start})
    variable = {"employee_id":employee,"year_month":month,"item_code":allowance,"direction":"deduction","amount":5000}
    pair.batch(masters[9], variable)
    pair.check(masters[9]+"/batch", {"items":[{**variable,"item_code":"TIM_UNPAID"}],"delete_ids":[]},400)
    create = {"year_month":month,"payroll_code_id":pay_code,"run_name":"Parity"}
    run = pair.check("/runs",create)["run"]["id"]
    base=f"/runs/{run}"
    pair.check("/runs",create,409)
    pair.check("/runs?year_month="+month)
    pair.check(base+"/snapshot-backfill",method="POST")
    pair.check(base+"/calculate",method="POST")
    pair.check(base+"/recalculate",method="POST")
    for db in pair.databases:
        pair.sql(db, f"""INSERT INTO tim_leave_requests(employee_id,leave_type,start_date,end_date,request_status,payroll_minutes_snapshot,created_at,updated_at)
            VALUES({employee},'unpaid',DATE '{month}-05',DATE '{month}-05','approved',jsonb_build_object('{month}',480),now(),now())""")
    closed=pair.check(base+"/close",method="POST")
    assert closed["run"]["total_net"] == 2005000 and closed["run"]["total_deductions"] == 85000
    target=pair.check(base+"/employees")["items"][0]["id"]
    pair.check(f"{base}/employees/{target}")
    pair.check(f"/vouchers/mapping-gaps?run_id={run}")
    pair.check("/vouchers/generate",{"run_id":run},422)
    pair.check(masters[6]+"/batch",{"items":[{"id":mapping,"pay_item_code":allowance,
        "gl_account_code":account,"effective_from":"2020-01-01"}],"delete_ids":[]})
    accrual=pair.check("/vouchers/generate",{"run_id":run})["voucher"]["id"]
    pair.check(f"/vouchers/{accrual}")
    pair.check(f"/vouchers/{accrual}/confirm",method="POST")
    pair.check(f"/vouchers/{accrual}/confirm",method="POST",status=409)
    pair.check(f"/vouchers/{accrual}/export")
    pair.check(f"/vouchers/{accrual}/export?format=json")
    pair.check(base+"/mark-paid",method="POST")
    disb=pair.check("/vouchers/generate-disbursement",{"run_id":run})["voucher"]["id"]
    pair.check(f"/vouchers/{disb}/cancel",method="POST")
    pair.check("/vouchers?year_month="+month)
    pair.check("/my/payslips")
    pair.check(f"/my/payslips/{run}")
    pair.check(f"/my/payslips/{run}/pdf")
    pair.check(f"{base}/employees/{employee}/pdf")
    pair.check(base+"/recalculate",method="POST",status=409)
    for invalid in ["/runs/invalid/employees","/runs/1/employees/invalid",
            "/vouchers/mapping-gaps","/vouchers/mapping-gaps?run_id=x","/vouchers/1/export?format=invalid"]:
        pair.check(invalid,status=422)
    pair.check("/vouchers/generate",{},422)
    tables = ["pay_payroll_runs","pay_payroll_run_events","pay_payroll_run_targets","pay_payroll_run_target_events",
        "pay_payroll_run_employees","pay_payroll_run_items","pay_vouchers","pay_voucher_lines","pay_variable_inputs",
        "pay_payroll_codes","pay_tax_rates","pay_income_tax_brackets","pay_allowance_deductions","pay_item_groups",
        "pay_item_group_details","gl_accounts","pay_gl_mappings","pay_severance_item_rules","pay_employee_profiles"]
    for table in tables:
        records=[normalize(json.loads(pair.sql(db,
            f"SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM {table} t"),parse_float=decimal.Decimal)) for db in pair.databases]
        if (d := difference(*records)):
            raise AssertionError(f"database comparison {table}: {d}")
    if len(pair.covered)!=41:
        raise AssertionError(f"only {len(pair.covered)} unique successful method/path contracts compared")
    print(f"{pair.count} HTTP pairs passed across {len(pair.covered)} payroll contracts; {len(tables)} database tables matched")


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reference",type=int,required=True)
    parser.add_argument("--candidate",type=int,required=True)
    parser.add_argument("--container",required=True)
    parser.add_argument("--user",required=True)
    parser.add_argument("--month",required=True)
    parser.add_argument("--pdf-container")
    args=parser.parse_args()
    if not re.fullmatch(r"20[7-9]\d-(0[1-9]|1[0-2])",args.month):
        parser.error("use a synthetic month between 2070 and 2099")
    workflow(Pair(args),args.month)
