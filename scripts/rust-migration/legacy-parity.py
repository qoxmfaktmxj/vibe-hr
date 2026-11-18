"""Exercise historical adoption and drift reconciliation on fresh synthetic PostgreSQL 16 databases."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
from urllib.parse import quote
import uuid

ROOT = Path(__file__).resolve().parents[2]
DRIFT = "e9cf20a655e8f4a06b4e93db40661843ab94d363a906be19e8450397a7a12ec1"
BASE = "fd4fb016274fc2ae5bb637c2e958a968ae625de229f0bbc9cf7b3677a6db613e"
HEAD = "org_mapping_foundation_20260722"
ADOPT = ["adopt-legacy","adopt-exact-alembic-head","/legacy/migration"]
RECONCILE = ["reconcile-legacy","reconcile-known-production-drift-20260803",DRIFT,"/legacy/reconcile.sql"]


def run(argv, data=None, env=None, reject=None):
    p=subprocess.run(argv,input=data,capture_output=True,env=env)
    output=(p.stdout+p.stderr).decode(errors="replace")
    if reject:
        if p.returncode==0 or reject not in output:
            raise AssertionError(f"expected refusal containing {reject!r}; got {output[-1200:]}")
    elif p.returncode:
        raise RuntimeError(output[-1800:])
    return output.strip()


class Proof:
    def __init__(self, args):
        self.args=args
        self.db_prefix="rust_legacy_"+uuid.uuid4().hex[:12]
        self.runner="vibehr-legacy-proof-"+uuid.uuid4().hex[:12]
        attributes=json.loads(run(["docker","inspect",args.postgres]))[0]
        bindings=attributes["NetworkSettings"]["Ports"]["5432/tcp"]
        if not attributes["Config"]["Labels"].get("codex.task","").startswith("vibehr-rust-"):
            raise ValueError("expected a labeled Rust migration fixture container")
        if args.network not in attributes["NetworkSettings"]["Networks"] or not bindings or any(
                b["HostIp"] not in {"127.0.0.1","::1"} for b in bindings):
            raise ValueError("expected an isolated, loopback-bound PostgreSQL test network")
        self.dbs=set()

    def start(self):
        run(["docker","run","-d","--name",self.runner,"--network",self.args.network,
             "--entrypoint","sleep",self.args.image,"infinity"])

    def sql(self,db,sql):
        if db not in self.dbs:
            raise AssertionError("expected a disposable database created by this run")
        return run(["docker","exec","-i",self.args.postgres,"psql","-XqAt","-v","ON_ERROR_STOP=1","-U",
            self.args.user,"-d",db],sql.encode())

    def db(self,suffix):
        db=self.db_prefix+suffix
        run(["docker","exec",self.args.postgres,"createdb","-U",self.args.user,db])
        self.dbs.add(db)
        return db

    def flyway(self,db,op,target=None):
        assert db in self.dbs
        env={**os.environ,"FLYWAY_URL":f"jdbc:postgresql://{self.args.postgres}:5432/{db}",
             "FLYWAY_USER":self.args.user,"FLYWAY_PASSWORD":os.environ["VIBEHR_LEGACY_TEST_PASSWORD"]}
        args=["flyway","-locations=filesystem:/legacy/migration","-cleanDisabled=true","-validateOnMigrate=true"]
        if target:args.append(f"-target={target}")
        return run(["docker","exec","-e","FLYWAY_URL","-e","FLYWAY_USER","-e","FLYWAY_PASSWORD",self.runner,*args,op],env=env)

    def cli(self,db,args,reject=None):
        assert db in self.dbs
        dsn=f"postgresql://{quote(self.args.user,safe='')}:{quote(os.environ['VIBEHR_LEGACY_TEST_PASSWORD'],safe='')}@{self.args.postgres}:5432/{db}"
        return run(["docker","exec","-e","DATABASE_URL",self.runner,"vibehr-backend",*args],
                   env={**os.environ,"DATABASE_URL":dsn},reject=reject)

    def make_head(self,db):
        self.flyway(db,"migrate",1)
        self.sql(db,f"DROP TABLE flyway_schema_history; CREATE TABLE alembic_version(version_num varchar(32) PRIMARY KEY); INSERT INTO alembic_version VALUES('{HEAD}');")

    def verify(self):
        db=self.db("_adopt");self.make_head(db)
        self.sql(db,"INSERT INTO auth_roles(code,name,created_at) VALUES('adoption-check','Synthetic adoption role',timestamp '2020-01-01')")
        role_hash = "SELECT md5(string_agg(to_jsonb(t)::text,chr(10) ORDER BY id)) FROM auth_roles t"
        before_roles = self.sql(db,role_hash)
        self.cli(db,[ADOPT[0],"wrong",ADOPT[2]],"exact explicit confirmation")
        self.sql(db,"UPDATE alembic_version SET version_num='earlier'")
        self.cli(db,ADOPT,"exactly one Alembic head")
        self.sql(db,f"INSERT INTO alembic_version VALUES('{HEAD}')")
        self.cli(db,ADOPT,"exactly one Alembic head")
        self.sql(db,"DELETE FROM alembic_version WHERE version_num='earlier'; ALTER TABLE auth_roles ADD extra_drift integer")
        self.cli(db,ADOPT,"schema metadata drift")
        self.sql(db,"ALTER TABLE auth_roles DROP COLUMN extra_drift")
        assert self.sql(db,"SELECT to_regclass('public.flyway_schema_history') IS NULL")=="t"
        self.sql(db,"ALTER TABLE alembic_version RENAME TO missing_marker")
        self.cli(db,ADOPT,"alembic_version is missing")
        self.sql(db,"ALTER TABLE missing_marker RENAME TO alembic_version")
        assert "ADOPTED" in self.cli(db,ADOPT)
        assert "ALREADY_ADOPTED" in self.cli(db,ADOPT)
        assert self.sql(db,role_hash)==before_roles
        self.sql(db,"CREATE TABLE public.test_history_backup AS TABLE flyway_schema_history")
        mutations=[
            "DELETE FROM flyway_schema_history WHERE version='1'", "DELETE FROM flyway_schema_history WHERE version='2'",
            "UPDATE flyway_schema_history SET success=false WHERE version='2'",
            "UPDATE flyway_schema_history SET checksum=1 WHERE version='1'",
            "UPDATE flyway_schema_history SET checksum=checksum+1 WHERE version='2'",
            "UPDATE flyway_schema_history SET description='changed' WHERE version='1'",
            "UPDATE flyway_schema_history SET script='changed' WHERE version='1'",
            "UPDATE flyway_schema_history SET type='JDBC' WHERE version='2'",
            "INSERT INTO flyway_schema_history SELECT 3,version,description,type,script,checksum,installed_by,installed_on,execution_time,success FROM flyway_schema_history WHERE version='2'",
        ]
        for mutation in mutations:
            self.sql(db,mutation)
            self.cli(db,ADOPT,"exact expected V1/V2")
            self.sql(db,"TRUNCATE flyway_schema_history; INSERT INTO flyway_schema_history SELECT * FROM public.test_history_backup")
        self.sql(db,"DROP TABLE public.test_history_backup; CREATE TABLE alembic_version(version_num varchar(32))")
        self.cli(db,ADOPT,"Both migration histories")
        self.sql(db,"DROP TABLE alembic_version")
        assert "ALREADY_ADOPTED" in self.cli(db,ADOPT)
        drift=self.db("_reconcile"); self.make_head(drift)
        self.cli(drift,[RECONCILE[0],"wrong",*RECONCILE[2:]],"exact explicit confirmation")
        self.cli(drift,[*RECONCILE[:2],"invalid",RECONCILE[3]],"exact reviewed source fingerprint")
        self.cli(drift,RECONCILE,"schema metadata drift")
        fixture=ROOT/"backend-spring/src/test/resources/db/reconciliation/known-production-drift-fixture.sql"
        self.sql(drift,"BEGIN;\n"+fixture.read_text(encoding="utf-8")+"\nCOMMIT;")
        # The reviewed SQL rejects a structurally valid schema with invalid data,
        # rolling the repair back before any source tables move.
        self.sql(drift,"UPDATE tim_leave_requests SET decided_by=987654 WHERE id=19")
        self.cli(drift,RECONCILE,"Foreign-key violation would be introduced")
        assert self.sql(drift,"SELECT to_regnamespace('vibehr_pre_adoption_20260803') IS NULL")=="t"
        self.sql(drift,"UPDATE tim_leave_requests SET decided_by=11 WHERE id=19")
        assignment="SELECT count(*)||':'||md5(string_agg(to_jsonb(t)::text,chr(10) ORDER BY id)) FROM tim_department_schedule_assignments t"
        before=self.sql(drift,assignment)
        report=json.loads(self.cli(drift,RECONCILE).splitlines()[-1])
        assert report["source_fingerprint"]==DRIFT and report["target_fingerprint"]==BASE
        assert report["before"]==report["after"] and len(report["before"])==5
        assert report["before"]["org_departments"][0]==50
        assert all(row[0]==1 for table,row in report["before"].items() if table!="org_departments")
        assert all(row[2]>row[3] for row in report["sequences"].values())
        self.cli(drift,RECONCILE,"archive schema already exists")
        assert "ADOPTED" in self.cli(drift,ADOPT)
        assert "ALREADY_ADOPTED" in self.cli(drift,ADOPT)
        self.flyway(drift,"migrate")
        self.cli(drift,["schema-verify","/legacy/migration/schema-metadata-manifest.json"])
        assert before.startswith("100:") and self.sql(drift,assignment)==before
        assert self.sql(drift,"SELECT count(*) FROM flyway_schema_history WHERE success")=="7"
        print("Passed V1 adoption, exact-history retries and refusal cases; drift rollback, reconciliation, adoption, V7 verification; 5 protected datasets and sequences, 100 schedule assignments.")

    def close(self):
        run(["docker","rm","-f",self.runner])
        for db in self.dbs:
            if not re.fullmatch(self.db_prefix+r"_(adopt|reconcile)",db):
                raise AssertionError("unexpected disposable database name")
            run(["docker","exec",self.args.postgres,"dropdb","-U",self.args.user,db])


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    for flag in ["postgres","network","user","image"]:
        parser.add_argument("--"+flag,required=True)
    proof=Proof(parser.parse_args())
    proof.start()
    try:
        proof.verify()
    finally:
        proof.close()
