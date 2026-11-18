# VIBE-HR Rust backend migration

The Rust release passed the isolated CI, real BFF browser checks and the previous-image rollback rehearsal on 2026-11-19. Production rollout requires a separate decision. See the [verification report](verification.md).

```mermaid
flowchart LR
    Browser["React 화면과 AG Grid"] --> BFF["Next.js BFF<br/>쿠키와 요청 전달"]
    BFF --> API["axum API<br/>서명, 활성 계정, 입력 검증"]
    API --> Services["도메인 서비스<br/>권한, 업무 규칙, SQLx 트랜잭션"]
    Services --> Postgres[("PostgreSQL")]
    Migration["Flyway<br/>스키마와 필수 기준 데이터"] --> Postgres
    Guard["Rust 스키마 검증"] -.-> Postgres
```

The application deploys as one process. HTTP handlers read requests and map response DTOs. Each writing domain service owns the SQL transaction for its business operation. Shared middleware verifies access tokens against current account state and validates BFF assertions. Route-specific services enforce roles, menu access, action permissions and ownership. Session renewal reads the database policy. Financial services retain the current rounding and duplicate-operation rules.

Flyway remains responsible for schema and reference rows. Keep versioned scripts and recorded checksums intact. The final deployment must run the migration and validation steps on both a fresh database and a restored existing database. Rust application startup and normal API calls must not implicitly seed arbitrary databases.

## Validation and rollback

Capture current routes and non-HTTP responsibilities, then compare each domain against a running Spring reference using two isolated copies of the same initial database. Compare status, response shape, values and committed changes, including rejected operations. Re-run browser workflows through the Next.js BFF with Spring stopped. Require actual evidence for the financial and authorization behavior in addition to generic UI smoke tests.

Hold default traffic on Spring until the complete inventory has matching evidence. Rehearse switching the BFF target to the Rust service and back to the previous Spring build using a compatible database. Before cutover verify that any candidate writes can still be read by Spring, including replay and financial state. No reverse DDL is part of traffic rollback. Any data reconciliation or production rollout requires a separate decision.
