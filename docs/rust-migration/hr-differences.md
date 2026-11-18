# HR recruitment interface insert correction

The Spring reference returned HTTP 500 for a valid new external finalist submitted to `POST /api/v1/hr/recruit/finalists/if-sync`. On a restored local PostgreSQL database, the insert failed the `hr_recruit_finalists.full_name` constraint and the transaction rolled back. In `HrApplicationService.syncFinalists`, the identity-generated entity was persisted before the validated source fields were assigned.

Rust binds the validated name and other source fields in the initial insert. The first request returns HTTP 200 with `inserted_count` equal to 1 and `updated_count` equal to 0. A submission with an existing external key updates the existing finalist. The candidate number lock and the single transaction cover the entire batch.

The local migration scope includes correcting this persistence-order defect without changing the business validation rules. The paired HTTP check asserts the Spring failure and rollback and the Rust success and saved row for this single case. A batch with an invalid second row must return HTTP 422 and leave the valid first row uninserted. Existing-key updates pass the ordinary equality comparison.

Run `scripts/rust-migration/hr-parity.py` with the two isolated application URLs and their fixture sessions. Supplying both isolated database URLs also compares 18 tables after the employee, profile, finalist, appointment, retirement and severance workflows. The comparison checks business identity, immutable fields and state transitions while accounting for generated timestamps and the private generated basic-profile ID.
