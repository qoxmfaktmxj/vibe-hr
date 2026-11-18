import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

const [domain,referencePort,candidatePort,container] = process.argv.slice(2);
const prefixes={organization:"org",management:"mng",appraisal:"pap",training:"tra"};
if (!Object.hasOwn(prefixes,domain) || ![referencePort,candidatePort].every(x => /^\d+$/.test(x)) || referencePort===candidatePort || !container) {
  throw new Error("Usage: node business-parity.mjs organization|management|appraisal|training REFERENCE_PORT CANDIDATE_PORT POSTGRES_CONTAINER");
}
const token=process.env.VIBEHR_PARITY_TOKEN;
const user=process.env.VIBEHR_PARITY_DB_USER;
if (!token || !user) throw new Error("Set VIBEHR_PARITY_TOKEN to a genuine synthetic admin session and VIBEHR_PARITY_DB_USER to the test database role");
const suffix=process.env.VIBEHR_PARITY_FIXTURE_SUFFIX??"";
if(!/^(?:_[a-z0-9_]+)?$/.test(suffix))throw new Error("Invalid disposable database suffix");
const targets=[[referencePort,"business_oracle"+suffix],[candidatePort,"business_candidate"+suffix]];
const meta=JSON.parse(execFileSync("docker",["inspect",container],{encoding:"utf8"}))[0];
if (!meta.Config.Labels?.["codex.task"]?.startsWith("vibehr-rust-") ||
    !meta.NetworkSettings.Ports["5432/tcp"]?.every(p=>["127.0.0.1","::1"].includes(p.HostIp))) throw new Error("Expected the loopback parity database container");

