"""Run the HR mutation contract on two independently restored local fixture databases.

Set VIBEHR_HR_PARITY=isolated-only and VIBEHR_HR_REFERENCE_TOKEN and
VIBEHR_HR_CANDIDATE_TOKEN to legitimate matching fixture admin sessions.
Run: python scripts/rust-migration/hr-parity.py REFERENCE_ORIGIN CANDIDATE_ORIGIN
Both applications need the same runtime timezone, locale and starting fixture.
"""
import datetime
import json
import os
import subprocess
import sys
import uuid
from urllib.error import HTTPError
from urllib.parse import urlsplit, unquote
from urllib.request import HTTPRedirectHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def endpoint(origin, token):
    parts = urlsplit(origin)
    if (parts.scheme != "http" or parts.hostname not in ("127.0.0.1", "::1")
            or parts.username or parts.password or parts.port is None
            or parts.path not in ("", "/") or parts.query or parts.fragment):
        raise ValueError("Expected explicit loopback test origin and port")
    opener = build_opener(NoRedirect())
    def request(method, route, payload=None):
        data = json.dumps(payload).encode() if payload is not None else None
        req = Request(origin.rstrip("/") + "/api/v1" + route, data=data, method=method, headers={
            "authorization": "Bearer " + token, "content-type": "application/json", "accept-language": "en"})
        try:
            res = opener.open(req, timeout=30)
        except HTTPError as err:
            res = err
        with res:
            raw = res.read()
            return res.status, res.headers.get("content-type"), json.loads(raw) if raw else None
    return request


TIMESTAMPS = {"created_at", "updated_at", "confirmed_at", "calculated_at", "applied_at","assigned_at",
              "checked_at", "cancelled_at"}


def canonical(value, key=None):
    if isinstance(value, dict):
        return {k: canonical(v, k) for k, v in value.items()}
    if isinstance(value, list):
        return [canonical(v) for v in value]
    if key in TIMESTAMPS and isinstance(value, str):
        # Preserve stable fixture dates and output zone semantics, normalizing only
        # values produced during this run (JVM and Rust clocks differ).
        stamp = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
        if abs((stamp.replace(tzinfo=datetime.timezone.utc) - datetime.datetime.now(datetime.timezone.utc)).total_seconds()) < 1200:
            return "<runtime instant>" if value.endswith("Z") else "<runtime local time>"
    return value


def different(a, b, path="body"):
    if isinstance(a, dict) and isinstance(b, dict):
        if a.keys() != b.keys():
            return [path + ".keys " + str(sorted(a.keys() ^ b.keys()))]
        return [delta for key in a for delta in different(a[key], b[key], path + "." + key)]
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return [f"{path}.length {len(a)}/{len(b)}"]
        return [delta for n, (x,y) in enumerate(zip(a,b)) for delta in different(x,y,f"{path}[{n}]")]
    return [] if a == b else [f"{path}: {a!r} != {b!r}"]


