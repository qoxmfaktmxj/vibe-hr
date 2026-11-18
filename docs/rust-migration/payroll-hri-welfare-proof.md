# Payroll, HRI and welfare verification

On 2026-11-19 the same local fixture administrator sent HTTP requests to a Spring reference and a Rust candidate backed by separate PostgreSQL 16 databases. Each database started from the same Flyway and development seed dump. The harness checks database-specific fixture markers against the HTTP origins before issuing business writes.

| Domain | Successful method and path contracts | Compared HTTP pairs including rejection cases | Compared PostgreSQL tables |
|---|---:|---:|---:|
| Payroll | 41 | 70 | 19 |
| HRI | 16 | 37 | 13 |
| Welfare | 8 | 18 | 2 |

The table counts overlap. HRI verification includes the welfare request projection. Responses were compared by HTTP status, content type, attachment disposition and payload. The harness compares monetary values numerically, timestamps of independent operations within five seconds, stored JSON payloads by content and PDFs by extracted text. The comparisons include database records, relationships and history after successful transitions and rejected operations.

## Differences found and corrected

- The live Spring payroll batch endpoints reject both omitted and explicit-null `delete_ids` with HTTP 422. Supplying an empty list succeeds. The name of a Spring unit test implied a different omission policy. The Rust batch decoder and differential test now reproduce both observed outcomes.
- Payroll uses two different monetary rounding paths. Existing two-decimal and whole-won calculations round the exact binary float with half-even ties. The automatic unpaid-leave calculation takes the decimal monthly salary, sums approved minutes and rounds once after dividing by 12,540. Rust tests preserve the Spring examples for both paths.
- The payroll menu gate can grant a standard action through a role override even when the menu has records for other actions and omits that action's definition. A PostgreSQL test exercises the specific override after first confirming the default denial.
- Spring reports integer conversion errors for invalid payroll path IDs at a query-named error location and uses the same-named query parameter for its input. Rust also accepts the observed Spring hexadecimal and whitespace integer forms. Invalid export formats and the HRI receive-complete repeat preserve their specific Spring error messages.

## Workflows covered

- Payroll master batches, employee profiles, manual deductions, snapshot creation and refresh, calculation and recalculation, approved unpaid time discovered at close, accrual and disbursement, owner payslips, CSV and JSON exports and Korean PDFs. The Rust PostgreSQL regression also launches competing natural-key run creations and checks that the loser receives a conflict. It checks another employee's payslip denial and rejects a paid-run recalculation.
- HRI form and approval template administration, typed correction, certificate and leave details, incomplete drafts, attachment policy, transactional direct submission, approval rejection, receipt rejection, resubmission lineage, completed requests and withdrawal. The welfare projection updates inside the HRI transaction. Paired queries cover both task inboxes.
- Welfare type create/update/delete, request creation, manager approval and rejection, owner withdrawal, invalid paging and repeated-action conflicts.
- Synthetic single-page and multipage A4 PDF fixtures retain extractable Korean employee information, earnings, deductions and totals. The renderer uses an installed Korean font. PDF tests require Poppler and a suitable font such as Nanum Gothic.

## Reproduce

Provision two local HTTP servers with the same synthetic token secrets, identical seeded PostgreSQL 16 databases named `payroll_oracle` and `payroll_candidate`, and an isolated container bound to loopback with its `codex.task` label starting with `vibehr-rust-`. Obtain the dev administrator's access token through the fixture login and set `VIBEHR_PARITY_TOKEN`. Use a new synthetic month for each retained run. Supply `--pdf-container` when the local Poppler installation is inside a test container.

```sh
python scripts/rust-migration/payroll-parity.py \
  --reference "$SPRING_PORT" --candidate "$RUST_PORT" \
  --container "$TEST_POSTGRES" --user "$TEST_ROLE" --month 2070-01
```

On a separate seeded database named `payroll_test`, set `VIBEHR_PAYROLL_TEST_URL` and run the crate tests from `backend-rust`.

```sh
cargo test --lib payroll:: -- --include-ignored
cargo test --lib hri::
```

These checks exercise the API and storage boundaries. The separate browser financial suite owns the production-style BFF, attendance-to-payroll, retirement and severance journeys.
