"use strict";

const assert = require("assert");
const { normalizeOfflineSql, tableNames } = require("./flyway-baseline");

const normalized = normalizeOfflineSql(`BEGIN;
-- Running upgrade  -> head
CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL);
INSERT INTO alembic_version (version_num) VALUES ('head');
CREATE TABLE auth_roles (id SERIAL NOT NULL);
DROP TABLE users;
COMMIT;
`);

assert.ok(!normalized.includes("alembic_version"));
assert.ok(normalized.includes("DROP TABLE IF EXISTS users;"));
assert.deepStrictEqual(tableNames(normalized), ["auth_roles"]);
process.stdout.write("flyway-baseline unit checks passed.\n");