def database_state(url, expected_db, employee_ids, finalist_id, order_id, case_id, calc_id):
    parts=urlsplit(url)
    if (parts.scheme not in ("postgresql","postgres") or parts.hostname not in ("127.0.0.1","::1")
            or parts.path != "/"+expected_db):
        raise ValueError("Use the isolated local HR fixture database")
    emp, hired = map(int, employee_ids)
    tables = {
        "auth_users": ("id IN (SELECT user_id FROM hr_employees WHERE id IN (%d,%d))" % (emp,hired), "to_jsonb(r)-'password_hash'"),
        "auth_user_roles": ("user_id IN (SELECT user_id FROM hr_employees WHERE id IN (%d,%d))" % (emp,hired), "to_jsonb(r)"),
        "hr_employees": (f"id IN ({emp},{hired})","to_jsonb(r)"),
        "hr_recruit_finalists": (f"id={int(finalist_id)}","to_jsonb(r)"),
        "hr_appointment_orders": (f"id={int(order_id)}","to_jsonb(r)"),
        "hr_retire_cases": (f"id={int(case_id)}","to_jsonb(r)"),
        "hr_severance_calcs": (f"id={int(calc_id)}","to_jsonb(r)-'tax_detail_json'||jsonb_build_object('tax_detail_json',tax_detail_json::jsonb)"),
    }
    for table in ["hr_employee_basic_profiles","hr_employee_info_records","hr_contact_points","hr_careers","hr_licenses",
                  "hr_military","hr_reward_punish","hr_appointment_order_items","hr_personnel_histories"]:
        tables[table]=(f"employee_id IN ({emp},{hired})","to_jsonb(r)")
    for table in ["hr_retire_case_items","hr_retire_audit_logs"]:
        tables[table]=(f"case_id={int(case_id)}","to_jsonb(r)")
    # A basic profile has a unique employee_id, which is also its public identity.
    # Its private IDENTITY counter may have gaps from earlier rolled-back transactions.
    tables["hr_employee_basic_profiles"]=(f"employee_id IN ({emp},{hired})","to_jsonb(r)-'id'")
    selects=[f"SELECT '{table}' AS name, coalesce(jsonb_agg({fields} ORDER BY {'role_id,user_id' if table=='auth_user_roles' else 'id'}),'[]') AS rows FROM {table} r WHERE {predicate}"
             for table,(predicate,fields) in tables.items()]
    query="SELECT jsonb_object_agg(name,rows) FROM ("+" UNION ALL ".join(selects)+") all_tables;"
    checked=subprocess.run(["psql","-X","-w","-At","-v","ON_ERROR_STOP=1"],input=query, capture_output=True,
        text=True,encoding="utf-8",timeout=30, env={**os.environ,"PGDATABASE":expected_db,
        "PGHOST":parts.hostname,"PGPORT":str(parts.port),"PGUSER":unquote(parts.username or ""),
        "PGPASSWORD":unquote(parts.password or ""),"PGCLIENTENCODING":"UTF8"},check=True)
    return json.loads(checked.stdout)


