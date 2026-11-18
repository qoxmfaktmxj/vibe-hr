"""Exercise dashboard, session settings, menu administration and the common-code grid."""
import argparse
import importlib.util
import uuid
from pathlib import Path

module=importlib.util.spec_from_file_location("time_parity",Path(__file__).with_name("time-parity.py"))
proof=importlib.util.module_from_spec(module)
module.loader.exec_module(proof)

def run(pair):
    pair.prefix="/api/v1"
    tag=uuid.uuid4().hex[:10]
    call=pair.check
    call("/dashboard/summary")
    s="/system-settings/auth-session"
    original=call(s)["policy"]
    call(s,{**original,"access_ttl_min":200,"refresh_threshold_min":35,"reason":"parity test"},method="PUT")
    call(s,{**original,"access_ttl_min":10,"refresh_threshold_min":20},status=400,method="PUT")
    call(s,original,method="PUT")
    c="/codes/groups"
    group={"code":" Q"+tag+" ","name":" Parity group "}
    gid=call(c,group,201)["group"]["id"]
    call(c,group,409)
    # Spring's nullable JPQL search parameters can be bound as bytea. Check
    # the corrected SQLx behavior explicitly, then compare the working filter pair.
    path=c+"?page=1&limit=1&code=Q"+tag
    left=pair.request(pair.ports[0],"GET",pair.prefix+path)
    right=pair.request(pair.ports[1],"GET",pair.prefix+path)
    assert left[0]==500 and right[0]==200 and right[2]["groups"][0]["id"]==gid
    call(path+"&name=Parity")
    call(f"{c}/{gid}",{"name":"renamed group"},method="PUT")
    items=f"{c}/{gid}/items"
    iid=call(items,{"code":" M "+tag,"name":"item","extra_value1":"test"},201)["code"]["id"]
    call(items+"?all=true&code=M&name=item")
    call(f"{items}/{iid}",{"description":"changed"},method="PUT")
    call(f"{c}/by-code/q{tag}/active")
    call(f"{c}/{gid}",status=409,method="DELETE")
    call(f"{items}/{iid}",status=204,method="DELETE")
    call(f"{c}/{gid}",status=204,method="DELETE")
    m="/menus/admin"
    r=m+"/roles"
    rid=call(r,{"code":"role"+tag,"name":"role"},201)["role"]["id"]
    mid=call(m,{"code":"menu"+tag,"name":"parent","path":"/fixture-"+tag,"sort_order":10},201)["menu"]["id"]
    child=call(m,{"code":"child"+tag,"name":"child","parent_id":mid,"sort_order":11},201)["menu"]["id"]
    call(r)
    call(m+"/tree")
    call("/menus/tree")
    call("/menus/actions/current?path=%2Fsettings%2Fcommon-codes")
    call("/menus/actions/current?menuCode=invalid-fixture",status=404)
    call(f"{m}/{mid}",{"name":"parent updated"},method="PUT")
    call(f"{m}/{mid}",status=409,method="DELETE")
    call(f"{r}/{rid}",{"name":"changed role"},method="PUT")
    call(f"{m}/{child}/roles",{"role_ids":[rid,rid]},method="PUT")
    call(f"{m}/{child}/roles")
    call(f"{r}/{rid}/menus")
    call(f"{r}/{rid}/menus",{"menu_ids":[mid,child]},method="PUT")
    matrix=r+"/permissions"
    call(matrix)
    call(matrix,{"mappings":[{"role_id":rid,"menu_ids":[mid,child,mid]}]},method="PUT")
    call(matrix,{"mappings":[{"role_id":rid,"menu_ids":[2147483647]}]},status=400,method="PUT")
    action=r+"/action-permissions"
    initial=call(action)["mappings"]
    payload={"role_id":rid,"menu_id":mid,"action_code":"query","allowed":False}
    call(action,{"mappings":[payload,{**payload,"allowed":True}]},method="PUT")
    call(action,{"mappings":[{**payload,"action_code":"absurd"}]},method="PUT",status=400)
    # Test the original empty matrix semantics only in the verified disposable DBs.
    call(action,{"mappings":[]},method="PUT")
    if initial: call(action,{"mappings":initial},method="PUT")
    call(f"{m}/{child}",status=204,method="DELETE")
    call(f"{m}/{mid}",status=204,method="DELETE")
    call(f"{r}/{rid}",status=204,method="DELETE")
    print(f"{pair.count} paired settings, menu, code and dashboard requests passed")

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    for k in ("candidate","reference"):parser.add_argument("--"+k,type=int,required=True)
    for k in ("container","user"):parser.add_argument("--"+k,required=True)
    proof.base.normalize=proof.normalize
    run(proof.TimePair(parser.parse_args()))
