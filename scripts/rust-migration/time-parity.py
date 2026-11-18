"""Compare the time domain using two disposable databases restored from the same fixture."""
import argparse
import datetime as dt
import importlib.util
import json
import re
from pathlib import Path

spec = importlib.util.spec_from_file_location("payroll_parity", Path(__file__).with_name("payroll-parity.py"))
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)


def normalize(value, key=""):
    if isinstance(value, list):
        return [normalize(v, key) for v in value]
    if isinstance(value, dict):
        return {k: normalize(v, k) for k, v in value.items()}
    if isinstance(value, str) and key == "version_tag" and value.startswith("gen-"):
        return dt.datetime.fromtimestamp(int(value[4:]) / 1000, dt.timezone.utc)
    if isinstance(value, str) and (key.endswith("_at") or key == "check_in_at"):
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    return value


class TimePair(base.Pair):
    databases = ("time_oracle", "time_candidate")


def run(p):
    p.prefix = "/api/v1/tim"
    seed_employee = int(p.sql(p.databases[0], "SELECT e.id FROM hr_employees e JOIN auth_users u ON u.id=e.user_id WHERE u.login_id='admin-local'"))
    dept = int(p.sql(p.databases[0], "SELECT id FROM org_departments WHERE code='HQ-HR'"))
    day = dt.date.fromisoformat(p.options.day)
    assert day.weekday() == 0
    year = day.year
    dates = {"start_date": day.isoformat(), "end_date": day.isoformat()}
    filters = f"?start_date={day}&end_date={day}"
    summary = f"/reports/summary?startDate={day}&endDate={day}"
    p.check("/attendance-daily" + filters)
    p.check("/attendance-daily", status=422)
    p.check(summary)
    for path in ["/schedules/me/today", "/attendance-daily/today-schedule", "/annual-leave/my", f"/annual-leave/employee/{seed_employee}?year={year}",
                 f"/annual-leave/list?year={year}&departmentId={dept}", "/attendance-daily/today"]:
        p.check(path)
    p.check("/annual-leave/adjust", {"employee_id":seed_employee,"year":year,"adjustment_days":2,"reason":"time parity"})
    pattern = p.check("/schedules/patterns")["items"][0]["id"]
    code_tag = "QA" + day.strftime("%y%m%d")
    batches = [
        ("/attendance-codes", {"code":code_tag,"name":"Parity attendance","category":"work"}),
        ("/work-schedules", {"code":code_tag,"name":"Parity schedule","work_start":"09:00","work_end":"18:00"}),
        ("/holidays", {"holiday_date":str(day + dt.timedelta(days=6)),"name":"Parity holiday"}),
        ("/schedules/departments", {"department_id":dept,"pattern_id":pattern,"effective_from":str(day),"effective_to":str(day)}),
        ("/schedules/exceptions/employees", {"employee_id":seed_employee,"pattern_id":pattern,"effective_from":str(day),"effective_to":str(day),"reason":"time parity"}),
    ]
    entries = []
    for path, row in batches:
        filters_ = f"?year={year}" if path == "/holidays" else ""
        result = p.check(path + "/batch" + filters_, {"items":[row],"delete_ids":[]})
        assert result["inserted_count"] == 1
        found = next(item for item in result["items"] if all(item.get(k) == v for k,v in row.items()))
        p.check(path + filters_)
        update = {**row, "id":found["id"]}
        p.check(path + "/batch" + filters_, {"items":[update],"delete_ids":[]})
        entries.append((path, filters_, found["id"]))
    p.check("/holidays/copy-year", {"year_from":year,"year_to":year+1})
    gen = {"date_from":str(day),"date_to":str(day),"target":"employee","employee_ids":[seed_employee]}
    p.check("/schedules/generate",gen)
    p.check("/schedules/generate",{**gen,"mode":"overwrite"})
    punch=p.check("/attendance-daily/check-in",{})
    p.check("/attendance-daily/check-in",{},409)
    punch_id=punch["id"]
    p.check("/attendance-daily/check-out",{})
    p.check("/attendance-daily/check-out",{},409)
    p.check(f"/attendance-daily/detail/{punch_id}")
    p.check(f"/attendance-daily/{punch_id}/correct",{"new_status":"remote","reason":"fixture correction","new_check_in_at":"2026-11-18T00:00:00Z","new_check_out_at":"2026-11-18T10:00:00Z"})
    p.check(f"/attendance-daily/{punch_id}/corrections")
    p.check("/leave-requests?pendingOnly=true")
    for kind, action in [("half_day","approve"),("annual","reject"),("unpaid","approve")]:
        record = p.check("/leave-requests", {**dates,"leave_type":kind,"reason":"격리 연동 테스트"})
        rid=record["id"]
        p.check("/leave-requests", {**dates,"leave_type":kind,"reason":"repeat"},409)
        p.check("/leave-requests/my")
        p.check(f"/leave-requests/{rid}/{action}",{"reason":"test"})
        if action == "approve":
            p.check("/attendance-daily"+filters+"&status=leave")
            p.check(summary)
            p.check("/month-close",{"year":year,"month":day.month,"note":"격리 마감"})
            p.check(f"/month-close?year={year}")
            p.check("/month-close",{"year":year,"month":day.month},409)
            p.check(f"/leave-requests/{rid}/cancel",{"reason":"closed"},423)
            p.check(f"/month-close/{year}/{day.month}/reopen",method="POST")
            p.check(f"/leave-requests/{rid}/cancel",{"reason":"test"})
    for path,q,id_ in entries:
        p.check(path+"/batch"+q,{"items":[],"delete_ids":[id_]})
    for name in ["tim_attendance_daily","tim_attendance_corrections","tim_annual_leaves","tim_leave_requests","tim_month_closes","tim_employee_daily_schedules","pay_variable_inputs"]:
        sql=f"SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY id),'[]') FROM {name} s"
        rows=[normalize(json.loads(p.sql(db,sql))) for db in p.databases]
        delta=base.difference(*rows)
        if delta: raise AssertionError(f"saved state {name}: {delta}")
    print(f"{p.count} paired HTTP requests, {len(p.covered)} distinct successful route operations, 7 state tables matched")


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--reference",type=int,required=True)
    parser.add_argument("--candidate",type=int,required=True)
    parser.add_argument("--container",required=True)
    parser.add_argument("--user",required=True)
    parser.add_argument("--day",default="2038-05-03")
    args=parser.parse_args()
    base.normalize=normalize
    run(TimePair(args))