async function request(port,method,path,data){
  const res=await fetch("http://127.0.0.1:"+port+path,{method,headers:{authorization:"Bearer "+token,"content-type":"application/json","accept-language":"en"},
    body:data===undefined?undefined:JSON.stringify(data),redirect:"error",signal:AbortSignal.timeout(20000)});
  const raw=await res.text();
  return {status:res.status,type:res.headers.get("content-type"),body:raw?(res.headers.get("content-type")?.includes("json")?JSON.parse(raw):raw):null};
}
for(const [port,name] of targets){
  const health=await request(port,"GET","/api/v1/health");
  assert.equal(health.body.app,name);assert.equal(health.body.environment,"rust-parity");assert.equal(health.body.db,"ok");
  const who=await request(port,"GET","/api/v1/auth/me");assert.equal(who.status,200);
  assert.ok(["admin@vibe-hr.local","admin2@vibe-hr.local"].includes(who.body.email)&&who.body.roles.includes("admin"),"Expected an isolated seeded admin");
}
const pathBase="/api/v1/"+prefixes[domain];
const covered=new Set();
let pairs=0;
function equal(a,b,at="body",key=""){
  if(a===b)return;
  if (a===null||b===null||typeof a!==typeof b)throw new Error(at+" differs in type or nullability");
  if(typeof a==="object"){
    assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),at+" keys");
    for(const k of Object.keys(a)) equal(a[k],b[k],at+"."+k,k);
  }else if(typeof a==="string"&&["created_at","updated_at","changed_at","applied_at","evaluated_at"].includes(key)){
    const ms=s=>Date.parse(/[Zz]|[+-]\d\d:\d\d$/.test(s)?s:s.replace(" ","T")+"Z");
    assert.ok(Math.abs(ms(a)-ms(b))<5000,at+" timestamp skew exceeds 5 seconds");
  }else throw new Error(at+" value differs");
}
async function check(method,path,data,status=200){
  const [left,right]=await Promise.all(targets.map(([p])=>request(p,method,pathBase+path,data)));
  const label=method+" "+path;
  assert.equal(left.status,status,label+" Spring status");assert.equal(right.status,status,label+" Rust status");
  assert.equal(left.type,right.type,label+" content type");equal(left.body,right.body,label);
  let canonical=path.split("?")[0].replace(/\/\d+(?=\/|$)/g,"/{id}");
  if(domain==="training")canonical=canonical.replace(/^\/(organizations|courses|events|required-standards|required-targets|applications|elearning-windows|histories|cyber-uploads)(\/batch)?$/,(_,name,batch)=>"/{resource}"+(batch??""));
  if(status<300)covered.add(method+" "+canonical);pairs++;return left.body;
}
function sql(database,text){
  return execFileSync("docker",["exec","-i",container,"psql","-XqAt","-v","ON_ERROR_STOP=1","-U",user,"-d",database],{input:text,encoding:"utf8",maxBuffer:16*1024*1024}).trim();
}
function compareTables(names){
  for(const name of names){
    assert.match(name,/^[a-zA-Z_]+$/);
    const qualified='public."'+name+'"';
    const query="BEGIN READ ONLY; SET LOCAL TIME ZONE 'UTC'; SELECT row_to_json(t) FROM "+qualified+" t ORDER BY id; COMMIT;";
    const sides=targets.map(([,database])=>sql(database,query).split(/\r?\n/).filter(Boolean).map(row=>JSON.parse(row)));
    equal(sides[0],sides[1],name);
    const seq="SELECT pg_get_serial_sequence('"+qualified+"','id')";
    const sequence=sql(targets[0][1],seq);
    if(sequence){
      assert.match(sequence,/^public\.(?:[a-z_]+|"[A-Za-z_]+")$/);
      const state="SELECT last_value,is_called FROM "+sequence;
      assert.equal(sql(targets[0][1],state),sql(targets[1][1],state),name+" sequence");
    }
  }
}
const tag=randomUUID().replaceAll("-","").slice(0,12).toUpperCase();
const get=p=>check("GET",p);const post=(p,b,s)=>check("POST",p,b,s);const put=(p,b,s)=>check("PUT",p,b,s);const del=(p,b,s)=>check("DELETE",p,b,s);
const lockstep=async(path,body,statuses)=>{
  const sides=await Promise.all(targets.map(([p])=>Promise.all([request(p,"POST",pathBase+path,body),request(p,"POST",pathBase+path,body)])));
  for(const pair of sides)assert.deepEqual(pair.map(r=>r.status).sort(),[...statuses].sort(),path+" concurrent outcomes");
  return sides;
};
async function organization(){
  const tables=["org_corporations","org_departments","org_dept_change_histories","org_mapping_type_items","org_mapping_assignments","org_restructure_plans","org_restructure_plan_items"];
  const corp=await post("/corporations",{enter_cd:tag.toLowerCase(),company_code:tag,corporation_name:"테스트법인"},201);
  await get("/corporations?enter_cd="+tag+"&all=true");await put("/corporations/"+corp.corporation.id,{corporation_number:" 01 "});
  await del("/corporations/"+corp.corporation.id,undefined,204);
  const dept=(await post("/departments",{code:tag,name:"조직개편 전"},201)).department.id;
  const child=(await post("/departments",{code:"C"+tag,name:"기존 부서",parent_id:dept},201)).department.id;
  await get("/departments?all=true&code="+tag+"&reference_date=2026-11-19");
  await get("/chart");await put("/departments/"+child,{});await put("/departments/"+child,{parent_id:null,description:"비고"});
  await get("/dept-history?department_id="+child);await del("/departments/"+child,undefined,409);
  const unused=(await post("/departments",{code:"U"+tag,name:"삭제 가능 부서"},201)).department.id;
  await del("/departments/"+unused,undefined,204);
  for(const path of ["/mapping-types","/mapping-type-options","/department-options","/mapping-assignments/upload-template","/mapping-personal-status?reference_date=2026-11-19"])await get(path);
  const item=(await post("/mapping-type-items",{type_code:"COST",item_code:tag,name:"매핑항목",effective_from:"2020-01-01",effective_to:"2026-12-31",remark:"비고"},201)).item.id;
  await put("/mapping-type-items/"+item,{effective_to:null,remark:null});
  await get("/mapping-type-items?type_code=COST&reference_date=2026-01-01");await get("/mapping-item-options?type_code=COST");
  const assignment=(await post("/mapping-assignments",{department_id:dept,type_code:"COST",item_id:item,effective_from:"2020-01-01",effective_to:"2020-12-31"},201)).item.id;
  await put("/mapping-assignments/"+assignment,{effective_to:"2020-11-30"});
  await del("/mapping-type-items/"+item,undefined,409);
  const row={department_code:tag,type_code:"COST",item_code:tag,effective_from:"2021-01-01"};
  const invalid={mode:"atomic",rows:[row,{...row,department_code:"NO-SUCH-DEPT"}]};
  await post("/mapping-assignments/upload-preview",invalid);await post("/mapping-assignments/upload-confirm",invalid,422);
  await post("/mapping-assignments/upload-confirm",{mode:"atomic",rows:[row]});await post("/mapping-assignments/upload-confirm",{mode:"atomic",rows:[row]});
  for(const a of (await get("/mapping-assignments?department_id="+dept)).items)await del("/mapping-assignments/"+a.id,undefined,204);
  await del("/mapping-type-items/"+item,undefined,204);
  const plan="/restructure/plans/"+(await post("/restructure/plans",{title:"개편 "+tag})).id;
  await get("/restructure/plans?status=draft");await put(plan,{status:"reviewing"});
  const changes=plan+"/items";
  const removed=await post(changes,{action_type:"deactivate",target_dept_id:dept});await del(changes+"/"+removed.id,undefined,204);
  const rename=await post(changes,{action_type:"rename",target_dept_id:dept,new_name:"부서명 변경"});await put(changes+"/"+rename.id,{memo:"검토"});
  await post(changes,{action_type:"create",new_name:"코드 누락",sort_order:1});await get(changes);
  await post(plan+"/apply");await post(plan+"/apply",undefined,409);
  const draft=await post("/restructure/plans",{title:"취소"});await del("/restructure/plans/"+draft.id,undefined,204);
  compareTables(tables);assert.equal(covered.size,35);
}
async function management(){
  const tables=["mng_companies","mng_manager_companies","mng_dev_requests","mng_dev_projects","mng_dev_inquiries","mng_outsource_contracts","mng_outsource_attendances","mng_infra_masters","mng_infra_configs"];
  const employee=Number(sql(targets[0][1],"SELECT e.id FROM hr_employees e JOIN auth_users u ON e.user_id=u.id WHERE u.login_id='kr-0001'"));
  const company=(await post("/companies",{company_code:tag,company_name:" 고객사 ",company_type:"fixture"},201)).company.id;
  const companyQ="?company_id="+company;
  await get("/companies?search="+tag);await get("/companies/dropdown");await get("/companies/"+company);await put("/companies/"+company,{company_type:null});
  const manager=(await post("/manager-status",{employee_id:employee,company_id:company,start_date:"2026-01-01"},201)).items.find(r=>r.company_id===company).id;
  await get("/manager-status");await del("/manager-status",{ids:[manager]});
  const req={company_id:company,request_ym:"2026-01-01",request_seq:0,is_paid:true,paid_man_months:0.5};
  await post("/dev-requests",{company_id:company,request_ym:"2026-01-01"},422);
  const r=(await post("/dev-requests",req,201)).item.id;
  const calls=await lockstep("/dev-requests",req,[201,201]);
  for(const side of calls)assert.deepEqual(side.map(r=>r.body.item.request_seq).sort(),[2,3]);
  await get("/dev-requests"+companyQ);await get("/dev-requests/"+r);await put("/dev-requests/"+r,{note:"테스트"});
  await get("/dev-requests/monthly-summary"+companyQ);
  const project=(await post("/dev-projects",{project_name:" 프로젝트 ",company_id:company,contract_amount:1200,actual_man_months:3},201)).item.id;
  await put("/dev-projects/"+project,{project_name:""},422);
  await get("/dev-projects"+companyQ);await get("/dev-projects/"+project);await put("/dev-projects/"+project,{note:" 비고 ",assigned_staff:null});
  await get("/dev-staff/projects"+companyQ);await get("/dev-staff/revenue-summary"+companyQ);
  const inquiry=(await post("/dev-inquiries",{company_id:company,inquiry_content:"문의"},201)).item.id;
  await get("/dev-inquiries"+companyQ);await get("/dev-inquiries/"+inquiry);await put("/dev-inquiries/"+inquiry,{inquiry_content:null});
  const start="2038-01-01";
  const contract=(await post("/outsource-contracts",{employee_id:employee,start_date:start,end_date:"2038-12-31",total_leave_count:15},201)).item.id;
  await get("/outsource-contracts");await get("/outsource-contracts/"+contract);
  await get("/outsource-contracts/check-duplicate?employee_id="+employee+"&start_date="+start);
  await put("/outsource-contracts/"+contract,{extra_leave_count:1.5});
  const att=(await post("/outsource-attendances",{employee_id:employee,contract_id:contract,attendance_code:"LEAVE",start_date:start,end_date:start,apply_count:0.5},201)).items[0].id;
  await get("/outsource-attendances/"+contract);await get("/outsource-attendances/summary");
  const master=(await post("/infra-masters",{company_id:company,env_type:"dev",service_type:"API"},201)).items.find(m=>m.company_id===company).id;
  await get("/infra-masters"+companyQ);
  const configPath="/infra-configs/"+master;const options={rows:[{section:"section",config_key:"key",config_value:"test",sort_order:1}]};
  const config=(await post(configPath,options)).items[0].id;await post(configPath,options);await get(configPath);
  compareTables(tables);
  await del("/infra-configs/"+config,undefined,204);await del("/infra-masters",{ids:[master]});
  await del("/outsource-attendances",{ids:[att]});await del("/outsource-contracts",{ids:[contract]});
  await del("/dev-requests",{ids:(await get("/dev-requests"+companyQ)).items.map(x=>x.id)});await del("/dev-projects",{ids:[project]});await del("/dev-inquiries",{ids:[inquiry]});await del("/companies",{ids:[company]});
  compareTables(tables);assert.equal(covered.size,43);
}
async function appraisal(){
  const employee=Number(sql(targets[0][1],"SELECT id FROM hr_employees ORDER BY id LIMIT 1"));
  const tables=["PAP_FINAL_RESULTS","PAP_APPRAISAL_MASTERS","pap_appraisal_targets"];
  const grade=await post("/final-results",{result_code:tag,result_name:"결과",score_grade:85,sort_order:0},201);
  const finalId=grade.item.id;
  await get("/final-results?all=true&code="+tag);
  await put("/final-results/"+finalId,{score_grade:null,description:"비고"});
  const values={appraisal_code:tag,appraisal_name:"테스트 평가",appraisal_year:2038,final_result_id:finalId,start_date:"2038-01-01",end_date:"2038-12-31",sort_order:0};
  const appraisalId=(await post("/appraisals",values,201)).item.id;
  await post("/appraisals",values,409);
  await get("/appraisals?all=true&code="+tag+"&appraisal_year=2038");
  await put("/appraisals/"+appraisalId,{start_date:null,description:"수정"});
  await put("/appraisals/"+appraisalId,{final_result_id:null},400);
  const row={_status:"added",appraisal_id:appraisalId,employee_id:employee,score:75};
  await post("/targets/batch",{items:[row,{...row,employee_id:null}]},400);
  await post("/targets/batch",{items:[row]});
  const id=(await get("/targets?appraisal_id="+appraisalId)).items[0].id;
  await post("/targets/batch",{items:[{id,_status:"updated",clear_score:true,status:"evaluated",evaluator_note:"테스트"}]});
  await get("/targets?appraisal_id="+appraisalId);compareTables(tables);
  await post("/targets/batch",{items:[{id,_status:"deleted"}]});await del("/appraisals/"+appraisalId,undefined,204);await del("/final-results/"+finalId,undefined,204);
  compareTables(tables);assert.equal(covered.size,10);
}
async function training(){
  const tables=["tra_organizations","tra_courses","tra_events","tra_required_rules","tra_required_targets","tra_applications","tra_elearning_windows","tra_histories","tra_cyber_uploads"];
  // Spring can only regenerate a complete existing year. See business-differences.md.
  // Give each independently migrated DB the same historical seed dates before comparing updates.
  for(const [,db] of targets){
    sql(db,`INSERT INTO tra_elearning_windows(year_month,start_date,end_date,app_count,created_at,updated_at)
      SELECT to_char(d,'YYYYMM'),d::date,(d+interval '4 days')::date,1,timestamp '2025-01-01',timestamp '2025-01-01'
      FROM generate_series(date '2038-01-01',date '2038-12-01',interval '1 month') d
      WHERE NOT EXISTS(SELECT FROM tra_elearning_windows w WHERE w.year_month=to_char(d,'YYYYMM'));`);
  }
  const save=(r,items)=>post("/"+r+"/batch",{items});
  await save("organizations",[{_status:"added",name:tag}]);
  const org=(await get("/organizations")).items.find(x=>x.name===tag);
  await save("courses",[{_status:"added",course_name:tag,organization_id:org.id}]);
  const course=(await get("/courses")).items.find(x=>x.course_name===tag);
  await save("required-standards",[{_status:"added",year:2038,rule_code:tag,course_id:course.id,start_month:2,end_month:2}]);
  const standard=(await get("/required-standards?year=2038")).items.find(x=>x.rule_code===tag);
  await post("/generate/required-events",{year:2038});await post("/generate/required-events",{year:2038});
  await post("/generate/required-targets",{year:2038,rule_code:tag});await post("/generate/required-targets",{year:2038,rule_code:tag});
  const teaching=(await get("/events")).items.find(x=>x.course_id===course.id);
  await get("/required-targets?year=2038");await post("/generate/elearning-windows",{year:2038,app_count:2});await get("/elearning-windows");
  const application={course_id:course.id,event_id:teaching.id,year_plan_yn:false,note:tag};
  const first=(await post("/my-applications",application)).item;
  await post("/applications/"+first.id+"/approve");await post("/applications/"+first.id+"/approve",undefined,409);
  const second=(await post("/my-applications",application)).item;await post("/applications/"+second.id+"/reject",{reason:"테스트"});
  const third=(await post("/my-applications",application)).item;await put("/applications/"+third.id+"/withdraw",{});
  await get("/my-applications");await get("/applications-detail");await get("/applications");
  await save("cyber-uploads",[{_status:"added",upload_ym:"203801",employee_no:"DEMO-0001",course_name:"사이버"+tag,organization_name:"기관"+tag,start_date:"20380110",end_date:"2038-01-11",reward_hour:1.5}]);
  await post("/cyber-results/apply",{upload_ym:"203801"});await post("/cyber-results/apply",{upload_ym:"203801"});
  await get("/cyber-uploads");await get("/histories");
  await save("required-standards",[{_status:"updated",id:standard.id,note:"수정",is_active:"false"}]);
  await save("organizations",[{_status:"added",name:"삭제"+tag}]);
  const unused=(await get("/organizations")).items.find(x=>x.name==="삭제"+tag).id;
  await save("organizations",[{_status:"deleted",id:unused}]);
  compareTables(tables);assert.equal(covered.size,12);
}
await ({organization,management,appraisal,training})[domain]();
console.log(JSON.stringify({domain,paired_responses:pairs,unique_successful_mappings:covered.size}));
