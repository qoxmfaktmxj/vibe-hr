# Business behavior differences

## Generating e-learning windows for a fresh year

The live Spring baseline returned HTTP 500 for `POST /api/v1/tra/generate/elearning-windows` with year 2038 and app count 2. The starting database had no windows for that year. PostgreSQL reported SQLSTATE 23502. Spring persisted an identity-generated row with only its year/month and audit timestamps, triggering an immediate insert before assigning the required start and end dates. The transaction saved zero windows.

The Rust implementation supplies the complete row in the initial insert. It generates twelve windows atomically, using the first Monday and following Friday of each month. Existing windows receive updated dates and the requested application count. This is a deliberate repair of the fresh-install execution order; the existing calendar rules and access checks still apply. Compare the successful update path on equally preseeded months, and verify the fresh-year insertion independently on Rust.

## Generic JDBC projection timestamps

With the same UTC-naive value stored in PostgreSQL, Spring's MyBatis appraisal target projection on an Asia/Seoul JVM returned an instant nine hours earlier than the raw column. JPA-backed appraisal master and final result fields use UTC instants. The distinction matters when comparing a Windows reference process with a Linux container. For projection parity compare like runtime timezones; the configurable OS timezone can affect JDBC-style timestamp reads.

## Listing common codes without filters

On PostgreSQL, the Spring reference returned HTTP 500 for an authenticated administrator listing `/api/v1/codes/groups` or `/api/v1/codes/groups/1/items` without `code` and `name`. The query supplied an untyped null to `lower`, and PostgreSQL reported that `lower(bytea)` does not exist. Rust binds optional filters as text and returns the unfiltered page. The read comparison requires the actual Spring 500 on that specific path, repeats the reference read with explicit wildcards on both nonnull columns and compares the complete successful response to the Rust result.
