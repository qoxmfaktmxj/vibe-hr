# PAP Module Rules

## 1) Table naming
- All PAP physical tables must start with `PAP_`.
- Example: `PAP_APPRAISAL_MASTERS`, `PAP_TARGET_MASTERS`, `PAP_RESULT_SCORES`.

## 2) Business logic location
- Do not implement business logic in DB stored procedures/functions/triggers.
- Implement business logic in application layer:
  - API: `backend/app/api/*`
  - Service: `backend/app/services/*`
  - Schema/validation: `backend/app/schemas/*`

## 3) DB role
- DB keeps only:
  - tables
  - indexes
  - unique/check constraints
  - foreign keys
- No domain workflow logic in DB object code.

## 4) Legacy migration policy
- Legacy TPAP procedure/function behavior must be mapped into service methods.
- Keep service method names explicit by use-case (request/approve/close/calculate).