def main():
    if os.environ.get("VIBEHR_HR_PARITY") != "isolated-only" or len(sys.argv) != 3 or sys.argv[1] == sys.argv[2]:
        raise RuntimeError("Two isolated test apps and explicit VIBEHR_HR_PARITY=isolated-only required")
    left = endpoint(sys.argv[1], os.environ["VIBEHR_HR_REFERENCE_TOKEN"])
    right = endpoint(sys.argv[2], os.environ["VIBEHR_HR_CANDIDATE_TOKEN"])
    for target in (left, right):
        status, _, user = target("GET", "/auth/me")
        if status != 200 or "admin" not in user["roles"] or not (user["email"].endswith("@example.invalid") or user["email"] == "admin@vibe-hr.local"):
            raise RuntimeError("Expected synthetic fixture administrator")
    count = 0
    def check(method, path, payload=None, expect=200):
        nonlocal count
        a = left(method, path, payload)
        b = right(method, path, payload)
        diff = different(canonical(a[2]),canonical(b[2]))
        if a[:2] != b[:2] or a[0] != expect or diff:
            raise AssertionError(f"{method} {path} {a[:2]} / {b[:2]}, expected {expect}: {diff[:4]}")
        count += 1
        return b[2]

    uid = uuid.uuid4().hex[:10]
    no = "HF-" + uid
    departments = check("GET", "/employees/departments")["departments"]
    dept = departments[0]["id"]
    employee = {"employee_no":no,"display_name":"HR fixture", "login_id":"hf-"+uid, "department_id":dept,
                "position_title":"Fixture position", "hire_date":"2021-02-16","password":uuid.uuid4().hex}
    emp = check("POST","/employees",employee,201)["employee"]
    eid = emp["id"]
    check("POST","/employees",employee,409)
    check("GET","/employees?employee_no="+no)
    check("GET","/employees?all=true&positions=Fixture%20position&positions=Other&hire_date_to=2022-01-01&employee_no="+no)
    check("GET","/employees?limit=0", expect=422)
    check("PUT",f"/employees/{eid}",{"position_title":"Edited"})
    check("POST","/employees/batch",{"update":[{"id":eid,"position_title":"Should rollback"},{"id":2147483647,"position_title":"missing"}]},404)
    after = check("GET","/employees?employee_no="+no)["employees"]
    assert after[0]["position_title"] == "Edited", "atomic employee batch rollback"
    check("POST","/employees/batch",{"update":[{"id":eid,"position_title":"Final"}]})
    check("GET","/employees/me",expect=left("GET","/employees/me")[0])
    base = f"/hr/basic/{eid}"
    check("GET",base)
    check("PUT",base+"/profile",{"job_role":"Developer","gender":"F","birth_date":"1992-01-01"})
    check("PUT",base+"/profile",{"gender":None,"birth_date":None})
    for category in ["appointment","education","evaluation","address","career","certificate","military","reward_penalty"]:
        body = {"category":category,"title":"Example","type":"External","organization":"Office","value":"Example","record_date":"2022-02-02"}
        old = check("POST",base+"/records",body,201)
        rid = old["id"]
        check("PUT",base+f"/records/{rid}?category={category}",{"note":"edited"})
        check("GET",f"/hr/basic/admin-records?category={category}&employee_no={no}")
        check("POST",base+"/records/batch",{"category":category,"items":[{"id":rid,"title":"Updated"},{"title":"Inserted"}]})
        check("POST",base+"/records/batch",{"category":category,"delete_ids":[rid],"items":[{"id":rid,"title":"Duplicate"}]},400)
        check("DELETE",base+f"/records/{rid}?category={category}",expect=204)
    check("GET",base)
    finalist_base="/hr/recruit/finalists"
    fin=check("POST",finalist_base,{"full_name":"Recruit "+uid,"birth_date":"1990-01-01","email":uid+"@example.invalid"},201)["item"]
    fid=fin["id"]; ids={"ids":[fid]}
    check("PUT",f"{finalist_base}/{fid}",{"status_code":"appointed"},422)
    check("PUT",f"{finalist_base}/{fid}",{"note":"Updated"})
    check("POST",finalist_base+"/generate-employee-no",ids)
    check("POST",finalist_base+"/generate-employee-no",ids)
    converted=check("POST",finalist_base+"/create-employees",ids)
    assert converted["created_count"]==1, converted
    hired=converted["results"][0]["employee_id"]
    assert check("POST",finalist_base+"/create-employees",ids)["skipped_count"]==1
    check("GET",finalist_base+"?search="+uid)
    inbound={"rows":[{"external_key":"if-"+uid,"full_name":"External "+uid}]}
    check("POST",finalist_base,{**inbound["rows"][0],"source_type":"if"},201)
    check("POST",finalist_base+"/if-sync",inbound)
    check("POST",finalist_base+"/if-sync",inbound)
    external_id=next(row["id"] for row in check("GET",finalist_base+"?search="+uid)["items"] if row["source_type"]=="if")
    check("DELETE",finalist_base,{"ids":[external_id]})
    codes="/hr/appointment-codes"
    code=check("POST",codes,{"code":"HP"+uid,"name":"Test code"},201)["item"]
    cid=code["id"]
    check("GET",codes)
    check("PUT",f"{codes}/{cid}",{"mapping_key":"Test"})
    check("DELETE",f"{codes}/{cid}",expect=204)
    records="/hr/appointments/records"
    payload={"employee_id":hired,"appointment_no":"TEST-"+uid,"order_title":"입사","action_type":"hire",
             "effective_date":"2024-01-01","start_date":"2024-01-01","to_department_id":dept,"to_position_title":"HR fixture"}
    ap=check("POST",records,payload,201)["item"]
    check("PUT",f"{records}/{ap['id']}",{"order_title":"New appointment"})
    check("DELETE",f"{records}/{ap['id']}",expect=204)
    ap=check("POST",records,payload,201)["item"]
    check("GET",records+"?appointment_no=TEST-"+uid)
    confirm=f"/hr/appointments/orders/{ap['order_id']}/confirm"
    check("POST",confirm);check("POST",confirm,expect=409)
    check("DELETE",f"{records}/{ap['id']}",expect=409)
    check("GET",finalist_base+"?search="+uid)
    check("GET",f"/hr/basic/{hired}")
    checklist="/hr/retire/checklist"
    ck=check("POST",checklist,{"code":"t-"+uid,"title":"Temporary", "is_required":False},201)
    check("PUT",f"{checklist}/{ck['id']}",{"is_active":False})
    check("GET",checklist)
    cases="/hr/retire/cases"
    case=check("POST",cases,{"employee_id":eid,"retire_date":"2026-10-01","reason":"Synthetic"},201)
    target=f"{cases}/{case['id']}"
    check("GET",cases+"?status=draft");check("GET",target)
    check("POST",target+"/confirm",expect=400)
    for row in case["checklist_items"]:
        if row["is_required"]:
            check("PUT",target+f"/items/{row['id']}",{"is_checked":True,"note":"checked"})
    check("POST",target+"/confirm");check("POST",target+"/confirm",expect=409)
    calcs="/hr/severance/calcs"
    calc=next(c for c in check("GET",calcs+"?year=2026&limit=200")["items"] if c["retire_case_id"]==case["id"])
    calc_path=f"{calcs}/{calc['id']}"
    check("GET",calc_path);check("POST",calc_path+"/recalculate")
    check("PUT",calc_path,{"adjustment_amount":100000,"adjustment_reason":"reviewed"})
    check("POST",calc_path+"/confirm");check("POST",calc_path+"/confirm",expect=409)
    check("POST",target+"/cancel",{"cancel_reason":"Fixture end"})
    check("POST",target+"/cancel",{"cancel_reason":"Again"},409)
    # Create a fresh dependency-free row to verify both the isolated delete and
    # atomic bulk deletion. The finalized fixture above remains available for audit.
    for suffix, bulk in [("d",False),("b",True)]:
        extra=check("POST","/employees",{**employee,"employee_no":no+suffix,"login_id":"hf-"+uid+suffix},201)["employee"]
        if bulk: check("POST","/employees/batch",{"delete":[extra["id"],extra["id"]]})
        else: check("DELETE",f"/employees/{extra['id']}",expect=204)
    assert check("GET","/employees?employee_no="+no)["total_count"]==1
    reference_db=os.environ.get("VIBEHR_HR_REFERENCE_DATABASE_URL")
    candidate_db=os.environ.get("VIBEHR_HR_CANDIDATE_DATABASE_URL")
    if bool(reference_db) != bool(candidate_db):
        raise ValueError("Both fixture database URLs are required for a state comparison")
    if reference_db:
        args=([eid,hired],fid,ap["order_id"],case["id"],calc["id"])
        before=database_state(reference_db,"hr_reference_test",*args)
        after=database_state(candidate_db,"hr_candidate_test",*args)
        difference=different(canonical(before),canonical(after))
        if difference:
            raise AssertionError(f"database states differ: {difference[:4]}")
        print(f"Matching persistent state across {len(before)} tables")
    # The Spring identity insert for a new IF row violates the full_name constraint.
    # Verify the precise approved exception once, with no change to the generic comparator.
    interface_name="IF-"+uid
    delta={"rows":[{"external_key":interface_name,"full_name":interface_name}]}
    a=left("POST",finalist_base+"/if-sync",delta)
    b=right("POST",finalist_base+"/if-sync",delta)
    assert a[0] == 500 and b[0] == 200 and b[2] == {"inserted_count":1,"updated_count":0}
    query=finalist_base+"?search="+interface_name
    corrected=right("GET",query)[2]
    assert left("GET",query)[2]["total_count"]==0 and corrected["total_count"]==1
    assert right("DELETE",finalist_base,{"ids":[corrected["items"][0]["id"]]})[2]=={"deleted_count":1}
    failed="INVALID-"+uid
    invalid={"rows":[{"external_key":failed,"full_name":failed},{"external_key":"second-"+failed}]}
    check("POST",finalist_base+"/if-sync",invalid,422)
    assert check("GET",finalist_base+"?search="+failed)["total_count"]==0
    print(f"HR stateful parity passed: {count} HTTP comparisons and one documented correction")

if __name__=="__main__":
    main()
